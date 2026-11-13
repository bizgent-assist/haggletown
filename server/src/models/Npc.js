import mongoose from 'mongoose';

// Off-chain profile of an NPC merchant. Balances and inventory live on-chain
// in the market contract; this holds personality and pricing memory only.
const npcSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nearAccountId: { type: String, required: true }, // sub-account, e.g. mira.market.haggletown.testnet
    personality: { type: String, required: true }, // used as the LLM system prompt
    specialty: { type: [String], default: [] }, // item ids this NPC prefers to trade
    mood: { type: Number, default: 0.5, min: 0, max: 1 }, // shifts haggling generosity
    priceMemory: { type: Map, of: String, default: {} }, // itemId -> last agreed unit price (yoctoNEAR string)
  },
  { timestamps: true },
);

export const Npc = mongoose.model('Npc', npcSchema);
