// Runs market ticks by hand (useful for demos and checks).
//   node scripts/market-tick.js [--count 3]
import mongoose from 'mongoose';
import { connectDb } from '../src/db.js';
import { runTick } from '../src/services/tick.js';

const i = process.argv.indexOf('--count');
const count = i > -1 ? Number(process.argv[i + 1]) : 1;

await connectDb();
for (let n = 1; n <= count; n += 1) {
  const result = await runTick();
  if (!result.deal) console.log(`tick ${n}: no deal (${result.skipped || 'nobody is short of anything'})`);
}
await mongoose.disconnect();
