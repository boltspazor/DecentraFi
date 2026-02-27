import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, hardhat } from 'wagmi/chains'

const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? 31337)
const rpcUrl = import.meta.env.VITE_RPC_URL

const chain = chainId === 31337 ? hardhat : chainId === 11155111 ? sepolia : mainnet

export const config = createConfig({
  chains: [chain],
  transports: {
    [chain.id]: http(rpcUrl ?? undefined),
  },
})
