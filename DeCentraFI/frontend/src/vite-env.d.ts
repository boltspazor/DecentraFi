/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_CAMPAIGN_FACTORY_ADDRESS?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_POLYGON_RPC_URL?: string;
  readonly VITE_ARBITRUM_RPC_URL?: string;
  readonly VITE_TX_CONFIRMATIONS?: string;
  readonly VITE_ALLOW_MAINNET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
