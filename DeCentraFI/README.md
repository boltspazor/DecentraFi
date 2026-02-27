# DecentraFI

Decentralized crowdfunding platform with a React frontend, Express API, and Solidity contracts.

## Structure

- **frontend/** – React + Vite + wagmi (wallet connect)
- **backend/** – Express + MongoDB (campaign API)
- **blockchain/** – Hardhat + Campaign & CampaignFactory contracts

## Quick start

### 1. Blockchain (Hardhat)

```bash
cd blockchain
npm install
npm run compile
npm run node
# In another terminal:
npm run deploy
```

### 2. Backend

```bash
cd backend
npm install
# Set MONGODB_URI in .env if needed
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
# Set VITE_API_URL, VITE_CHAIN_ID, optional VITE_RPC_URL in .env
npm run dev
```

Open http://localhost:5173 and connect your wallet (use Hardhat network in MetaMask with chain ID 31337).

## Env files

- **frontend/.env** – `VITE_API_URL`, `VITE_CHAIN_ID`, `VITE_RPC_URL`
- **backend/.env** – `PORT`, `MONGODB_URI`
- **blockchain/.env** – optional `RPC_URL`, `PRIVATE_KEY` for deploy

## License

MIT
