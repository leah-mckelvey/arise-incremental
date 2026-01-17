import type { ArtifactUpgrade, EquippedArtifacts } from '../store/types';

/**
 * Available upgrade types for artifacts (COD-style incremental improvements)
 */
export const availableUpgrades: Record<string, Omit<ArtifactUpgrade, 'cost' | 'blacksmithXpCost'>> = {
  sharpenBlade: {
    id: 'sharpenBlade',
    name: '🔪 Sharpen Blade',
    description: 'Sharpen the weapon for increased damage',
    statBonus: { strength: 3 },
  },
  reinforceArmor: {
    id: 'reinforceArmor',
    name: '🛡️ Reinforce Armor',
    description: 'Add extra plating for better protection',
    statBonus: { vitality: 3 },
  },
  enchantMana: {
    id: 'enchantMana',
    name: '✨ Mana Enchantment',
    description: 'Infuse with mana for magical power',
    statBonus: { intelligence: 3 },
  },
  lightenWeight: {
    id: 'lightenWeight',
    name: '🪶 Lighten Weight',
    description: 'Reduce weight for better mobility',
    statBonus: { agility: 3 },
  },
  enhanceSenses: {
    id: 'enhanceSenses',
    name: '👁️ Enhance Senses',
    description: 'Improve perception and awareness',
    statBonus: { sense: 3 },
  },
  masterworkCrafting: {
    id: 'masterworkCrafting',
    name: '⚒️ Masterwork Crafting',
    description: 'Apply masterwork techniques',
    statBonus: { strength: 2, agility: 2 },
  },
  runeInscription: {
    id: 'runeInscription',
    name: '📜 Rune Inscription',
    description: 'Inscribe powerful runes',
    statBonus: { intelligence: 2, sense: 2 },
  },
  shadowInfusion: {
    id: 'shadowInfusion',
    name: '👻 Shadow Infusion',
    description: 'Infuse with shadow energy',
    statBonus: { strength: 2, vitality: 2 },
  },
};

/**
 * Calculate upgrade cost based on artifact rank and current upgrade count
 */
export const calculateUpgradeCost = (artifactRank: string, upgradeCount: number) => {
  const rankMultipliers: Record<string, number> = {
    E: 1,
    D: 2,
    C: 5,
    B: 15,
    A: 50,
    S: 150,
  };

  const baseCost = (rankMultipliers[artifactRank] || 1) * (upgradeCount + 1);

  return {
    essence: Math.floor(baseCost * 20),
    crystals: Math.floor(baseCost * 10),
    gold: Math.floor(baseCost * 40),
    souls: Math.floor(baseCost * 2),
    attraction: 0,
    gems: 0,
    knowledge: 0,
  };
};

/**
 * Calculate blacksmith XP cost for upgrade
 */
export const calculateUpgradeBlacksmithXpCost = (artifactRank: string, upgradeCount: number): number => {
  const rankMultipliers: Record<string, number> = {
    E: 10,
    D: 25,
    C: 50,
    B: 100,
    A: 200,
    S: 400,
  };

  return (rankMultipliers[artifactRank] || 10) * (upgradeCount + 1);
};

/**
 * Initial equipped artifacts state (all empty)
 */
export const createInitialEquippedArtifacts = (): EquippedArtifacts => ({
  weapon: undefined,
  head: undefined,
  chest: undefined,
  hands: undefined,
  legs: undefined,
  feet: undefined,
  neck: undefined,
  ears: undefined,
  wrist: undefined,
  ring1: undefined,
  ring2: undefined,
});

/**
 * Artifact name templates by slot and rank
 */
export const artifactNameTemplates: Record<string, Record<string, string>> = {
  weapon: {
    E: '🗡️ Iron Dagger',
    D: '⚔️ Steel Sword',
    C: '🔪 Knight\'s Blade',
    B: '⚡ Lightning Sword',
    A: '🔥 Demon Slayer',
    S: '💀 Baruka\'s Dagger',
  },
  head: {
    E: '🪖 Leather Cap',
    D: '⛑️ Iron Helmet',
    C: '👑 Knight\'s Helm',
    B: '💎 Crystal Crown',
    A: '✨ Mana Circlet',
    S: '👹 Shadow Monarch\'s Crown',
  },
  chest: {
    E: '👕 Cloth Armor',
    D: '🦺 Leather Armor',
    C: '🛡️ Plate Armor',
    B: '⚡ Lightning Plate',
    A: '🔥 Dragon Scale Armor',
    S: '👻 Shadow Monarch\'s Armor',
  },
  hands: {
    E: '🧤 Cloth Gloves',
    D: '🥊 Leather Gloves',
    C: '⚔️ Gauntlets',
    B: '💎 Crystal Gauntlets',
    A: '⚡ Thunder Gauntlets',
    S: '👹 Shadow Monarch\'s Gauntlets',
  },
  legs: {
    E: '👖 Cloth Pants',
    D: '🦵 Leather Leggings',
    C: '🛡️ Plate Leggings',
    B: '💎 Crystal Greaves',
    A: '⚡ Thunder Greaves',
    S: '👻 Shadow Monarch\'s Greaves',
  },
  feet: {
    E: '👟 Cloth Boots',
    D: '🥾 Leather Boots',
    C: '⚔️ Steel Boots',
    B: '💨 Wind Boots',
    A: '⚡ Lightning Boots',
    S: '👹 Shadow Monarch\'s Boots',
  },
};

