export default function Ledger() {
  return (
    <section>
      <h1 className="text-3xl font-bold">Market ledger</h1>
      <p className="mt-2 text-parchment/70">Every verified trade, with a link to its NEAR transaction.</p>
      {/* Next: list trades from /api/v1/trades */}
    </section>
  );
}
