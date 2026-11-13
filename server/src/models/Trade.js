import mongoose from 'mongoose';

// A trade recorded only after its NEAR transaction outcome and trade event were verified.
const tradeSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['player_buy', 'player_sell', 'npc_to_npc'], required: true },
    offerId: { type: Number, required: true },
    buyer: { type: String, required: true },
    seller: { type: String, required: true },
    itemId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: String, required: true }, // yoctoNEAR
    total: { type: String, required: true }, // yoctoNEAR
    txHash: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export const Trade = mongoose.model('Trade', tradeSchema);
