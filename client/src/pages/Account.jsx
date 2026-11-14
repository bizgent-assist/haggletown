import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import { errorMessage, getInventory, getMe, updateMe } from '../services/api.js';
import { accountUrl } from '../config/env.js';
import { itemEmoji } from '../utils/format.js';

export default function Account() {
  const { accountId, signedIn, connect, signIn } = useWallet();
  const [me, setMe] = useState(null);
  const [inventory, setInventory] = useState({});
  const [email, setEmail] = useState('');
  const [notify, setNotify] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!signedIn) return;
    getMe().then((m) => {
      setMe(m);
      setEmail(m.email);
      setNotify(m.emailNotifications);
    }).catch((e) => setStatus(errorMessage(e)));
    getInventory(accountId).then(setInventory).catch(() => {});
  }, [signedIn, accountId]);

  async function save(e) {
    e.preventDefault();
    setStatus(null);
    try {
      const m = await updateMe({ email: email.trim(), emailNotifications: notify && Boolean(email.trim()) });
      setMe(m);
      setNotify(m.emailNotifications);
      setStatus('Saved.');
    } catch (err) {
      setStatus(errorMessage(err));
    }
  }

  if (!accountId) {
    return (
      <section className="py-10 text-center">
        <h1 className="text-3xl font-bold">Your account</h1>
        <button type="button" onClick={() => connect().catch(() => {})} className="mt-6 rounded-lg bg-lantern px-5 py-2 font-semibold text-dusk">Connect wallet</button>
      </section>
    );
  }
  if (!signedIn) {
    return (
      <section className="py-10 text-center">
        <h1 className="text-3xl font-bold">Your account</h1>
        <p className="mt-2 text-parchment/70">Sign a free message with your wallet to prove it is you. No transaction, no fee.</p>
        <button type="button" onClick={() => signIn().catch((e) => setStatus(errorMessage(e)))} className="mt-6 rounded-lg bg-lantern px-5 py-2 font-semibold text-dusk">Sign in</button>
        {status && <p className="mt-3 text-sm text-red-300">{status}</p>}
      </section>
    );
  }

  return (
    <section className="max-w-xl">
      <h1 className="text-3xl font-bold">Your account</h1>
      <a href={accountUrl(accountId)} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm text-lantern underline">{accountId}</a>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Your pack</h2>
        {Object.keys(inventory).length === 0 ? (
          <p className="mt-2 text-sm text-parchment/60">Empty. <Link to="/town" className="text-lantern underline">Go haggle</Link>.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {Object.entries(inventory).map(([id, q]) => (
              <li key={id}>{itemEmoji[id]} {id} ×{q}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-parchment/50">Items are NEP-245 tokens in the market contract, owned by your account.</p>
      </div>

      <form onSubmit={save} className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Trade receipts by email</h2>
        <label className="mt-3 block text-sm">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-lantern" />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Email me a receipt after each verified trade
        </label>
        <button type="submit" className="mt-4 rounded-lg bg-lantern px-4 py-2 text-sm font-semibold text-dusk">Save</button>
        {status && <p className="mt-2 text-sm text-parchment/70">{status}</p>}
        {me && !me.email && <p className="mt-2 text-xs text-parchment/50">Optional. Your email is only used for receipts.</p>}
      </form>
    </section>
  );
}
