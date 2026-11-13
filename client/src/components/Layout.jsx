import { Link, NavLink, Outlet } from 'react-router-dom';

const navClass = ({ isActive }) => (isActive ? 'text-lantern' : 'text-parchment/70 hover:text-parchment');

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10">
        <nav className="mx-auto max-w-5xl flex items-center gap-6 px-4 py-4">
          <Link to="/" className="font-bold text-lantern text-lg">Haggletown</Link>
          <NavLink to="/town" className={navClass}>Town</NavLink>
          <NavLink to="/ledger" className={navClass}>Ledger</NavLink>
          <span className="ml-auto text-xs rounded bg-white/10 px-2 py-1">TESTNET</span>
        </nav>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
