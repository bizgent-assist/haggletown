const MICRO = 10n ** 18n;

/** yoctoNEAR string -> "0.0355" */
export function yoctoToNear(yocto) {
  const micro = Number(BigInt(yocto) / MICRO);
  return String(micro / 1e6);
}

export const formatNear = (near) => `${Number(near).toLocaleString(undefined, { maximumFractionDigits: 6 })} NEAR`;

export const shortAccount = (id = '') => (id.length > 28 ? `${id.slice(0, 12)}…${id.slice(-12)}` : id);

export const itemEmoji = { herb: '🌿', fish: '🐟', iron_ore: '🪨', potion: '🧪', sword: '🗡️', amulet: '🧿' };
