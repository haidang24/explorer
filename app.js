const express = require("express");
const Web3 = require("web3");
const path = require("path");
const WebSocket = require("ws");
const http = require("http");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Connect to local Geth node
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    process.env.GETH_NODE_URL || "http://localhost:8545"
  )
);

// Also connect via WebSocket for subscriptions
const web3WS = new Web3(
  new Web3.providers.WebsocketProvider(``
    process.env.GETH_WS_URL || "ws://localhost:8546"
  )
);

app.use(express.static("public"));
app.use(express.json());

// WebSocket connection handling
wss.on("connection", (ws) => {
  console.log("New WebSocket client connected");

  // Subscribe to new blocks
  const blockSubscription = web3WS.eth.subscribe(
    "newBlockHeaders",
    (error, result) => {
      if (error) {
        console.error("Block subscription error:", error);
        return;
      }
    }
  );

  blockSubscription.on("data", async (blockHeader) => {
    try {
      // Get full block details
      const block = await web3.eth.getBlock(blockHeader.number, true);
      ws.send(JSON.stringify({ type: "newBlock", data: block }));

      // Get updated network stats
      const [gasPrice, peerCount, hashrate] = await Promise.all([
        web3.eth.getGasPrice(),
        web3.eth.net.getPeerCount(),
        web3.eth.getHashrate(),
      ]);

      ws.send(
        JSON.stringify({
          type: "networkStats",
          data: {
            latestBlockNumber: block.number,
            latestBlockTime: block.timestamp,
            gasPrice: web3.utils.fromWei(gasPrice, "gwei"),
            peerCount,
            hashrate,
          },
        })
      );
    } catch (error) {
      console.error("Error processing new block:", error);
    }
  });

  // Subscribe to pending transactions
  const pendingTxSubscription = web3WS.eth.subscribe("pendingTransactions", (error, result) => {
    if (error) {
      console.error("Transaction subscription error:", error);
      return;
    }
  });

  pendingTxSubscription.on("data", async (txHash) => {
    try {
      // Get transaction details
      const [tx, block] = await Promise.all([
        web3.eth.getTransaction(txHash),
        web3.eth.getBlock("latest")
      ]);

      if (tx) {
        // Add timestamp and status
        const enrichedTx = {
          ...tx,
          timestamp: block.timestamp,
          status: tx.blockNumber ? 'confirmed' : 'pending',
          value: tx.value || '0',
          gasPrice: tx.gasPrice || '0'
        };

        ws.send(JSON.stringify({ 
          type: "newTransaction", 
          data: enrichedTx 
        }));

        // If transaction is in a block, get receipt for more details
        if (tx.blockNumber) {
          const receipt = await web3.eth.getTransactionReceipt(txHash);
          if (receipt) {
            const confirmedTx = {
              ...enrichedTx,
              status: receipt.status ? 'success' : 'failed',
              gasUsed: receipt.gasUsed,
              logs: receipt.logs,
              contractAddress: receipt.contractAddress
            };
            
            ws.send(JSON.stringify({ 
              type: "transactionConfirmed", 
              data: confirmedTx 
            }));
          }
        }
      }
    } catch (error) {
      console.error("Error processing new transaction:", error);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    blockSubscription.unsubscribe();
    pendingTxSubscription.unsubscribe();
  });
});

// API Routes
app.get("/api/stats", async (req, res) => {
  try {
    const [latestBlock, gasPrice, peerCount, isMining, hashrate, syncing] =
      await Promise.all([
        web3.eth.getBlock("latest"),
        web3.eth.getGasPrice(),
        web3.eth.net.getPeerCount(),
        web3.eth.isMining(),
        web3.eth.getHashrate(),
        web3.eth.isSyncing(),
      ]);

    res.json({
      latestBlockNumber: latestBlock.number,
      latestBlockTime: latestBlock.timestamp,
      gasPrice: web3.utils.fromWei(gasPrice, "gwei"),
      peerCount,
      isMining,
      hashrate,
      syncing,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/blocks/latest", async (req, res) => {
  try {
    const latestBlock = await web3.eth.getBlockNumber();
    const blocks = [];

    for (let i = 0; i < 10; i++) {
      if (latestBlock - i < 0) break;
      const block = await web3.eth.getBlock(latestBlock - i, true);
      blocks.push(block);
    }

    res.json(blocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/block/:number", async (req, res) => {
  try {
    const [block, nextBlock] = await Promise.all([
      web3.eth.getBlock(req.params.number, true),
      web3.eth.getBlock(parseInt(req.params.number) + 1, true),
    ]);

    // Calculate block reward
    const blockReward = "2000000000000000000"; // 2 ETH for example
    const txFees = block.transactions.reduce((acc, tx) => {
      return acc + BigInt(tx.gas) * BigInt(tx.gasPrice);
    }, BigInt(0));

    const totalReward = (BigInt(blockReward) + txFees).toString();

    res.json({
      ...block,
      nextBlockHash: nextBlock ? nextBlock.hash : null,
      totalReward: web3.utils.fromWei(totalReward, "ether"),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/transaction/:hash", async (req, res) => {
  try {
    const [tx, receipt, block] = await Promise.all([
      web3.eth.getTransaction(req.params.hash),
      web3.eth.getTransactionReceipt(req.params.hash),
      web3.eth.getBlock(receipt.blockNumber),
    ]);

    // Get contract creation code if it's a contract creation transaction
    let contractCode = null;
    if (!tx.to) {
      contractCode = await web3.eth.getCode(receipt.contractAddress);
    }

    res.json({
      ...tx,
      ...receipt,
      timestamp: block.timestamp,
      contractCreated: !tx.to ? receipt.contractAddress : null,
      contractCode: contractCode,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/address/:address", async (req, res) => {
  try {
    const address = req.params.address;
    const [balance, code, txCount, latestBlock] = await Promise.all([
      web3.eth.getBalance(address),
      web3.eth.getCode(address),
      web3.eth.getTransactionCount(address),
      web3.eth.getBlockNumber(),
    ]);

    // Get latest transactions for this address
    const transactions = [];
    for (let i = 0; i < 5; i++) {
      const block = await web3.eth.getBlock(latestBlock - i, true);
      if (block && block.transactions) {
        const addressTxs = block.transactions.filter(
          (tx) => tx.from === address || tx.to === address
        );
        transactions.push(...addressTxs);
      }
    }

    res.json({
      address,
      balance: web3.utils.fromWei(balance, "ether"),
      isContract: code !== "0x",
      contractCode: code !== "0x" ? code : null,
      transactionCount: txCount,
      latestTransactions: transactions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Token related endpoints
app.get("/api/tokens", async (req, res) => {
  try {
    // This would require indexing tokens from events
    // For now, return empty array or hardcoded tokens
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/token/:address", async (req, res) => {
  try {
    const tokenAddress = req.params.address;
    const minABI = [
      // balanceOf
      {
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        type: "function",
      },
      // decimals
      {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        type: "function",
      },
      // symbol
      {
        constant: true,
        inputs: [],
        name: "symbol",
        outputs: [{ name: "", type: "string" }],
        type: "function",
      },
    ];

    const contract = new web3.eth.Contract(minABI, tokenAddress);
    const [symbol, decimals] = await Promise.all([
      contract.methods.symbol().call(),
      contract.methods.decimals().call(),
    ]);

    res.json({
      address: tokenAddress,
      symbol,
      decimals,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
