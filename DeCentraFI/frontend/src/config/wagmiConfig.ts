import { http, createConfig } from "wagmi";
import { mainnet, polygon, arbitrum, sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";
const rpcUrl = import.meta.env.VITE_RPC_URL;
const polygonRpc = import.meta.env.VITE_POLYGON_RPC_URL;
const arbitrumRpc = import.meta.env.VITE_ARBITRUM_RPC_URL;

export const supportedChains = [mainnet, polygon, arbitrum, sepolia] as const;
export const SUPPORTED_CHAIN_IDS = supportedChains.map((c) => c.id);

export const config = createConfig({
  chains: [...supportedChains],
  connectors: [
    injected({ target: "metaMask" }),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(polygonRpc || undefined),
    [arbitrum.id]: http(arbitrumRpc || undefined),
    [sepolia.id]: http(rpcUrl || undefined),
  },
  ssr: false,
});
