import type { ArtifactRank, ArtifactTier, ArtifactSlot, ArtifactStatBonus } from '../store/types';

/**
 * Tier drop rates by blacksmith level
 * Higher blacksmith level = better chance at higher tiers
 */
export const calculateTierDropRates = (blacksmithLevel: number): Record<ArtifactTier, number> => {
  // Base rates (level 1)
  const baseRates = {
    Common: 60,
    Uncommon: 30,
    Rare: 8,
    Epic: 1.8,
    Legendary: 0.2,
  };

  // Every 10 blacksmith levels shifts the distribution up
  const tierShift = Math.floor(blacksmithLevel / 10) * 5;

  return {
    Common: Math.max(10, baseRates.Common - tierShift * 2),
    Uncommon: baseRates.Uncommon + tierShift * 0.5,
    Rare: baseRates.Rare + tierShift * 0.8,
    Epic: baseRates.Epic + tierShift * 0.5,
    Legendary: Math.min(20, baseRates.Legendary + tierShift * 0.2),
  };
};

/**
 * Roll a random tier based on drop rates
 */
export const rollTier = (blacksmithLevel: number): ArtifactTier => {
  const rates = calculateTierDropRates(blacksmithLevel);
  const total = Object.values(rates).reduce((sum, rate) => sum + rate, 0);
  const roll = Math.random() * total;

  let cumulative = 0;
  for (const [tier, rate] of Object.entries(rates)) {
    cumulative += rate;
    if (roll <= cumulative) {
      return tier as ArtifactTier;
    }
  }

  return 'Common'; // Fallback
};

/**
 * Get stat multiplier ranges for each tier
 * Returns [min, max] multiplier for base stats
 */
export const getTierStatRange = (tier: ArtifactTier): [number, number] => {
  switch (tier) {
    case 'Common':
      return [0.8, 1.0]; // 80-100% of base
    case 'Uncommon':
      return [1.0, 1.3]; // 100-130% of base
    case 'Rare':
      return [1.3, 1.7]; // 130-170% of base
    case 'Epic':
      return [1.7, 2.2]; // 170-220% of base
    case 'Legendary':
      return [2.2, 3.0]; // 220-300% of base
  }
};

/**
 * Get max upgrades based on tier
 */
export const getTierMaxUpgrades = (tier: ArtifactTier): number => {
  switch (tier) {
    case 'Common':
      return 3;
    case 'Uncommon':
      return 4;
    case 'Rare':
      return 5;
    case 'Epic':
      return 6;
    case 'Legendary':
      return 8;
  }
};

/**
 * Get tier color for UI
 */
export const getTierColor = (tier: ArtifactTier): string => {
  switch (tier) {
    case 'Common':
      return '#9d9d9d'; // Gray
    case 'Uncommon':
      return '#1eff00'; // Green
    case 'Rare':
      return '#0070dd'; // Blue
    case 'Epic':
      return '#a335ee'; // Purple
    case 'Legendary':
      return '#ff8000'; // Orange
  }
};

/**
 * Roll random stats within tier range
 */
export const rollStats = (
  rank: ArtifactRank,
  slot: ArtifactSlot,
  tier: ArtifactTier
): ArtifactStatBonus => {
  // Base stat values by rank
  const rankMultipliers: Record<ArtifactRank, number> = {
    E: 5,
    D: 12,
    C: 25,
    B: 50,
    A: 90,
    S: 150,
  };

  const baseValue = rankMultipliers[rank];
  const [minMult, maxMult] = getTierStatRange(tier);

  // Random multiplier within tier range
  const rollMultiplier = () => minMult + Math.random() * (maxMult - minMult);

  // Different slots favor different stats
  const stats: ArtifactStatBonus = {};

  if (slot === 'weapon') {
    stats.strength = Math.floor(baseValue * rollMultiplier());
    if (Math.random() > 0.5) stats.agility = Math.floor(baseValue * 0.3 * rollMultiplier());
  } else if (slot === 'head' || slot === 'neck' || slot === 'ears') {
    stats.intelligence = Math.floor(baseValue * rollMultiplier());
    if (Math.random() > 0.5) stats.sense = Math.floor(baseValue * 0.3 * rollMultiplier());
  } else if (slot === 'chest') {
    stats.vitality = Math.floor(baseValue * rollMultiplier());
    if (Math.random() > 0.5) stats.strength = Math.floor(baseValue * 0.3 * rollMultiplier());
  } else if (slot === 'hands' || slot === 'wrist') {
    stats.agility = Math.floor(baseValue * rollMultiplier());
    if (Math.random() > 0.5) stats.strength = Math.floor(baseValue * 0.3 * rollMultiplier());
  } else if (slot === 'legs' || slot === 'feet') {
    stats.agility = Math.floor(baseValue * rollMultiplier());
    if (Math.random() > 0.5) stats.vitality = Math.floor(baseValue * 0.3 * rollMultiplier());
  } else if (slot === 'ring1' || slot === 'ring2') {
    // Rings can roll any stat
    const statTypes: Array<keyof ArtifactStatBonus> = [
      'strength',
      'agility',
      'intelligence',
      'vitality',
      'sense',
    ];
    const primaryStat = statTypes[Math.floor(Math.random() * statTypes.length)];
    stats[primaryStat] = Math.floor(baseValue * rollMultiplier());
  }

  return stats;
};

/**
 * Name prefixes based on primary stat
 */
const statPrefixes: Record<string, string[]> = {
  strength: [
    'Mighty',
    'Brutal',
    'Crushing',
    'Savage',
    'Titanic',
    "Berserker's",
    "Warrior's",
    "Champion's",
  ],
  agility: ['Swift', 'Nimble', 'Quick', 'Phantom', 'Shadow', "Assassin's", "Rogue's", "Hunter's"],
  intelligence: [
    'Arcane',
    'Mystic',
    "Sage's",
    "Scholar's",
    "Wizard's",
    'Enchanted',
    'Magical',
    'Ethereal',
  ],
  vitality: [
    'Stalwart',
    'Enduring',
    'Fortified',
    "Guardian's",
    "Defender's",
    'Resilient',
    'Unyielding',
    'Immortal',
  ],
  sense: [
    'Keen',
    'Perceptive',
    'Vigilant',
    "Observer's",
    "Watcher's",
    'All-Seeing',
    'Prophetic',
    'Visionary',
  ],
};

/**
 * Name suffixes based on tier
 */
const tierSuffixes: Record<ArtifactTier, string[]> = {
  Common: ['of the Novice', 'of Training', 'of the Apprentice', 'of Practice'],
  Uncommon: ['of Skill', 'of the Adept', 'of Competence', 'of the Journeyman'],
  Rare: ['of Power', 'of Excellence', 'of the Master', 'of Glory'],
  Epic: ['of Dominance', 'of the Legend', 'of Supremacy', 'of the Conqueror'],
  Legendary: ['of the Shadow Monarch', 'of Eternity', 'of the Gods', 'of Absolute Power'],
};

/**
 * Slot base names
 */
const slotBaseNames: Record<ArtifactSlot, string[]> = {
  weapon: ['Blade', 'Sword', 'Dagger', 'Edge', 'Fang', 'Claw'],
  head: ['Helm', 'Crown', 'Circlet', 'Hood', 'Mask', 'Diadem'],
  chest: ['Armor', 'Plate', 'Cuirass', 'Vest', 'Mail', 'Breastplate'],
  hands: ['Gauntlets', 'Gloves', 'Grips', 'Fists', 'Wraps'],
  legs: ['Greaves', 'Leggings', 'Pants', 'Cuisses', 'Guards'],
  feet: ['Boots', 'Treads', 'Sabatons', 'Shoes', 'Walkers'],
  neck: ['Amulet', 'Necklace', 'Pendant', 'Collar', 'Torc'],
  ears: ['Earrings', 'Studs', 'Hoops', 'Loops'],
  wrist: ['Bracers', 'Wristguards', 'Bands', 'Cuffs'],
  ring1: ['Ring', 'Band', 'Loop', 'Circle'],
  ring2: ['Ring', 'Band', 'Loop', 'Circle'],
};

/**
 * Generate a procedural name based on stats and tier
 */
export const generateArtifactName = (
  slot: ArtifactSlot,
  tier: ArtifactTier,
  stats: ArtifactStatBonus
): string => {
  // Find primary stat (highest value)
  let primaryStat: keyof ArtifactStatBonus = 'strength';
  let maxValue = 0;

  for (const [stat, value] of Object.entries(stats)) {
    if (value && value > maxValue) {
      maxValue = value;
      primaryStat = stat as keyof ArtifactStatBonus;
    }
  }

  // Pick random prefix based on primary stat
  const prefixes = statPrefixes[primaryStat] || statPrefixes.strength;
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];

  // Pick random base name for slot
  const baseNames = slotBaseNames[slot];
  const baseName = baseNames[Math.floor(Math.random() * baseNames.length)];

  // Pick random suffix based on tier
  const suffixes = tierSuffixes[tier];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

  return `${prefix} ${baseName} ${suffix}`;
};
