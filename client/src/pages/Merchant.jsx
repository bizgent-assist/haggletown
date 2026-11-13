import { useParams, Link } from 'react-router-dom';
import { NPCS } from '../config/npcs.js';

export default function Merchant() {
  const { slug } = useParams();
  const npc = NPCS.find((n) => n.slug === slug);
  if (!npc) return <p>No merchant here. <Link to="/town" className="text-lantern">Back to town</Link></p>;

  return (
    <section>
      <Link to="/town" className="text-sm text-parchment/60">← Market square</Link>
      <h1 className="mt-2 text-3xl font-bold">{npc.name} the {npc.trade}</h1>
      <p className="mt-2 text-parchment/70">{npc.blurb}</p>
      {/* Next: stall inventory from the contract + haggle chat via /api/v1/npcs/:slug/haggle */}
      <div className="mt-8 rounded-xl border border-dashed border-white/20 p-8 text-center text-parchment/50">
        Haggle chat coming next.
      </div>
    </section>
  );
}
