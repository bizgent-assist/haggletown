import { Link } from 'react-router-dom';
import { NPCS } from '../config/npcs.js';

export default function Town() {
  return (
    <section>
      <h1 className="text-3xl font-bold">Market square</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {NPCS.map((npc) => (
          <Link
            key={npc.slug}
            to={`/merchant/${npc.slug}`}
            className="rounded-xl border border-white/10 bg-white/5 p-5 hover:border-lantern"
          >
            <p className="text-xs uppercase tracking-wide text-lantern">{npc.trade}</p>
            <h2 className="mt-1 text-xl font-semibold">{npc.name}</h2>
            <p className="mt-2 text-sm text-parchment/70">{npc.blurb}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
