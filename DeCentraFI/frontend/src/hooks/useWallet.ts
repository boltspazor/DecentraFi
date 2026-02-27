import { useAccount, useChainId } from 'wagmi'

export function useWallet() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount()
  const chainId = useChainId()

  return {
    address: address ?? undefined,
    isConnected,
    isConnecting: isConnecting || isReconnecting,
    chainId,
  }
}
