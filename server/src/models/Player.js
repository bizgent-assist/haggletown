import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    nearAccountId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, trim: true, maxlength: 40 },
    email: { type: String, trim: true, lowercase: true },
    emailNotifications: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Player = mongoose.model('Player', playerSchema);
