import type { Hunter, HunterStats } from '../types.js';

/**
 * Calculate XP required to reach the next level
 */
export const calculateXpToNextLevel = (level: number): number => {
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

/**
 * Calculate hunter rank based on level
 */
export const calculateRank = (level: number): string => {
  if (level >= 100) return 'National Level';
  if (level >= 50) return 'S-Rank';
  if (level >= 40) return 'A-Rank';
  if (level >= 30) return 'B-Rank';
  if (level >= 20) return 'C-Rank';
  if (level >= 10) return 'D-Rank';
  return 'E-Rank';
};

/**
 * Calculate maximum HP based on vitality and level
 */
export const calculateMaxHp = (vitality: number, level: number): number => {
  return 100 + vitality * 10 + level * 5;
};

/**
 * Calculate maximum mana based on intelligence and level
 */
export const calculateMaxMana = (intelligence: number, level: number): number => {
  return 50 + intelligence * 5 + level * 3;
};

/**
 * Process XP gain and handle level ups
 * Returns updated hunter state and whether a level up occurred
 */
export const processXpGain = (
  hunter: Hunter,
  xpAmount: number
): { hunter: Hunter; leveledUp: boolean; newLevel?: number } => {
  let newXp = hunter.xp + xpAmount;
  let newLevel = hunter.level;
  let newStatPoints = hunter.statPoints;
  let leveledUp = false;

  // Handle level ups
  let xpToNextLevel = hunter.xpToNextLevel;
  while (newXp >= xpToNextLevel) {
    newXp -= xpToNextLevel;
    newLevel += 1;
    newStatPoints += 3; // 3 stat points per level
    xpToNextLevel = calculateXpToNextLevel(newLevel);
    leveledUp = true;
  }

  const newRank = calculateRank(newLevel);
  const newMaxHp = calculateMaxHp(hunter.stats.vitality, newLevel);
  const newMaxMana = calculateMaxMana(hunter.stats.intelligence, newLevel);

  return {
    hunter: {
      ...hunter,
      level: newLevel,
      xp: newXp,
      xpToNextLevel: xpToNextLevel,
      rank: newRank,
      statPoints: newStatPoints,
      maxHp: newMaxHp,
      hp: Math.min(hunter.hp, newMaxHp),
      maxMana: newMaxMana,
      mana: Math.min(hunter.mana, newMaxMana),
    },
    leveledUp,
    newLevel: leveledUp ? newLevel : undefined,
  };
};

/**
 * Calculate stat allocation result
 */
export const calculateStatAllocation = (
  hunter: Hunter,
  stat: keyof HunterStats
): Hunter | null => {
  if (hunter.statPoints <= 0) return null;

  const newStats = {
    ...hunter.stats,
    [stat]: hunter.stats[stat] + 1,
  };

  const newMaxHp = calculateMaxHp(newStats.vitality, hunter.level);
  const newMaxMana = calculateMaxMana(newStats.intelligence, hunter.level);

  return {
    ...hunter,
    stats: newStats,
    statPoints: hunter.statPoints - 1,
    maxHp: newMaxHp,
    hp: stat === 'vitality' ? newMaxHp : hunter.hp,
    maxMana: newMaxMana,
    mana: stat === 'intelligence' ? newMaxMana : hunter.mana,
  };
};

