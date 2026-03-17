# DecentraFI – Railway deployment

Deploy **backend** (and optionally **frontend**) on [Railway](https://railway.app). The **blockchain** (Solidity contracts) are deployed to a chain like Sepolia; you only need to set the contract address and RPC URLs in the frontend env.

---

## 1. Backend on Railway

### 1.1 Create project and add Postgres

1. In [Railway](https://railway.app), create a new project.
2. Click **+ New** → **Database** → **PostgreSQL**. Railway will create a DB and set `DATABASE_URL` for you.
3. Click **+ New** → **GitHub Repo** and select your repo (or deploy from CLI).

### 1.2 Configure the backend service

1. Set **Root Directory** to `decentrafi/backend` (if your repo root is the monorepo).
2. **Build command:** `npm ci && npm run build`
3. **Start command:** `npm run start` (or leave empty; `Procfile` / Nixpacks will use it).
4. **Variables** (in Railway dashboard or from Postgres “Connect”):
   - `DATABASE_URL` – auto-set when you add Postgres and link the service (or copy from Postgres “Variables”).
   - `FRONTEND_URL` – your deployed frontend URL, e.g. `https://your-app.railway.app` (for CORS). Comma-separated if you have several.
   - `PORT` – set automatically by Railway.
   - Optional: `NODE_ENV=production`, `DATABASE_MAX_CONNECTIONS=5` (recommended on free tier).

### 1.3 Health checks

- **Liveness:** `GET https://your-backend.railway.app/health` → 200 OK.
- **Readiness (DB):** `GET https://your-backend.railway.app/api/health` → 200 if DB is connected, 503 otherwise.

Use `/health` or `/api/health` in Railway’s health check configuration if available.

### 1.4 Deploy

Push to your connected branch or run `railway up` from `decentrafi/backend`. After deploy, open the generated URL and test:

```bash
curl https://your-backend.railway.app/health
curl https://your-backend.railway.app/api/health
```

---

## 2. Frontend on Railway (optional)

The frontend is a static Vite app. You can host it on Railway or on Vercel/Netlify.

### 2.1 Build-time environment variables

Set these in Railway (or in your CI) **before** building. They are baked into the bundle:

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL, e.g. `https://your-backend.railway.app` |
| `VITE_RPC_URL` | RPC for chain (e.g. Sepolia): `https://rpc.sepolia.org` |
| `VITE_CHAIN_ID` | e.g. `11155111` for Sepolia |
| `VITE_CAMPAIGN_FACTORY_ADDRESS` | Deployed factory contract address |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional; from [WalletConnect Cloud](https://cloud.walletconnect.com) |
| `VITE_POLYGON_RPC_URL` / `VITE_ARBITRUM_RPC_URL` | Optional, for multi-chain |

### 2.2 Deploy frontend on Railway

1. **+ New** → **GitHub Repo** (or same repo, new service).
2. **Root Directory:** `decentrafi/frontend`.
3. **Build command:** `npm ci && npm run build`  
   Ensure `VITE_API_URL` (and others above) are set in this service’s variables so the build picks them up.
4. **Start command:** `npm run start` (serves `dist` on `PORT`).
5. Railway sets `PORT`; the app uses it automatically.

After deploy, set your backend’s `FRONTEND_URL` to this frontend URL so CORS works.

---

## 3. Blockchain (contracts)

Contracts (e.g. in `blockchain/contracts/`) are **not** hosted on Railway. You:

1. Deploy them to a chain (e.g. Sepolia) using Hardhat/Foundry.
2. Set in the **frontend** env:
   - `VITE_CAMPAIGN_FACTORY_ADDRESS` = deployed factory address.
   - `VITE_RPC_URL` and `VITE_CHAIN_ID` for that chain.

The frontend and backend then work with your deployed contracts and DB on Railway.

---

## 4. Checklist

- [ ] Postgres added and `DATABASE_URL` set (or linked) for backend.
- [ ] Backend `FRONTEND_URL` set to the real frontend URL (for CORS).
- [ ] Backend listens on `0.0.0.0` and uses `PORT` (already configured).
- [ ] Frontend built with `VITE_API_URL` pointing at the deployed backend.
- [ ] Contract addresses and RPC URLs set in frontend env and redeployed after any change.
