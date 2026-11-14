import mongoose from 'mongoose';

// One-time sign-in challenges. MongoDB removes them automatically after 5 minutes.
const authNonceSchema = new mongoose.Schema({
  nonce: { type: String, required: true, unique: true }, // base64, 32 bytes
  createdAt: { type: Date, default: Date.now, expires: 300 },
});

export const AuthNonce = mongoose.model('AuthNonce', authNonceSchema);
