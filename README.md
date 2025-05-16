# Geth Private Network Explorer

A blockchain explorer for your private Geth network. This explorer allows you to:
- View latest blocks and their details
- Search for specific blocks, transactions, and addresses
- Monitor gas prices and network activity
- View transaction details and status
- Check address balances and transaction counts

## Prerequisites

- Node.js (v14 or higher)
- A running Geth private network node
- npm or yarn package manager

## Setup

1. Clone this repository:
```bash
git clone <repository-url>
cd geth-explorer
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
PORT=3000
GETH_NODE_URL=http://localhost:8545
```

4. Make sure your Geth node is running with RPC enabled. The default RPC endpoint is `http://localhost:8545`.

## Running the Explorer

1. Start the explorer:
```bash
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

## Features

- **Real-time Updates**: The explorer automatically refreshes block data every 15 seconds
- **Search Functionality**: Search for:
  - Block numbers
  - Transaction hashes
  - Addresses
- **Block Details**: View comprehensive information about each block
- **Transaction Details**: Examine transaction parameters and status
- **Address Information**: Check account balances and transaction counts

## API Endpoints

- `/api/blocks/latest` - Get the latest blocks
- `/api/block/:number` - Get details of a specific block
- `/api/transaction/:hash` - Get transaction details
- `/api/address/:address` - Get address details and balance

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License 