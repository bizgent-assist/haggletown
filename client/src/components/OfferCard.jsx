import { useEffect, useState } from 'react';
import { txUrl } from '../config/env.js';
import { itemEmoji } from '../utils/format.js';

function useCountdown(expiresAtMs) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, expiresAtMs - now);
  return { expired: left === 0, label: `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}` };
}

export default function OfferCard({ offer, npcName, onAccept, busy }) {
  const { expired, label } = useCountdown(offer.expiresAtMs);
  const total = Math.round(offer.unitPriceNear * offer.quantity * 1e6) / 1e6;
  const selling = offer.side === 'NpcSells';
  const status = offer.status === 'open' && expired ? 'expired' : offer.status;

  return (
    <div className="mt-2 rounded-lg border border-lantern/40 bg-lantern/10 p-3 text-sm">
      <p className="font-semibold">
        {selling ? `${npcName} sells you` : `${npcName} buys from you`}: {itemEmoji[offer.itemId]} {offer.quantity} × {offer.itemId} @ {offer.unitPriceNear} NEAR
      </p>
      <p className="text-parchment/70">
        Total {total} NEAR · offer #{offer.offerId} ·{' '}
        <a href={txUrl(offer.txHash)} target="_blank" rel="noreferrer" className="underline">posted on-chain</a>
      </p>
      <div className="mt-2 flex items-center gap-3">
        {status === 'open' && (
          <>
            <button type="button" disabled={busy} onClick={() => onAccept(offer)} className="rounded bg-lantern px-3 py-1 font-semibold text-dusk disabled:opacity-50">
              {busy ? 'Waiting for wallet…' : selling ? `Pay ${total} NEAR` : `Sell for ${total} NEAR`}
            </button>
            <span className="text-xs text-parchment/60">expires in {label}</span>
          </>
        )}
        {status === 'accepted' && <span className="text-green-300">Deal done ✓ verified on-chain</span>}
        {status === 'expired' && <span className="text-parchment/50">Offer expired</span>}
      </div>
    </div>
  );
}
