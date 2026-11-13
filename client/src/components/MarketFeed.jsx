import { useEffect, useState } from 'react';
import { getTrades } from '../services/api.js';
import { txUrl } from '../config/env.js';
import { itemEmoji, shortAccount, yoctoToNear } from '../utils/format.js';

function who(accountId, npcs) {
  const npc = npcs?.find((n) => n.accountId === accountId);
  return npc ? npc.name : shortAccount(accountId);
}

function timeAgo(date) {
  const s = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

/** Recent verified trades, refreshed every 20 seconds. */
export default function MarketFeed({ npcs }) {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = () => getTrades(8).then((t) => alive && setTrades(t)).catch(() => {});
    load();
    const id = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (trades.length === 0) return null;
  return (
    <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="font-semibold">Market chatter</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {trades.map((t) => (
          <li key={t.txHash} className="flex flex-wrap items-baseline gap-x-2">
            <span>
              {itemEmoji[t.itemId]} <strong>{who(t.buyer, npcs)}</strong> bought {t.quantity} {t.itemId} from{' '}
              <strong>{who(t.seller, npcs)}</strong> for {yoctoToNear(t.total)} NEAR
            </span>
            <span className="text-xs text-parchment/50">
              {t.kind === 'npc_to_npc' ? 'merchant deal' : 'player deal'} · {timeAgo(t.createdAt)} ·{' '}
              <a href={txUrl(t.txHash)} target="_blank" rel="noreferrer" className="underline">tx</a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
