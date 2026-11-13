// The Haggletown world: items, merchants and their on-chain limits.
// Used by the setup scripts (to configure the contract) and by the API (merchant personalities).
// Prices are in NEAR (strings) and converted to yoctoNEAR when sent on-chain.

export const ITEMS = [
  { id: 'herb', name: 'Moonleaf Herb', min: '0.002', max: '0.02' },
  { id: 'fish', name: 'Silver Carp', min: '0.002', max: '0.02' },
  { id: 'iron_ore', name: 'Iron Ore', min: '0.005', max: '0.04' },
  { id: 'potion', name: 'Healing Potion', min: '0.01', max: '0.08' },
  { id: 'sword', name: 'Tempered Sword', min: '0.05', max: '0.3' },
  { id: 'amulet', name: 'Old Amulet', min: '0.1', max: '0.5' },
];

const DEFAULT_LIMITS = { maxPerTrade: '0.2', maxPerDay: '1' };

export const NPCS = [
  {
    slug: 'mira',
    name: 'Mira',
    trade: 'Herbalist',
    blurb: 'Sells potions dear, buys herbs cheap.',
    stock: { potion: 20, herb: 40 },
    personality:
      'Mira, a warm but shrewd herbalist. Sells potions dear and buys herbs cheap. Gives small discounts to polite customers.',
  },
  {
    slug: 'grob',
    name: 'Grob',
    trade: 'Blacksmith',
    blurb: 'Gruff, but softens if you bring ore.',
    stock: { sword: 6, iron_ore: 20 },
    personality:
      'Grob, a gruff blacksmith of few words. Hates haggling over swords but softens if the customer brings iron ore.',
  },
  {
    slug: 'tess',
    name: 'Tess',
    trade: 'Fishmonger',
    blurb: 'Prices swing with the morning catch.',
    stock: { fish: 40, herb: 10 },
    personality:
      'Tess, a chatty fishmonger. Her prices swing with the morning catch; she sells fast before fish spoils.',
  },
  {
    slug: 'oren',
    name: 'Oren',
    trade: 'Collector',
    blurb: 'Pays well for rare items. Hates bluffing.',
    stock: { amulet: 3 },
    personality:
      'Oren, a quiet collector of rare things. Pays well for rare items, but walks away from anyone who bluffs.',
  },
].map((npc) => ({ limits: DEFAULT_LIMITS, ...npc }));

// NEAR given to each NPC account for gas, the function-call key allowance, and the NPC's trading balance.
export const NPC_FUNDING = { accountGas: '0.6', keyAllowance: '0.5', tradingBalance: '0.4' };

// Contract methods an NPC's function-call key may call. Nothing that moves NEAR or items out.
export const NPC_KEY_METHODS = ['make_offer', 'cancel_offer', 'accept_offer', 'prune_expired'];
