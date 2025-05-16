// Utility functions
const shortenHash = (hash) =>
  `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
const formatTimestamp = (timestamp) => moment.unix(timestamp).fromNow();
const formatEther = (wei) => (parseInt(wei) / 1e18).toFixed(6);
const formatGwei = (wei) => (parseInt(wei) / 1e9).toFixed(2);
const formatHashrate = (hashrate) => {
  if (hashrate > 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`;
  if (hashrate > 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`;
  if (hashrate > 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`;
  if (hashrate > 1e3) return `${(hashrate / 1e3).toFixed(2)} KH/s`;
  return `${hashrate} H/s`;
};

// Copy to clipboard function
const copyToClipboard = (text) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  showToast("Copied to clipboard!");
};

// Toast notification
const showToast = (message) => {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
};

// DOM elements
const searchInput = document.getElementById("searchInput");
const latestBlockElement = document.getElementById("latestBlock");
const gasPriceElement = document.getElementById("gasPrice");
const peerCountElement = document.getElementById("peerCount");
const hashrateElement = document.getElementById("hashrate");
const latestBlocksContainer = document.getElementById("latestBlocks");
const latestTransactionsContainer =
  document.getElementById("latestTransactions");
const tokenListContainer = document.getElementById("tokenList");
const blockDetailsContainer = document.getElementById("blockDetails");
const transactionDetailsContainer =
  document.getElementById("transactionDetails");
const addressDetailsContainer = document.getElementById("addressDetails");
const tokenDetailsContainer = document.getElementById("tokenDetails");

// Add CSS for toast
const style = document.createElement("style");
style.textContent = `
.toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    z-index: 1000;
    opacity: 0;
    transition: all 0.3s ease;
}
.toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}
`;
document.head.appendChild(style);

// WebSocket connection
let ws;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("WebSocket connected");
    reconnectAttempts = 0;
    showToast("Connected to real-time updates");
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected");
    if (reconnectAttempts < maxReconnectAttempts) {
      setTimeout(() => {
        reconnectAttempts++;
        connectWebSocket();
      }, 3000);
    } else {
      showToast("Real-time updates disconnected. Please refresh the page.");
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    switch (message.type) {
      case "networkStats":
        updateNetworkStats(message.data);
        break;
      case "newBlock":
        handleNewBlock(message.data);
        break;
      case "newTransaction":
        handleNewTransaction(message.data);
        break;
      case "transactionConfirmed":
        updateTransaction(message.data);
        break;
    }
  };
}

// Update network stats with animation
function updateNetworkStats(stats) {
  animateCounter(latestBlockElement, stats.latestBlockNumber);
  animateValue(
    gasPriceElement,
    parseFloat(gasPriceElement.textContent),
    parseFloat(stats.gasPrice),
    "Gwei"
  );
  animateCounter(peerCountElement, stats.peerCount);
  hashrateElement.textContent = formatHashrate(stats.hashrate);

  // Add highlight effect
  const cards = document.querySelectorAll(".stat-card");
  cards.forEach((card) => {
    card.classList.add("highlight");
    setTimeout(() => card.classList.remove("highlight"), 1000);
  });
}

// Handle new block
function handleNewBlock(block) {
  // Create new block element
  const blockElement = document.createElement("div");
  blockElement.className = "block-item new-item";
  blockElement.onclick = () => showBlockDetails(block.number);
  blockElement.innerHTML = `
    <div>
      <strong><i class="fas fa-cube"></i> Block ${block.number}</strong>
      <div><i class="far fa-clock"></i> ${formatTimestamp(
        block.timestamp
      )}</div>
    </div>
    <div>
      <div><i class="fas fa-user-circle"></i> Miner: ${shortenHash(
        block.miner
      )}</div>
      <div><i class="fas fa-exchange-alt"></i> ${
        block.transactions.length
      } transactions</div>
    </div>
    <div>
      <div><i class="fas fa-gas-pump"></i> Gas Used: ${block.gasUsed}</div>
      <div><i class="fas fa-weight-hanging"></i> Size: ${block.size} bytes</div>
    </div>
  `;

  // Add to the beginning of the list
  const container = document.getElementById("latestBlocks");
  container.insertBefore(blockElement, container.firstChild);

  // Remove the last block if there are more than 10
  if (container.children.length > 10) {
    container.removeChild(container.lastChild);
  }

  // Trigger animation
  setTimeout(() => blockElement.classList.remove("new-item"), 100);
}

// Handle new transaction
function handleNewTransaction(tx) {
  if (
    !document.getElementById("transactions-tab").classList.contains("active")
  ) {
    return;
  }

  const txElement = document.createElement("div");
  txElement.className = "transaction-item new-item";
  txElement.setAttribute("data-tx-hash", tx.hash);
  txElement.onclick = () => showTransactionDetails(tx.hash);
  txElement.innerHTML = `
    <div>
      <strong><i class="fas fa-exchange-alt"></i> Tx: ${shortenHash(
        tx.hash
      )}</strong>
      <div><i class="far fa-clock"></i> ${
        tx.timestamp ? formatTimestamp(tx.timestamp) : "Just now"
      }</div>
    </div>
    <div>
      <div><i class="fas fa-arrow-circle-right"></i> From: ${shortenHash(
        tx.from
      )}</div>
      <div><i class="fas fa-arrow-circle-left"></i> To: ${
        tx.to
          ? shortenHash(tx.to)
          : '<span class="badge badge-info">Contract Creation</span>'
      }</div>
    </div>
    <div>
      <div><i class="fas fa-coins"></i> Value: ${formatEther(
        tx.value
      )} ETH</div>
      <div class="tx-status">
        ${
          tx.status === "pending"
            ? '<span class="badge badge-warning"><i class="fas fa-clock"></i> Pending</span>'
            : tx.status === "success"
            ? '<span class="badge badge-success"><i class="fas fa-check"></i> Success</span>'
            : '<span class="badge badge-danger"><i class="fas fa-times"></i> Failed</span>'
        }
      </div>
      <div class="tx-block">
        ${
          tx.blockNumber
            ? `<i class="fas fa-cube"></i> Block: ${tx.blockNumber}`
            : ""
        }
      </div>
    </div>
  `;

  const container = document.getElementById("latestTransactions");
  container.insertBefore(txElement, container.firstChild);

  if (container.children.length > 10) {
    container.removeChild(container.lastChild);
  }

  requestAnimationFrame(() => {
    txElement.classList.add("show");
  });
}

// Animate value changes
function animateValue(element, start, end, unit) {
  const duration = 1000;
  const frames = 20;
  const step = (end - start) / frames;

  let current = start;
  const interval = setInterval(() => {
    current += step;
    if ((step > 0 && current >= end) || (step < 0 && current <= end)) {
      element.textContent = `${end} ${unit}`;
      clearInterval(interval);
    } else {
      element.textContent = `${current.toFixed(2)} ${unit}`;
    }
  }, duration / frames);
}

// Add CSS for animations
const animationStyle = document.createElement("style");
animationStyle.textContent = `
  .new-item {
    opacity: 0;
    transform: translateY(-20px);
    transition: all 0.3s ease;
  }
  
  .new-item.show {
    opacity: 1;
    transform: translateY(0);
  }
  
  .highlight {
    animation: highlight 1s ease;
  }
  
  @keyframes highlight {
    0% {
      background-color: rgba(92, 52, 162, 0.1);
    }
    100% {
      background-color: var(--card-background);
    }
  }
`;
document.head.appendChild(animationStyle);

// Fetch network stats
async function fetchNetworkStats() {
  try {
    const response = await fetch("/api/stats");
    const stats = await response.json();

    // Animate the number change with countUp.js
    animateCounter(latestBlockElement, stats.latestBlockNumber);
    gasPriceElement.textContent = `${stats.gasPrice} Gwei`;
    peerCountElement.textContent = stats.peerCount;
    hashrateElement.textContent = formatHashrate(stats.hashrate);
  } catch (error) {
    console.error("Error fetching network stats:", error);
  }
}

// Simple number animation
function animateCounter(element, newValue) {
  const currentValue = parseInt(element.textContent) || 0;
  if (isNaN(currentValue) || currentValue === newValue) {
    element.textContent = newValue;
    return;
  }

  const diff = newValue - currentValue;
  const duration = 1000; // ms
  const frames = 20;
  const step = diff / frames;

  let current = currentValue;
  const interval = setInterval(() => {
    current += step;
    if (
      (step > 0 && current >= newValue) ||
      (step < 0 && current <= newValue)
    ) {
      element.textContent = newValue;
      clearInterval(interval);
    } else {
      element.textContent = Math.round(current);
    }
  }, duration / frames);
}

// Fetch and display latest blocks
async function fetchLatestBlocks() {
  try {
    const response = await fetch("/api/blocks/latest");
    const blocks = await response.json();

    latestBlocksContainer.innerHTML = blocks
      .map(
        (block) => `
            <div class="block-item" onclick="showBlockDetails(${block.number})">
                <div>
                    <strong><i class="fas fa-cube"></i> Block ${
                      block.number
                    }</strong>
                    <div><i class="far fa-clock"></i> ${formatTimestamp(
                      block.timestamp
                    )}</div>
                </div>
                <div>
                    <div><i class="fas fa-user-circle"></i> Miner: ${shortenHash(
                      block.miner
                    )}</div>
                    <div><i class="fas fa-exchange-alt"></i> ${
                      block.transactions.length
                    } transactions</div>
                </div>
                <div>
                    <div><i class="fas fa-gas-pump"></i> Gas Used: ${
                      block.gasUsed
                    }</div>
                    <div><i class="fas fa-weight-hanging"></i> Size: ${
                      block.size
                    } bytes</div>
                </div>
            </div>
        `
      )
      .join("");
  } catch (error) {
    console.error("Error fetching latest blocks:", error);
  }
}

// Fetch and display latest transactions
async function fetchLatestTransactions() {
  try {
    const response = await fetch("/api/blocks/latest");
    const blocks = await response.json();

    // Flatten all transactions from latest blocks
    const transactions = blocks
      .reduce((acc, block) => {
        return acc.concat(
          block.transactions.map((tx) => ({
            ...tx,
            blockNumber: block.number,
            timestamp: block.timestamp,
          }))
        );
      }, [])
      .slice(0, 10); // Get first 10 transactions

    latestTransactionsContainer.innerHTML = transactions
      .map(
        (tx) => `
      <div class="transaction-item" onclick="showTransactionDetails('${
        tx.hash
      }')">
        <div>
          <strong><i class="fas fa-exchange-alt"></i> Tx: ${shortenHash(
            tx.hash
          )}</strong>
          <div><i class="far fa-clock"></i> ${formatTimestamp(
            tx.timestamp
          )}</div>
        </div>
        <div>
          <div><i class="fas fa-arrow-circle-right"></i> From: ${shortenHash(
            tx.from
          )}</div>
          <div><i class="fas fa-arrow-circle-left"></i> To: ${
            tx.to
              ? shortenHash(tx.to)
              : '<span class="badge badge-info">Contract Creation</span>'
          }</div>
        </div>
        <div>
          <div><i class="fas fa-coins"></i> Value: ${formatEther(
            tx.value
          )} ETH</div>
          <div><i class="fas fa-cube"></i> Block: ${tx.blockNumber}</div>
        </div>
      </div>
    `
      )
      .join("");
  } catch (error) {
    console.error("Error fetching latest transactions:", error);
  }
}

// Show block details
async function showBlockDetails(blockNumber) {
  try {
    // Show loading state
    hideAllDetails();
    blockDetailsContainer.style.display = "block";
    blockDetailsContainer.querySelector(".details-content").innerHTML = `
      <div class="loading">
        <i class="fas fa-spinner fa-spin"></i> Loading block data...
      </div>
    `;

    const response = await fetch(`/api/block/${blockNumber}`);
    const block = await response.json();

    blockDetailsContainer.querySelector(".details-content").innerHTML = `
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-hashtag"></i> Block Number</div>
        <div class="detail-value hash-value">
          ${block.number}
          <button class="copy-btn" onclick="copyToClipboard('${
            block.number
          }')"><i class="far fa-copy"></i></button>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="far fa-clock"></i> Timestamp</div>
        <div class="detail-value">
          ${formatTimestamp(block.timestamp)} (${new Date(
      block.timestamp * 1000
    ).toLocaleString()})
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-exchange-alt"></i> Transactions</div>
        <div class="detail-value">${block.transactions.length}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-user-circle"></i> Mined by</div>
        <div class="detail-value hash-value">
          ${block.miner}
          <button class="copy-btn" onclick="copyToClipboard('${
            block.miner
          }')"><i class="far fa-copy"></i></button>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-award"></i> Block Reward</div>
        <div class="detail-value">${block.totalReward} ETH</div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-gas-pump"></i> Gas Used</div>
        <div class="detail-value">${block.gasUsed} (${(
      (block.gasUsed / block.gasLimit) *
      100
    ).toFixed(2)}%)</div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-gas-pump"></i> Gas Limit</div>
        <div class="detail-value">${block.gasLimit}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-hashtag"></i> Hash</div>
        <div class="detail-value hash-value">
          ${block.hash}
          <button class="copy-btn" onclick="copyToClipboard('${
            block.hash
          }')"><i class="far fa-copy"></i></button>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-long-arrow-alt-up"></i> Parent Hash</div>
        <div class="detail-value hash-value">
          ${block.parentHash}
          <button class="copy-btn" onclick="copyToClipboard('${
            block.parentHash
          }')"><i class="far fa-copy"></i></button>
        </div>
      </div>
    `;

    // Display block transactions
    const transactionsList =
      blockDetailsContainer.querySelector(".transactions-list");

    if (block.transactions.length === 0) {
      transactionsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-info-circle"></i> No transactions in this block
        </div>
      `;
    } else {
      transactionsList.innerHTML = block.transactions
        .map(
          (tx) => `
        <div class="transaction-item" onclick="showTransactionDetails('${
          tx.hash
        }')">
          <div>
            <i class="fas fa-exchange-alt"></i> ${shortenHash(tx.hash)}
            <button class="copy-btn" onclick="event.stopPropagation(); copyToClipboard('${
              tx.hash
            }')">
              <i class="far fa-copy"></i>
            </button>
          </div>
          <div>
            From: ${shortenHash(tx.from)} 
            <i class="fas fa-arrow-right"></i> 
            To: ${
              tx.to
                ? shortenHash(tx.to)
                : '<span class="badge badge-info">Contract Creation</span>'
            }
          </div>
          <div>
            <span class="badge badge-success">
              <i class="fas fa-coins"></i> ${formatEther(tx.value)} ETH
            </span>
          </div>
        </div>
      `
        )
        .join("");
    }
  } catch (error) {
    console.error("Error fetching block details:", error);
    blockDetailsContainer.querySelector(".details-content").innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i> Error loading block data: ${error.message}
      </div>
    `;
  }
}

// Show transaction details
async function showTransactionDetails(txHash) {
  try {
    // Show loading state
    hideAllDetails();
    transactionDetailsContainer.style.display = "block";
    transactionDetailsContainer.querySelector(".details-content").innerHTML = `
      <div class="loading">
        <i class="fas fa-spinner fa-spin"></i> Loading transaction data...
      </div>
    `;

    const response = await fetch(`/api/transaction/${txHash}`);
    const tx = await response.json();

    transactionDetailsContainer.querySelector(".details-content").innerHTML = `
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-hashtag"></i> Transaction Hash</div>
        <div class="detail-value hash-value">
          ${tx.hash}
          <button class="copy-btn" onclick="copyToClipboard('${
            tx.hash
          }')"><i class="far fa-copy"></i></button>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-cube"></i> Block</div>
        <div class="detail-value">
          <a href="javascript:void(0)" onclick="showBlockDetails(${
            tx.blockNumber
          })">
            ${tx.blockNumber}
          </a>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="far fa-clock"></i> Timestamp</div>
        <div class="detail-value">
          ${formatTimestamp(tx.timestamp)} (${new Date(
      tx.timestamp * 1000
    ).toLocaleString()})
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-user-circle"></i> From</div>
        <div class="detail-value hash-value">
          <a href="javascript:void(0)" onclick="showAddressDetails('${
            tx.from
          }')">
            ${tx.from}
          </a>
          <button class="copy-btn" onclick="copyToClipboard('${
            tx.from
          }')"><i class="far fa-copy"></i></button>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-user-circle"></i> To</div>
        <div class="detail-value hash-value">
          ${
            tx.to
              ? `<a href="javascript:void(0)" onclick="showAddressDetails('${tx.to}')">${tx.to}</a>
            <button class="copy-btn" onclick="copyToClipboard('${tx.to}')"><i class="far fa-copy"></i></button>`
              : '<span class="badge badge-info">Contract Creation</span>'
          }
        </div>
      </div>
      ${
        tx.contractCreated
          ? `
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-file-contract"></i> Contract Created</div>
        <div class="detail-value hash-value">
          <a href="javascript:void(0)" onclick="showAddressDetails('${tx.contractCreated}')">
            ${tx.contractCreated}
          </a>
          <button class="copy-btn" onclick="copyToClipboard('${tx.contractCreated}')">
            <i class="far fa-copy"></i>
          </button>
        </div>
      </div>
      `
          : ""
      }
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-coins"></i> Value</div>
        <div class="detail-value">${formatEther(tx.value)} ETH</div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-gas-pump"></i> Gas Price</div>
        <div class="detail-value">${formatGwei(tx.gasPrice)} Gwei</div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-gas-pump"></i> Gas Used</div>
        <div class="detail-value">${tx.gasUsed}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-info-circle"></i> Status</div>
        <div class="detail-value">
          <span class="status-indicator ${
            tx.status ? "status-success" : "status-failed"
          }"></span>
          ${
            tx.status
              ? '<span class="badge badge-success">Success</span>'
              : '<span class="badge badge-danger">Failed</span>'
          }
        </div>
      </div>
    `;

    // Display transaction logs if any
    const logsList = transactionDetailsContainer.querySelector(".logs-list");
    if (!tx.logs || tx.logs.length === 0) {
      logsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-info-circle"></i> No event logs for this transaction
        </div>
      `;
    } else {
      logsList.innerHTML = tx.logs
        .map(
          (log, index) => `
        <div class="log-item">
          <div class="log-header">
            <span class="badge badge-info">Log #${index}</span>
            <span>Address: ${shortenHash(log.address)}</span>
          </div>
          <div class="log-topics">
            <strong>Topics:</strong>
            <div>${log.topics
              .map((topic) => `<div>${topic}</div>`)
              .join("")}</div>
          </div>
          <div class="log-data">
            <strong>Data:</strong>
            <div>${log.data}</div>
          </div>
        </div>
      `
        )
        .join("");
    }
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    transactionDetailsContainer.querySelector(".details-content").innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i> Error loading transaction data: ${error.message}
      </div>
    `;
  }
}

// Show address details
async function showAddressDetails(address) {
  try {
    // Show loading state
    hideAllDetails();
    addressDetailsContainer.style.display = "block";
    addressDetailsContainer.querySelector(".details-content").innerHTML = `
      <div class="loading">
        <i class="fas fa-spinner fa-spin"></i> Loading address data...
      </div>
    `;

    const response = await fetch(`/api/address/${address}`);
    const addressInfo = await response.json();

    // Show/hide contract code tab
    document.getElementById("contractCodeTab").style.display =
      addressInfo.isContract ? "block" : "none";

    addressDetailsContainer.querySelector(".details-content").innerHTML = `
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-user-circle"></i> Address</div>
        <div class="detail-value hash-value">
          ${addressInfo.address}
          <button class="copy-btn" onclick="copyToClipboard('${
            addressInfo.address
          }')">
            <i class="far fa-copy"></i>
          </button>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-coins"></i> Balance</div>
        <div class="detail-value">${addressInfo.balance} ETH</div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-exchange-alt"></i> Transaction Count</div>
        <div class="detail-value">${addressInfo.transactionCount}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-info-circle"></i> Type</div>
        <div class="detail-value">
          ${
            addressInfo.isContract
              ? '<span class="badge badge-info">Contract</span>'
              : '<span class="badge badge-success">EOA</span>'
          }
        </div>
      </div>
    `;

    // Display latest transactions
    const transactionsTab = document.getElementById("address-transactions");
    if (
      !addressInfo.latestTransactions ||
      addressInfo.latestTransactions.length === 0
    ) {
      transactionsTab.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-info-circle"></i> No transactions found for this address
        </div>
      `;
    } else {
      transactionsTab.innerHTML = addressInfo.latestTransactions
        .map(
          (tx) => `
        <div class="transaction-item" onclick="showTransactionDetails('${
          tx.hash
        }')">
          <div>
            <strong><i class="fas fa-exchange-alt"></i> Tx: ${shortenHash(
              tx.hash
            )}</strong>
            <button class="copy-btn" onclick="event.stopPropagation(); copyToClipboard('${
              tx.hash
            }')">
              <i class="far fa-copy"></i>
            </button>
          </div>
          <div>
            ${
              tx.from.toLowerCase() === address.toLowerCase()
                ? `<span class="badge badge-warning">OUT</span>
              <i class="fas fa-arrow-right"></i> To: ${shortenHash(tx.to)}`
                : `<span class="badge badge-success">IN</span>
              <i class="fas fa-arrow-left"></i> From: ${shortenHash(tx.from)}`
            }
          </div>
          <div>
            <span class="badge badge-info">
              <i class="fas fa-coins"></i> ${formatEther(tx.value)} ETH
            </span>
          </div>
        </div>
      `
        )
        .join("");
    }

    // If it's a contract, show the code
    if (addressInfo.isContract && addressInfo.contractCode) {
      document.getElementById("contractCode").textContent =
        addressInfo.contractCode;
    }
  } catch (error) {
    console.error("Error fetching address details:", error);
    addressDetailsContainer.querySelector(".details-content").innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i> Error loading address data: ${error.message}
      </div>
    `;
  }
}

// Show token details
async function showTokenDetails(tokenAddress) {
  try {
    // Show loading state
    hideAllDetails();
    tokenDetailsContainer.style.display = "block";
    tokenDetailsContainer.querySelector(".details-content").innerHTML = `
      <div class="loading">
        <i class="fas fa-spinner fa-spin"></i> Loading token data...
      </div>
    `;

    const response = await fetch(`/api/token/${tokenAddress}`);
    const tokenInfo = await response.json();

    tokenDetailsContainer.querySelector(".details-content").innerHTML = `
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-coins"></i> Token Address</div>
        <div class="detail-value hash-value">
          ${tokenInfo.address}
          <button class="copy-btn" onclick="copyToClipboard('${tokenInfo.address}')">
            <i class="far fa-copy"></i>
          </button>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-tag"></i> Symbol</div>
        <div class="detail-value">${tokenInfo.symbol}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label"><i class="fas fa-calculator"></i> Decimals</div>
        <div class="detail-value">${tokenInfo.decimals}</div>
      </div>
    `;
  } catch (error) {
    console.error("Error fetching token details:", error);
    tokenDetailsContainer.querySelector(".details-content").innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i> Error loading token data: ${error.message}
      </div>
    `;
  }
}

// Additional styling
const additionalStyle = document.createElement("style");
additionalStyle.textContent = `
.loading, .error-state, .empty-state {
    padding: 20px;
    text-align: center;
    border-radius: 8px;
    margin: 20px 0;
}

.loading {
    background-color: rgba(92, 52, 162, 0.05);
    color: var(--primary-color);
}

.error-state {
    background-color: rgba(220, 53, 69, 0.1);
    color: var(--danger-color);
}

.empty-state {
    background-color: rgba(23, 162, 184, 0.1);
    color: var(--info-color);
    padding: 30px;
}

.loading i, .error-state i, .empty-state i {
    margin-right: 10px;
}

.log-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
}

.log-topics, .log-data {
    margin-top: 10px;
}

.log-topics div, .log-data div {
    font-size: 12px;
    word-break: break-all;
    margin-top: 5px;
}
`;
document.head.appendChild(additionalStyle);

// Tab functionality
function showTab(tabName) {
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));

  document.getElementById(`${tabName}-tab`).classList.add("active");
  document.querySelectorAll(`.tab-btn`).forEach((btn) => {
    if (btn.textContent.trim().toLowerCase() === tabName) {
      btn.classList.add("active");
    }
  });

  // Load tab-specific data
  if (
    tabName === "transactions" &&
    !latestTransactionsContainer.innerHTML.trim()
  ) {
    fetchLatestTransactions();
  }
}

function showAddressTab(tabName) {
  document
    .querySelectorAll(".address-tab")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));

  document.getElementById(`address-${tabName}`).classList.add("active");
  event.target.classList.add("active");
}

function showTokenTab(tabName) {
  document
    .querySelectorAll(".token-tab")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));

  document.getElementById(`token-${tabName}`).classList.add("active");
  event.target.classList.add("active");
}

// Hide all detail containers
function hideAllDetails() {
  blockDetailsContainer.style.display = "none";
  transactionDetailsContainer.style.display = "none";
  addressDetailsContainer.style.display = "none";
  tokenDetailsContainer.style.display = "none";
}

// Search functionality with autofocus
searchInput.addEventListener("focus", () => {
  searchInput.setAttribute(
    "placeholder",
    "Search by Block / Tx / Address / Token..."
  );
});

searchInput.addEventListener("blur", () => {
  searchInput.setAttribute(
    "placeholder",
    "Search by Block / Tx Hash / Address / Token"
  );
});

searchInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") {
    search();
  }
});

function search() {
  const query = searchInput.value.trim();

  if (!query) return;

  if (/^\d+$/.test(query)) {
    // Search for block number
    showBlockDetails(parseInt(query));
  } else if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
    // Search for transaction hash
    showTransactionDetails(query);
  } else if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
    // Search for address or token
    showAddressDetails(query);
  } else {
    showToast(
      "Invalid search query. Please enter a valid block number, transaction hash, or address."
    );
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Initial data load
  fetchNetworkStats();
  fetchLatestBlocks();

  // Connect WebSocket
  connectWebSocket();

  // Set active tab based on URL hash or default to blocks
  const hash = window.location.hash.substring(1);
  if (hash && ["blocks", "transactions", "tokens"].includes(hash)) {
    showTab(hash);
  } else {
    showTab("blocks");
  }
});

// Update existing transaction
function updateTransaction(tx) {
  if (
    !document.getElementById("transactions-tab").classList.contains("active")
  ) {
    return;
  }

  // Find existing transaction element
  const txElement = document.querySelector(`[data-tx-hash="${tx.hash}"]`);
  if (!txElement) return;

  // Update status and block info
  const statusDiv = txElement.querySelector(".tx-status");
  if (statusDiv) {
    statusDiv.innerHTML =
      tx.status === "success"
        ? '<span class="badge badge-success"><i class="fas fa-check"></i> Success</span>'
        : '<span class="badge badge-danger"><i class="fas fa-times"></i> Failed</span>';
  }

  // Update block number
  const blockDiv = txElement.querySelector(".tx-block");
  if (blockDiv) {
    blockDiv.innerHTML = `<i class="fas fa-cube"></i> Block: ${tx.blockNumber}`;
  }

  // Add confirmation animation
  txElement.classList.add("confirmed");
  setTimeout(() => txElement.classList.remove("confirmed"), 1000);
}

// Add CSS for transaction animations
const txAnimationStyle = document.createElement("style");
txAnimationStyle.textContent = `
  .transaction-item.confirmed {
    animation: confirm-pulse 1s ease;
  }
  
  @keyframes confirm-pulse {
    0% {
      background-color: rgba(40, 167, 69, 0.2);
    }
    100% {
      background-color: var(--card-background);
    }
  }
  
  .badge {
    padding: 5px 10px;
    border-radius: 12px;
    font-size: 0.85em;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  
  .badge i {
    font-size: 0.9em;
  }
  
  .badge-success {
    background-color: rgba(40, 167, 69, 0.1);
    color: var(--success-color);
  }
  
  .badge-warning {
    background-color: rgba(255, 193, 7, 0.1);
    color: var(--warning-color);
  }
  
  .badge-danger {
    background-color: rgba(220, 53, 69, 0.1);
    color: var(--danger-color);
  }
  
  .badge-info {
    background-color: rgba(23, 162, 184, 0.1);
    color: var(--info-color);
  }
`;
document.head.appendChild(txAnimationStyle);
