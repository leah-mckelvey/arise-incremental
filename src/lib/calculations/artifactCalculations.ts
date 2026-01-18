import type {
  ArtifactRank,
  ArtifactSlot,
  ArtifactStatBonus,
  Resources,
  HunterStats,
  EquippedArtifacts
} from '../../store/types';

/**
 * Calculate craft cost for an artifact based on rank and slot
 */
export const calculateCraftCost = (rank: ArtifactRank, slot: ArtifactSlot): Resources => {
  const rankMultipliers: Record<ArtifactRank, number> = {
    E: 1,
    D: 3,
    C: 10,
    B: 30,
    A: 100,
    S: 300,
  };

  const slotMultipliers: Record<ArtifactSlot, number> = {
    weapon: 2.0,    // Weapons are most expensive
    chest: 1.5,
    head: 1.2,
    legs: 1.2,
    hands: 1.0,
    feet: 1.0,
    neck: 1.3,
    ears: 1.1,
    wrist: 1.1,
    ring1: 1.0,
    ring2: 1.0,
  };

  const baseCost = rankMultipliers[rank] * slotMultipliers[slot];

  return {
    essence: Math.floor(baseCost * 3), // Reduced from 10 to 3
    crystals: Math.floor(baseCost * 15), // Increased from 5 to 15
    gold: Math.floor(baseCost * 25), // Increased from 15 to 25
    souls: 0, // No souls needed for basic crafting
    attraction: 0,
    gems: 0, // No gems needed for basic crafting
    knowledge: 0,
  };
};

/**
 * Calculate base stats for an artifact based on rank and slot
 */
export const calculateBaseStats = (rank: ArtifactRank, slot: ArtifactSlot): ArtifactStatBonus => {
  const rankBonuses: Record<ArtifactRank, number> = {
    E: 2,    // +2% per stat
    D: 5,    // +5% per stat
    C: 10,   // +10% per stat
    B: 20,   // +20% per stat
    A: 35,   // +35% per stat
    S: 60,   // +60% per stat
  };

  const baseBonus = rankBonuses[rank];

  // Different slots give different stat distributions
  const slotStats: Record<ArtifactSlot, ArtifactStatBonus> = {
    weapon: { strength: baseBonus * 1.5, agility: baseBonus * 0.5 },
    head: { intelligence: baseBonus, sense: baseBonus * 0.5 },
    chest: { vitality: baseBonus * 1.5, strength: baseBonus * 0.5 },
    hands: { agility: baseBonus, strength: baseBonus * 0.5 },
    legs: { vitality: baseBonus, agility: baseBonus * 0.5 },
    feet: { agility: baseBonus * 1.5 },
    neck: { intelligence: baseBonus, vitality: baseBonus * 0.5 },
    ears: { sense: baseBonus * 1.5 },
    wrist: { intelligence: baseBonus, agility: baseBonus * 0.5 },
    ring1: { strength: baseBonus * 0.5, agility: baseBonus * 0.5, intelligence: baseBonus * 0.5 },
    ring2: { strength: baseBonus * 0.5, agility: baseBonus * 0.5, intelligence: baseBonus * 0.5 },
  };

  return slotStats[slot];
};

/**
 * Calculate total stat bonuses from all equipped artifacts
 */
export const calculateEquippedStatBonuses = (equipped: EquippedArtifacts): ArtifactStatBonus => {
  const totalBonus: ArtifactStatBonus = {
    strength: 0,
    agility: 0,
    intelligence: 0,
    vitality: 0,
    sense: 0,
  };

  Object.values(equipped).forEach((artifact) => {
    if (artifact) {
      // Add base stats
      if (artifact.baseStats.strength) totalBonus.strength! += artifact.baseStats.strength;
      if (artifact.baseStats.agility) totalBonus.agility! += artifact.baseStats.agility;
      if (artifact.baseStats.intelligence) totalBonus.intelligence! += artifact.baseStats.intelligence;
      if (artifact.baseStats.vitality) totalBonus.vitality! += artifact.baseStats.vitality;
      if (artifact.baseStats.sense) totalBonus.sense! += artifact.baseStats.sense;

      // Add upgrade bonuses
      artifact.upgrades.forEach((upgrade) => {
        if (upgrade.statBonus.strength) totalBonus.strength! += upgrade.statBonus.strength;
        if (upgrade.statBonus.agility) totalBonus.agility! += upgrade.statBonus.agility;
        if (upgrade.statBonus.intelligence) totalBonus.intelligence! += upgrade.statBonus.intelligence;
        if (upgrade.statBonus.vitality) totalBonus.vitality! += upgrade.statBonus.vitality;
        if (upgrade.statBonus.sense) totalBonus.sense! += upgrade.statBonus.sense;
      });
    }
  });

  return totalBonus;
};

/**
 * Apply artifact bonuses to hunter stats (percentage-based)
 */
export const applyArtifactBonuses = (baseStats: HunterStats, artifactBonuses: ArtifactStatBonus): HunterStats => {
  return {
    strength: Math.floor(baseStats.strength * (1 + (artifactBonuses.strength || 0) / 100)),
    agility: Math.floor(baseStats.agility * (1 + (artifactBonuses.agility || 0) / 100)),
    intelligence: Math.floor(baseStats.intelligence * (1 + (artifactBonuses.intelligence || 0) / 100)),
    vitality: Math.floor(baseStats.vitality * (1 + (artifactBonuses.vitality || 0) / 100)),
    sense: Math.floor(baseStats.sense * (1 + (artifactBonuses.sense || 0) / 100)),
    authority: baseStats.authority, // Authority is not affected by artifacts
  };
};

/**
 * Check if hunter rank allows crafting/upgrading this artifact rank
 */
export const canCraftRank = (hunterRank: string, artifactRank: ArtifactRank): boolean => {
  const rankOrder = ['E-Rank', 'D-Rank', 'C-Rank', 'B-Rank', 'A-Rank', 'S-Rank', 'National Level'];
  const artifactRankOrder = ['E', 'D', 'C', 'B', 'A', 'S'];

  const hunterRankIndex = rankOrder.indexOf(hunterRank);
  const artifactRankIndex = artifactRankOrder.indexOf(artifactRank);

  // National Level can craft everything
  if (hunterRank === 'National Level') return true;

  return hunterRankIndex >= 0 && hunterRankIndex >= artifactRankIndex;
};

/**
 * Calculate blacksmith XP to next level
 */
export const calculateBlacksmithXpToNextLevel = (level: number): number => {
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

/**
 * Get maximum artifact rank that can be crafted at this blacksmith level
 */
export const getMaxCraftableRank = (blacksmithLevel: number): ArtifactRank => {
  if (blacksmithLevel >= 50) return 'S';
  if (blacksmithLevel >= 40) return 'A';
  if (blacksmithLevel >= 30) return 'B';
  if (blacksmithLevel >= 20) return 'C';
  if (blacksmithLevel >= 10) return 'D';
  return 'E';
};

/**
 * Check if blacksmith level allows crafting this rank
 */
export const canBlacksmithCraftRank = (blacksmithLevel: number, artifactRank: ArtifactRank): boolean => {
  const maxRank = getMaxCraftableRank(blacksmithLevel);
  const rankOrder: ArtifactRank[] = ['E', 'D', 'C', 'B', 'A', 'S'];
  const maxRankIndex = rankOrder.indexOf(maxRank);
  const artifactRankIndex = rankOrder.indexOf(artifactRank);

  return artifactRankIndex <= maxRankIndex;
};

