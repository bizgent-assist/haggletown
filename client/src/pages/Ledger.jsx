import { useEffect, useState } from 'react';
import { errorMessage, getTrades } from '../services/api.js';
import { txUrl } from '../config/env.js';
import { itemEmoji, shortAccount, yoctoToNear } from '../utils/format.js';

export default function Ledger() {
  const [trades, setTrades] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTrades().then(setTrades).catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <section>
      <h1 className="text-3xl font-bold">Market ledger</h1>
      <p className="mt-2 text-parchment/70">Every trade here was verified against its NEAR transaction before it was recorded.</p>
      {error && <p className="mt-6 text-red-300">{error}</p>}
      {trades && trades.length === 0 && <p className="mt-6 text-parchment/50">No trades yet.</p>}
      {trades && trades.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-parchment/60">
              <tr>
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Buyer</th>
                <th className="py-2 pr-4">Seller</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2">Tx</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.txHash} className="border-t border-white/10">
                  <td className="py-2 pr-4 whitespace-nowrap">{new Date(t.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{itemEmoji[t.itemId]} {t.quantity} × {t.itemId}</td>
                  <td className="py-2 pr-4">{shortAccount(t.buyer)}</td>
                  <td className="py-2 pr-4">{shortAccount(t.seller)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{yoctoToNear(t.total)} NEAR</td>
                  <td className="py-2">
                    <a href={txUrl(t.txHash)} target="_blank" rel="noreferrer" className="text-lantern underline">view</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
