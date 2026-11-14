import mongoose from 'mongoose';

// Shared lock so only one market tick runs per interval, across all server instances.
const marketStateSchema = new mongoose.Schema({
  _id: { type: String },
  lastTickAt: { type: Date, default: new Date(0) },
});

export const MarketState = mongoose.model('MarketState', marketStateSchema);
