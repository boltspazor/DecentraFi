import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";
const rpcUrl = import.meta.env.VITE_RPC_URL;
const mainnetRpc = import.meta.env.VITE_MAINNET_RPC_URL;

export const supportedChains = [mainnet, sepolia] as const;
export const SUPPORTED_CHAIN_IDS = supportedChains.map((c) => c.id);

export const config = createConfig({
  chains: [...supportedChains],
  connectors: [
    injected({ target: "metaMask" }),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [mainnet.id]: http(mainnetRpc || undefined),
    [sepolia.id]: http(rpcUrl || undefined),
  },
  ssr: false,
});
