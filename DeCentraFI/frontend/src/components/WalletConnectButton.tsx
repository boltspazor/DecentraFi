import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function WalletConnectButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          border: '1px solid #ccc',
          cursor: 'pointer',
        }}
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    )
  }

  return (
    <>
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          type="button"
          disabled={isPending}
          onClick={() => connect({ connector })}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: '1px solid #333',
            background: '#333',
            color: '#fff',
            cursor: isPending ? 'wait' : 'pointer',
          }}
        >
          {isPending ? 'Connecting...' : `Connect ${connector.name}`}
        </button>
      ))}
    </>
  )
}
