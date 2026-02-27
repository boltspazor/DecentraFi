# DecentraFI

Decentralized crowdfunding platform (Web3) with wallet-based auth and on-chain campaign creation.

## Stack

- **frontend/** – React + TypeScript + Vite + Tailwind + wagmi (MetaMask / WalletConnect), Sepolia only
- **backend/** – Node.js + Express + TypeScript + PostgreSQL (metadata only; no private keys)
- **blockchain/** – Solidity 0.8.x + Hardhat + OpenZeppelin, deployable to Sepolia

## Flow

1. User connects wallet (MetaMask or WalletConnect); session persists across reloads; Sepolia is enforced.
2. User fills campaign form (title, goal in ETH, deadline, description) and submits.
3. Frontend calls `CampaignFactory.createCampaign(goalWei, deadline)`; user signs the tx.
4. Contract deploys a new `Campaign`, emits `CampaignCreated`, returns tx hash.
5. Frontend reads campaign address from the event, then POSTs metadata to the backend API.
6. Backend stores metadata (title, description, goal, deadline, creator, campaignAddress, txHash) in PostgreSQL.
7. Home page lists campaigns from the API; new campaign appears after create.

## Quick start

### 1. Blockchain (Sepolia)

```bash
cd blockchain
npm install
npm run compile
# Deploy to Sepolia (set PRIVATE_KEY and optional SEPOLIA_RPC_URL in .env)
npm run deploy:sepolia
# Save the printed CampaignFactory address into frontend .env as VITE_CAMPAIGN_FACTORY_ADDRESS
```

### 2. Backend

```bash
cd backend
npm install
# Create DB: createdb decentrafi  (or set DATABASE_URL in .env)
cp .env.example .env   # set PORT, DATABASE_URL
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL, VITE_CAMPAIGN_FACTORY_ADDRESS; optional VITE_WALLETCONNECT_PROJECT_ID
npm run dev
```

Open http://localhost:5173 → connect wallet (Sepolia) → create campaign.

## Env files

- **frontend/.env** – `VITE_API_URL`, `VITE_CHAIN_ID` (11155111), `VITE_CAMPAIGN_FACTORY_ADDRESS`, optional `VITE_RPC_URL`, `VITE_WALLETCONNECT_PROJECT_ID`
- **backend/.env** – `PORT`, `DATABASE_URL` (PostgreSQL)
- **blockchain/.env** – `PRIVATE_KEY` (for deploy), optional `SEPOLIA_RPC_URL`

## License

MIT
