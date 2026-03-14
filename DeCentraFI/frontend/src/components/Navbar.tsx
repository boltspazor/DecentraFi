import { Link } from "react-router-dom";
import { WalletConnectButton } from "./WalletConnectButton";

export function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
      <Link
        to="/"
        className="text-xl font-semibold text-gray-900 hover:text-indigo-600"
      >
        DecentraFI
      </Link>
      <div className="flex items-center gap-6">
        <Link to="/" className="text-gray-600 hover:text-gray-900">
          Home
        </Link>
        <Link to="/explore" className="text-gray-600 hover:text-gray-900">
          Explore
        </Link>
        <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
          Dashboard
        </Link>
        <Link to="/create" className="text-gray-600 hover:text-gray-900">
          Create Campaign
        </Link>
        <Link to="/admin" className="text-gray-600 hover:text-gray-900">
          Admin
        </Link>
        <WalletConnectButton />
      </div>
    </nav>
  );
}
