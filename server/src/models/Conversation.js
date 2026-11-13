import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema(
  {
    offerId: Number,
    side: { type: String, enum: ['NpcSells', 'NpcBuys'] },
    itemId: String,
    quantity: Number,
    unitPrice: String, // yoctoNEAR
    unitPriceNear: Number,
    expiresAtMs: Number,
    txHash: String,
    status: { type: String, enum: ['open', 'accepted', 'expired'], default: 'open' },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['player', 'npc'], required: true },
    text: { type: String, required: true },
    offer: { type: offerSchema, default: undefined },
    note: String, // e.g. policy adjustment or AI-unavailable notice
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    player: { type: String, required: true },
    npcSlug: { type: String, required: true },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
);
conversationSchema.index({ player: 1, npcSlug: 1 }, { unique: true });

export const Conversation = mongoose.model('Conversation', conversationSchema);
