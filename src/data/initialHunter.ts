import type { Hunter, ResourceCaps } from '../store/types';
import { calculateXpToNextLevel, calculateRank } from '../lib/calculations/hunterCalculations';

export const createInitialHunter = (): Hunter => ({
  level: 1,
  xp: 0,
  xpToNextLevel: calculateXpToNextLevel(1),
  rank: calculateRank(1),
  stats: {
    strength: 10,
    agility: 10,
    intelligence: 10,
    vitality: 10,
    sense: 10,
    authority: 1, // Starts at 1 (can bring 1 companion per dungeon)
  },
  statPoints: 0,
  hp: 150,
  maxHp: 150,
  mana: 80,
  maxMana: 80,
});

export const baseResourceCaps: ResourceCaps = {
  essence: 100,
  crystals: 50,
  gold: 200,
  souls: 10,
  attraction: 100, // Increased from 25 to allow building Attraction Hall (costs 50)
  gems: 10,
  knowledge: 100,
};
