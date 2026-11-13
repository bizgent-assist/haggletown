import mongoose from 'mongoose';

// Record of a trade. Marked "verified" only after the NEAR transaction outcome is read.
const tradeSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['player_buy', 'player_sell', 'npc_to_npc', 'restock'], required: true },
    buyer: { type: String, required: true },
    seller: { type: String, required: true },
    itemId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: String, required: true }, // total price in yoctoNEAR, as string
    txHash: { type: String },
    status: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' },
  },
  { timestamps: true },
);

export const Trade = mongoose.model('Trade', tradeSchema);
