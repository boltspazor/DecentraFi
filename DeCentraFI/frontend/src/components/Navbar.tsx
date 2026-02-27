import { Link } from 'react-router-dom'
import { WalletConnectButton } from './WalletConnectButton'

export function Navbar() {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem 2rem',
      borderBottom: '1px solid #eee',
    }}>
      <Link to="/" style={{ textDecoration: 'none', fontWeight: 600, fontSize: '1.25rem' }}>
        DecentraFI
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <Link to="/">Home</Link>
        <Link to="/create">Create Campaign</Link>
        <WalletConnectButton />
      </div>
    </nav>
  )
}
