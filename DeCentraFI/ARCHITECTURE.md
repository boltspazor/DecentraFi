# DecentraFI – Architecture & Flow

DecentraFI is a **decentralized crowdfunding** dApp on **Sepolia testnet**. It has three layers: **blockchain** (smart contracts), **backend** (API + DB), and **frontend** (React + wallet). Campaigns and funds live on-chain; the backend stores metadata and contribution records for discovery and UI.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
│  Vite + React + React Router + TanStack Query + Wagmi + Viem                │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │ Home        │  │ CreateCampaign│  │ CampaignDetail  │  │ Navbar        │  │
│  │ (list)      │  │ (form+tx)     │  │ (contribute/    │  │ WalletConnect │  │
│  │             │  │               │  │  withdraw/refund)│  │               │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  └───────┬───────┘  │
│         │                │                    │                    │          │
│         └────────────────┼────────────────────┼────────────────────┘        │
│                          │    services/api.ts  │  services/blockchain.ts       │
│                          │    services/campaignContract.ts                    │
└──────────────────────────┼────────────────────┼──────────────────────────────┘
                           │                    │
         HTTP (REST)       │                    │    RPC (Sepolia) + Wallet
                           ▼                    ▼
┌──────────────────────────┴────────────────────┴──────────────────────────────┐
│                           BACKEND (Node.js)                                    │
│  Express + CORS + pg (PostgreSQL)                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ app.ts: /api/campaigns, /api/contributions                               │  │
│  │ campaignController / contributionController                             │  │
│  │ campaignService / contributionService                                   │  │
│  │ campaignValidation / contributionValidation                             │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ config/db.ts: PostgreSQL pool                                           │  │
│  │ Tables: campaigns (id, title, description, goal, deadline, creator,     │  │
│  │         campaign_address, tx_hash, total_raised, status, created_at)    │  │
│  │         contributions (id, campaign_id, contributor_address,           │  │
│  │         amount_wei, tx_hash, created_at)                                │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
                           │
         Backend does NOT hold keys; it only stores metadata and indexes
         that reference on-chain campaign addresses and tx hashes.
                           │
                           │  (Deployment & interaction via frontend wallet)
                           ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                        BLOCKCHAIN (Sepolia)                                    │
│  Hardhat + Solidity ^0.8.20                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ CampaignFactory.sol                                                     │  │
│  │   createCampaign(goal, deadline) → deploys Campaign, returns address    │  │
│  │   getCampaigns() → list of campaign addresses                           │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ Campaign.sol (per campaign)                                              │  │
│  │   Escrow: contribute() locks ETH until deadline                         │  │
│  │   After deadline: releaseFunds() (creator, goal met) or                  │  │
│  │                  finalizeAfterDeadline() → refundEnabled; claimRefund()  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Frontend** talks to the **backend** over HTTP (REST) and to **Sepolia** via Wagmi/Viem (wallet + RPC). It never sends private keys to the backend.
- **Backend** stores only **metadata** (title, description, goal, deadline, creator, `campaign_address`, `tx_hash`, `total_raised`, `status`) and **contribution records** (campaign_id, contributor, amount_wei, tx_hash). It does not hold funds or keys.
- **Blockchain** holds the real **campaign parameters** (goal, deadline) and **all ETH** in the Campaign contract until release or refund.

---

## 2. Directory Layout

```
decentrafi/
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── components/       # Navbar, WalletConnectButton, CampaignForm
│   │   ├── config/           # wagmiConfig (Sepolia, MetaMask, WalletConnect)
│   │   ├── pages/            # Home, CreateCampaign, CampaignDetail
│   │   ├── services/         # api.ts, blockchain.ts, campaignContract.ts
│   │   ├── abis/             # campaign.ts, campaignFactory.ts (ABIs for viem)
│   │   ├── utils/            # errorMessages.ts
│   │   ├── validation/       # campaignForm.ts
│   │   ├── App.tsx, main.tsx
│   │   └── index.css
│   ├── vite.config.ts
│   └── package.json          # React, Vite, Wagmi, Viem, TanStack Query, RTL, Vitest
│
├── backend/                  # Node.js API
│   ├── src/
│   │   ├── controllers/     # campaignController, contributionController
│   │   ├── routes/          # campaignRoutes, contributionRoutes
│   │   ├── services/         # campaignService, contributionService (DB access)
│   │   ├── validation/       # campaignValidation, contributionValidation
│   │   ├── config/          # db.ts (pg Pool + connectDb, table creation)
│   │   ├── app.ts            # Express app, CORS, JSON, mount routes
│   │   └── server.ts         # connectDb then listen
│   ├── __tests__/            # Jest: campaign.test, api.contributions.test, contributionValidation.test
│   └── package.json          # express, pg, cors, jest, supertest, tsx
│
└── blockchain/               # Hardhat project
    ├── contracts/
    │   ├── Campaign.sol      # Single campaign escrow logic
    │   └── CampaignFactory.sol
    ├── test/                 # Mocha/Chai: CampaignFactory.test, campaign.test
    ├── hardhat.config.ts
    └── package.json          # hardhat, ethers, @openzeppelin/contracts
```

---

## 3. Data Flow by Feature

### 3.1 Wallet & Network (Frontend Only)

- **Entry:** User clicks connect in `WalletConnectButton` (Navbar).
- **Config:** `wagmiConfig.ts` uses Sepolia, `injected` (MetaMask) and optionally WalletConnect.
- **Flow:** Wagmi `useAccount`, `useConnect`, `useDisconnect`, `useSwitchChain` drive connect/disconnect and “Switch to Sepolia.” No backend involved; RPC is used for reads/writes via Viem.

### 3.2 List Campaigns (Home)

1. **Frontend:** `Home.tsx` uses `useQuery` with `getCampaigns()` from `api.ts`.
2. **API:** `GET /api/campaigns` → `campaignController.getCampaigns` → `campaignService.findAll()`.
3. **Backend:** `SELECT * FROM campaigns ORDER BY created_at DESC`; each row is mapped with `formatCampaign()` to camelCase (e.g. `totalRaised`, `campaignAddress`, `createdAt`), dates as ISO.
4. **Frontend:** Renders list of `CampaignMeta` (title, description, goal, totalRaised, status, link to `/campaigns/:id`). Campaign list is **from the database**, not from the chain (chain only has factory’s list of addresses; backend adds metadata).

### 3.3 Create Campaign (Full Flow)

**Step 1 – User input (frontend)**

- Route: `/create` → `CreateCampaign.tsx`.
- User fills `CampaignForm`: title, description, goal (ETH), deadline (datetime). Form validates and outputs `goalWei` (string wei) and `deadline` (string).
- On submit, form data is stored in `sessionStorage` and `handleSubmit` is called.

**Step 2 – On-chain deployment (frontend → blockchain)**

- `useCampaignFactory()` from `blockchain.ts`: `createCampaign(goalWei, deadlineUnix)` calls `CampaignFactory.createCampaign(goal, deadline)` on Sepolia via wallet.
- User signs the transaction; frontend waits for receipt via `useWaitForTransactionReceipt`.
- `getCampaignAddressFromReceipt()` decodes the `CampaignCreated` event from the receipt to get the new Campaign contract address.

**Step 3 – Save metadata (frontend → backend)**

- After a successful tx, `CreateCampaign` reads form data from sessionStorage and calls `api.createCampaign({ title, description, goal: goalWei, deadline, creator: address, campaignAddress, txHash })`.
- **API:** `POST /api/campaigns` → `validateCreateCampaignBody` (title, description, goal wei string, future deadline, eth addresses, optional txHash) → `campaignService.create()`.
- **Backend:** Inserts into `campaigns` (goal/deadline/creator/campaign_address/tx_hash, etc.). Returns formatted campaign (camelCase, dates ISO).
- Frontend then redirects to Home and dispatches `campaigns-refresh` so the list refetches.

**Summary:** Chain = source of truth for **contract existence and escrow rules**; backend = source of truth for **metadata and listing**.

### 3.4 View Campaign Detail (CampaignDetail Page)

- Route: `/campaigns/:id` → `CampaignDetail.tsx` with `id` from URL.

**Metadata & contributions (frontend → backend)**

- `api.getCampaign(id)` → `GET /api/campaigns/:id` → campaign + `contributors` array (same shape as `GET /api/contributions/campaign/:id`). Frontend uses embedded `contributors` when present, else calls `getContributionsByCampaign(campaignId)`.
- Campaign display uses: title, description, goal, status, totalRaised from API; contributor list from `contributors` / ContributionMeta.

**On-chain state (frontend → blockchain)**

- `campaignMeta.campaignAddress` is used with `useCampaign(campaignAddress)` in `campaignContract.ts`: multiple `useReadContract` calls for `goal`, `deadline`, `totalContributed`, `totalRaised`, `closed`, `fundsReleased`, `refundEnabled`, `finalized`, `creator`, `contributions(userAddress)`.
- UI uses these for: progress bar (goal vs totalRaised/totalContributed), deadline countdown, “Withdraw funds” (creator, goal met, deadline passed), “Enable refunds” (finalize), “Claim refund” (refundEnabled, myContribution > 0).

So: **backend** = metadata + contribution list; **blockchain** = live escrow state and permissions.

### 3.5 Contribute (Donation Flow)

**Step 1 – User enters amount and submits (frontend)**

- On `CampaignDetail`, user enters ETH amount; `handleContribute` checks wallet, network, and that campaign is not closed/expired, then calls `contributeOnChain(valueWei)` from `useContribute(campaignAddress)`.

**Step 2 – On-chain contribution (frontend → blockchain)**

- `campaignContract.useContribute`: `writeContract({ address: campaignAddress, functionName: 'contribute', value: valueWei })`. User signs; ETH is sent to the Campaign contract and locked in escrow.
- Contract updates `contributions[msg.sender]`, `totalContributed`, `totalRaised`, and may set `closed = true` if goal is reached.

**Step 3 – Record contribution in backend (frontend → backend)**

- When `useWaitForTransactionReceipt` reports success, `CampaignDetail` calls `api.postContribution({ campaignId, contributorAddress, amountWei, txHash })`.
- **API:** `POST /api/contributions` → validate (campaignId, contributorAddress, amountWei, txHash) → check campaign exists, no duplicate txHash → `contributionService.create()` → `campaignService.updateTotalRaisedAndStatus(campaignId, newTotal, status)`.
- **Backend:** Inserts into `contributions`; updates `campaigns.total_raised` and optionally `status` to `"Successful"` if goal reached.
- Frontend refetches campaign and contributions (and chain state) so progress and list update.

**Summary:** Chain holds the ETH and per-user contribution; backend keeps a mirrored total and a list of contributions for the UI.

### 3.6 Withdraw Funds (Creator, Goal Met, After Deadline)

- Only on **CampaignDetail**, only if: connected address is creator, `closed`, not yet withdrawn, `fundsReleased` false, deadline passed.
- `useWithdraw(campaignAddress).releaseFunds()` → `Campaign.releaseFunds()` on chain. Contract checks creator, deadline, goal met, then sends full contract balance to creator and sets `fundsReleased = true`.
- No backend call required for the transfer; frontend may refetch campaign/chain state for UI.

### 3.7 Finalize & Refund (Goal Not Met, After Deadline)

- **Finalize:** Anyone can call `finalizeAfterDeadline()` on the Campaign contract after the deadline. Contract sets `finalized = true` and, if `totalRaised < goal`, sets `refundEnabled = true`.
- **Refund:** A contributor with `contributions[address] > 0` calls `claimRefund()`. Contract sends their contribution back and zeroes their entry.
- Frontend shows “Enable refunds” when finalize is needed and “Claim refund” when refundEnabled and myContribution > 0. No backend API for these actions; they are purely on-chain.

---

## 4. API Contract (Backend ↔ Frontend)

- **Base URL:** `VITE_API_URL` or `http://localhost:3001`.
- **Conventions:** JSON only; camelCase; numeric amounts in wei as **strings**; dates as **ISO 8601** (backend uses `res.json()` so Date becomes ISO).

| Method | Path | Request body | Response |
|--------|------|--------------|----------|
| POST | /api/campaigns | title, description, goal (wei string), deadline (string), creator, campaignAddress, txHash? | CampaignMeta (id, title, …, totalRaised, status, createdAt) |
| GET | /api/campaigns | — | CampaignMeta[] |
| GET | /api/campaigns/:id | — | CampaignMeta + contributors?: ContributionMeta[] |
| PATCH | /api/campaigns/:id/status | { status: "Active" \| "Successful" \| "Failed" } | CampaignMeta |
| POST | /api/contributions | campaignId, contributorAddress, amountWei, txHash | ContributionMeta (id, campaignId, …, createdAt) |
| GET | /api/contributions/campaign/:id | — | ContributionMeta[] |

`CampaignMeta`: id, title, description, goal, deadline, creator, campaignAddress, txHash, totalRaised?, status?, createdAt.  
`ContributionMeta`: id, campaignId, contributorAddress, amountWei, txHash, createdAt.

---

## 5. Blockchain Contract Summary

**CampaignFactory**

- `createCampaign(uint256 _goal, uint256 _deadline)` → deploys `Campaign(msg.sender, _goal, _deadline)`, pushes to `campaigns[]`, emits `CampaignCreated`, returns campaign address.
- `getCampaigns()` → returns array of campaign addresses.

**Campaign (per campaign)**

- **State:** creator, goal, deadline, totalContributed, totalRaised, closed, fundsWithdrawn, fundsReleased, refundEnabled, finalized, contributions(address → wei).
- **contribute()** payable: requires value > 0, block.timestamp < deadline, !closed; updates contributions, totalContributed, totalRaised; sets closed if goal met; emits ContributionReceived.
- **releaseFunds():** only creator; after deadline; goal met; not already released; sends full balance to creator, sets fundsReleased.
- **finalizeAfterDeadline():** callable once after deadline; sets finalized; if totalRaised < goal sets refundEnabled.
- **claimRefund():** requires refundEnabled; sends contributions[msg.sender] back, zeroes it; ReentrancyGuard protects all value transfers.

Frontend uses **Viem** + **Wagmi** with ABIs in `frontend/src/abis/`; contract addresses come from env (`VITE_CAMPAIGN_FACTORY_ADDRESS`) and from the factory’s `CampaignCreated` event for each new campaign.

---

## 6. Environment & Run Order

- **Blockchain:** Deploy factory (and optionally campaigns) on Sepolia; note factory address.
- **Backend:** Set `DATABASE_URL` (PostgreSQL). On startup, `connectDb()` creates tables if missing. Listen on `PORT` (default 3001).
- **Frontend:** Set `VITE_API_URL` (backend), `VITE_CAMPAIGN_FACTORY_ADDRESS`, optional `VITE_RPC_URL`, optional `VITE_WALLETCONNECT_PROJECT_ID`.

Typical order: start PostgreSQL → start backend → run frontend dev server → connect wallet (Sepolia) and use the app.

---

## 7. Security Notes

- Private keys stay in the user’s wallet; backend never sees them.
- Backend validates all inputs (campaign and contribution validation); contribution creation checks campaign exists and txHash is unique.
- Escrow and access control (creator, deadline, goal, refundEnabled) are enforced in the Campaign contract; backend only stores metadata and contribution records that mirror on-chain data.

This is the current flow and architecture of the DecentraFI project end to end.
