import { Link, NavLink, Outlet } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import { shortAccount } from '../utils/format.js';

const navClass = ({ isActive }) => (isActive ? 'text-lantern' : 'text-parchment/70 hover:text-parchment');

export default function Layout() {
  const { ready, accountId, connect, disconnect } = useWallet();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10">
        <nav className="mx-auto max-w-5xl flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
          <Link to="/" className="font-bold text-lantern text-lg">Haggletown</Link>
          <NavLink to="/town" className={navClass}>Town</NavLink>
          <NavLink to="/ledger" className={navClass}>Ledger</NavLink>
          <span className="ml-auto text-xs rounded bg-white/10 px-2 py-1">TESTNET</span>
          {accountId ? (
            <button type="button" onClick={disconnect} className="text-sm rounded-lg border border-white/20 px-3 py-1.5 hover:border-lantern" title="Disconnect">
              {shortAccount(accountId)}
            </button>
          ) : (
            <button type="button" onClick={connect} disabled={!ready} className="text-sm rounded-lg bg-lantern px-3 py-1.5 font-semibold text-dusk disabled:opacity-50">
              Connect wallet
            </button>
          )}
        </nav>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="text-center text-xs text-parchment/40 py-6">
        NEAR Hackathon 2026 · testnet only · unaudited
      </footer>
    </div>
  );
}
