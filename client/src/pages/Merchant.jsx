import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import OfferCard from '../components/OfferCard.jsx';
import { confirmTrade, errorMessage, getConversation, getInventory, getNpc, haggle } from '../services/api.js';
import { accountUrl } from '../config/env.js';
import { formatNear, itemEmoji } from '../utils/format.js';

export default function Merchant() {
  const { slug } = useParams();
  const { accountId, signedIn, connect, signIn, callMarket } = useWallet();
  const [npc, setNpc] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inventory, setInventory] = useState({});
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  const refresh = useCallback(async () => {
    const [n, inv] = await Promise.all([getNpc(slug), accountId ? getInventory(accountId) : Promise.resolve({})]);
    setNpc(n);
    setInventory(inv);
  }, [slug, accountId]);

  useEffect(() => {
    refresh().catch((e) => setError(errorMessage(e)));
    if (signedIn) getConversation(slug).then(setMessages).catch(() => {});
    else setMessages([]);
  }, [slug, signedIn, refresh]);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  async function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setError(null);
    setSending(true);
    setMessages((m) => [...m, { role: 'player', text }]);
    try {
      const { reply, npc: updated } = await haggle(slug, text);
      setMessages((m) => [...m, reply]);
      setNpc(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function accept(offer) {
    setError(null);
    setAcceptingId(offer.offerId);
    try {
      const deposit = offer.side === 'NpcSells' ? (BigInt(offer.unitPrice) * BigInt(offer.quantity)).toString() : '0';
      const txHash = await callMarket({ methodName: 'accept_offer', args: { offer_id: offer.offerId }, deposit });
      await confirmTrade(txHash);
      setMessages((m) => m.map((msg) => (msg.offer?.offerId === offer.offerId ? { ...msg, offer: { ...msg.offer, status: 'accepted' } } : msg)));
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAcceptingId(null);
    }
  }

  if (error && !npc) return <p className="text-red-300">{error}</p>;
  if (!npc) return <p className="text-parchment/50">Walking to the stall…</p>;

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0">
        <Link to="/town" className="text-sm text-parchment/60">← Market square</Link>
        <h1 className="mt-2 text-3xl font-bold">{npc.name} the {npc.trade}</h1>
        <p className="mt-1 text-parchment/70">{npc.blurb}</p>

        <div className="mt-6 flex h-[28rem] flex-col rounded-xl border border-white/10 bg-black/20">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-parchment/50">
                {signedIn ? `Say hello to ${npc.name}, ask about prices, and start haggling.` : accountId ? 'Sign in with your wallet (a free signature, no transaction) to talk to the merchant.' : 'Connect your wallet to talk to the merchant.'}
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'player' ? 'text-right' : ''}>
                <div className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-left text-sm ${m.role === 'player' ? 'bg-lantern text-dusk' : 'bg-white/10'}`}>
                  {m.role === 'npc' && <span className="mr-1 font-semibold text-lantern">{npc.name}:</span>}
                  {m.text}
                  {m.note && <p className="mt-1 text-xs italic text-parchment/60">{m.note}</p>}
                  {m.offer && (
                    <OfferCard offer={m.offer} npcName={npc.name} onAccept={accept} busy={acceptingId === m.offer.offerId} />
                  )}
                </div>
              </div>
            ))}
            {sending && <p className="text-sm text-parchment/50">{npc.name} is thinking…</p>}
            <div ref={bottomRef} />
          </div>
          {signedIn ? (
            <form onSubmit={send} className="flex gap-2 border-t border-white/10 p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={400}
                placeholder={`Haggle with ${npc.name}…`}
                className="min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lantern"
              />
              <button type="submit" disabled={sending || !draft.trim()} className="rounded-lg bg-lantern px-4 py-2 text-sm font-semibold text-dusk disabled:opacity-50">
                Say
              </button>
            </form>
          ) : (
            <div className="border-t border-white/10 p-3 text-center">
              {accountId ? (
                <button type="button" onClick={() => signIn().catch((e) => setError(errorMessage(e)))} className="rounded-lg bg-lantern px-4 py-2 text-sm font-semibold text-dusk">Sign in to haggle</button>
              ) : (
                <button type="button" onClick={() => connect().catch((e) => setError(errorMessage(e)))} className="rounded-lg bg-lantern px-4 py-2 text-sm font-semibold text-dusk">Connect wallet to haggle</button>
              )}
            </div>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="font-semibold">Stall</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {npc.items.map((i) => (
              <li key={i.itemId} className="flex justify-between gap-2">
                <span>{itemEmoji[i.itemId]} {i.name} ×{i.quantity}</span>
                <span className="text-parchment/70" title="asks / pays">{i.sellPrice} / {i.buyPrice}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-parchment/50">Asking / paying, NEAR per item. Prices rise as stock runs low.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          <h2 className="font-semibold">On-chain limits</h2>
          <p className="mt-2">Purse: {formatNear(npc.balanceNear)}</p>
          {npc.limits && (
            <p className="text-parchment/70">
              Spends at most {npc.limits.maxPerTrade} per trade, {npc.limits.maxPerDay} per day (today {npc.limits.spentToday}).
            </p>
          )}
          <a href={accountUrl(npc.accountId)} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs text-lantern underline">{npc.accountId}</a>
        </div>
        {accountId && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            <h2 className="font-semibold">Your pack</h2>
            {Object.keys(inventory).length === 0 ? (
              <p className="mt-2 text-parchment/50">Empty</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {Object.entries(inventory).map(([id, q]) => (
                  <li key={id}>{itemEmoji[id]} {id} ×{q}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>
    </section>
  );
}
