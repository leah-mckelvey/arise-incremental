import type { Dungeon } from '../store/types';

/**
 * Dungeons based on Solo Leveling story progression
 * Solo dungeons: Leveling and resources (no shadow drops)
 * Alliance dungeons: Human allies and shadows (shadow extraction enabled)
 */
export const initialDungeons: Dungeon[] = [
  // Early Solo Dungeons
  {
    id: 'instance-dungeon-1',
    name: '🏛️ Instance Dungeon (Level 1)',
    description: 'The mysterious dungeon that only you can enter. A perfect training ground.',
    type: 'solo',
    rank: 'E',
    requiredLevel: 1,
    duration: 30, // 30 seconds
    rewards: {
      essence: 50,
      crystals: 30,
      gold: 100,
      souls: 0,
      attraction: 0,
      gems: 0,
      knowledge: 10,
      experience: 100,
    },
    unlocked: true, // Available from start
  },
  {
    id: 'instance-dungeon-2',
    name: '🏛️ Instance Dungeon (Level 2)',
    description: 'The instance dungeon grows stronger with you.',
    type: 'solo',
    rank: 'D',
    requiredLevel: 10,
    duration: 60, // 1 minute
    rewards: {
      essence: 150,
      crystals: 100,
      gold: 300,
      souls: 50,
      attraction: 0,
      gems: 5,
      knowledge: 30,
      experience: 500,
    },
    unlocked: false,
  },
  {
    id: 'instance-dungeon-3',
    name: '🏛️ Instance Dungeon (Level 3)',
    description: 'The final stage of the instance dungeon. Prepare for a real challenge.',
    type: 'solo',
    rank: 'C',
    requiredLevel: 20,
    duration: 120, // 2 minutes
    rewards: {
      essence: 400,
      crystals: 300,
      gold: 800,
      souls: 200,
      attraction: 0,
      gems: 20,
      knowledge: 100,
      experience: 1500,
    },
    unlocked: false,
  },

  // Demon Castle
  {
    id: 'demon-castle',
    name: '🏰 Demon Castle',
    description: 'The castle of the Demon King. Face powerful demons and claim legendary rewards.',
    type: 'solo',
    rank: 'B',
    requiredLevel: 30,
    duration: 180, // 3 minutes
    rewards: {
      essence: 1000,
      crystals: 800,
      gold: 2000,
      souls: 600,
      attraction: 0,
      gems: 50,
      knowledge: 300,
      experience: 4000,
    },
    unlocked: false,
  },

  // Red Gate
  {
    id: 'red-gate',
    name: '🔴 Red Gate',
    description: 'A deadly S-rank gate with ice elves. Survive and grow stronger.',
    type: 'solo',
    rank: 'S',
    requiredLevel: 40,
    duration: 300, // 5 minutes
    rewards: {
      essence: 3000,
      crystals: 2500,
      gold: 6000,
      souls: 2000,
      attraction: 0,
      gems: 150,
      knowledge: 800,
      experience: 10000,
    },
    unlocked: false,
  },

  // Alliance Dungeons (Drop shadows)
  {
    id: 'double-dungeon',
    name: '⚔️ Double Dungeon',
    description: 'Help other hunters survive the deadly double dungeon. Gain allies and shadows.',
    type: 'alliance',
    rank: 'D',
    requiredLevel: 5,
    duration: 90, // 1.5 minutes
    rewards: {
      essence: 100,
      crystals: 80,
      gold: 200,
      souls: 100,
      attraction: 50, // Gain reputation
      gems: 10,
      knowledge: 20,
      experience: 300,
    },
    unlocked: false,
  },
  {
    id: 'c-rank-gate',
    name: '🌟 C-Rank Gate Raid',
    description: 'Join a raid team to clear a C-rank gate. Build your reputation.',
    type: 'alliance',
    rank: 'C',
    requiredLevel: 15,
    duration: 150, // 2.5 minutes
    rewards: {
      essence: 300,
      crystals: 250,
      gold: 600,
      souls: 300,
      attraction: 100,
      gems: 25,
      knowledge: 80,
      experience: 1000,
    },
    unlocked: false,
  },
  {
    id: 'a-rank-gate',
    name: '⭐ A-Rank Gate Raid',
    description: 'A high-level raid with elite hunters. Prove your strength.',
    type: 'alliance',
    rank: 'A',
    requiredLevel: 35,
    duration: 240, // 4 minutes
    rewards: {
      essence: 1500,
      crystals: 1200,
      gold: 3500,
      souls: 1000,
      attraction: 300,
      gems: 80,
      knowledge: 400,
      experience: 6000,
    },
    unlocked: false,
  },
  {
    id: 'jeju-island',
    name: '🏝️ Jeju Island Raid',
    description: 'The legendary S-rank raid against the Ant King. The ultimate challenge.',
    type: 'alliance',
    rank: 'S',
    requiredLevel: 50,
    duration: 360, // 6 minutes
    rewards: {
      essence: 5000,
      crystals: 4000,
      gold: 10000,
      souls: 3000,
      attraction: 1000,
      gems: 300,
      knowledge: 1500,
      experience: 20000,
    },
    unlocked: false,
  },
];

