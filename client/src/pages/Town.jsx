import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage, getNpcs, nudgeMarket } from '../services/api.js';
import { formatNear, itemEmoji } from '../utils/format.js';
import MarketFeed from '../components/MarketFeed.jsx';

export default function Town() {
  const [npcs, setNpcs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getNpcs().then(setNpcs).catch((e) => setError(errorMessage(e)));
    // Let the market move: the server runs at most one tick every 2 minutes, then we refresh the stalls.
    nudgeMarket()
      .then((r) => r.ran && r.deal && getNpcs().then(setNpcs))
      .catch(() => {});
  }, []);

  return (
    <section>
      <h1 className="text-3xl font-bold">Market square</h1>
      <p className="mt-2 text-parchment/70">Stock and prices are read live from the NEAR market contract.</p>
      {error && <p className="mt-6 text-red-300">{error}</p>}
      {!npcs && !error && <p className="mt-6 text-parchment/50">Opening the stalls…</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {npcs?.map((npc) => (
          <Link key={npc.slug} to={`/merchant/${npc.slug}`} className="rounded-xl border border-white/10 bg-white/5 p-5 hover:border-lantern">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-lantern">{npc.trade}</p>
                <h2 className="mt-1 text-xl font-semibold">{npc.name}</h2>
              </div>
              <span className="text-xs text-parchment/60">{formatNear(npc.balanceNear)} purse</span>
            </div>
            <p className="mt-2 text-sm text-parchment/70">{npc.blurb}</p>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {npc.items.map((i) => (
                <li key={i.itemId} className="rounded bg-white/10 px-2 py-1">
                  {itemEmoji[i.itemId]} {i.name} ×{i.quantity} · {i.sellPrice}
                </li>
              ))}
            </ul>
            {!npc.active && <p className="mt-2 text-xs text-red-300">Stall closed</p>}
          </Link>
        ))}
      </div>
      <MarketFeed npcs={npcs} />
    </section>
  );
}
