import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";
const rpcUrl = import.meta.env.VITE_RPC_URL;

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected({ target: "metaMask" }),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [sepolia.id]: http(rpcUrl || undefined),
  },
  ssr: false,
});
