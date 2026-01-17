import { createStore } from '@ts-query/core';
import type { Hunter, HunterStats } from './types';

export interface HunterState {
  hunter: Hunter;
  addXp: (amount: number, onLevelUp?: (newLevel: number) => void) => void;
  allocateStat: (stat: keyof HunterStats) => void;
  reset: () => void;
}

// Helper functions for hunter calculations
const calculateXpToNextLevel = (level: number): number => {
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

const calculateRank = (level: number): string => {
  if (level >= 100) return 'National Level';
  if (level >= 50) return 'S-Rank';
  if (level >= 40) return 'A-Rank';
  if (level >= 30) return 'B-Rank';
  if (level >= 20) return 'C-Rank';
  if (level >= 10) return 'D-Rank';
  return 'E-Rank';
};

const calculateMaxHp = (vitality: number, level: number): number => {
  return 100 + vitality * 10 + level * 5;
};

const calculateMaxMana = (intelligence: number, level: number): number => {
  return 50 + intelligence * 5 + level * 3;
};

const createInitialHunter = (): Hunter => ({
  level: 1,
  xp: 0,
  xpToNextLevel: calculateXpToNextLevel(1),
  rank: 'E-Rank',
  stats: {
    strength: 10,
    agility: 10,
    intelligence: 10,
    vitality: 10,
    sense: 10,
  },
  statPoints: 0,
  hp: 150,
  maxHp: 150,
  mana: 80,
  maxMana: 80,
});

const STORAGE_KEY = 'arise-hunter-storage';

const loadPersistedState = (): Partial<HunterState> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load hunter state:', error);
  }
  return null;
};

const persistState = (state: HunterState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hunter: state.hunter }));
  } catch (error) {
    console.error('Failed to persist hunter state:', error);
  }
};

export const useHunterStore = createStore<HunterState>((set) => {
  const persisted = loadPersistedState();
  const initialState = {
    hunter: persisted?.hunter || createInitialHunter(),
  };

  const store: HunterState = {
    ...initialState,

    addXp: (amount, onLevelUp) => {
      set((state) => {
        let newXp = state.hunter.xp + amount;
        let newLevel = state.hunter.level;
        let newStatPoints = state.hunter.statPoints;
        let xpToNextLevel = state.hunter.xpToNextLevel;
        let leveledUp = false;

        // Handle level ups
        while (newXp >= xpToNextLevel) {
          newXp -= xpToNextLevel;
          newLevel += 1;
          newStatPoints += 3; // 3 stat points per level
          xpToNextLevel = calculateXpToNextLevel(newLevel);
          leveledUp = true;
        }

        const newRank = calculateRank(newLevel);
        const newMaxHp = calculateMaxHp(state.hunter.stats.vitality, newLevel);
        const newMaxMana = calculateMaxMana(state.hunter.stats.intelligence, newLevel);

        if (leveledUp && onLevelUp) {
          onLevelUp(newLevel);
        }

        const newState = {
          ...state,
          hunter: {
            ...state.hunter,
            level: newLevel,
            xp: newXp,
            xpToNextLevel,
            rank: newRank,
            statPoints: newStatPoints,
            maxHp: newMaxHp,
            hp: Math.min(state.hunter.hp, newMaxHp),
            maxMana: newMaxMana,
            mana: Math.min(state.hunter.mana, newMaxMana),
          },
        };

        persistState(newState);
        return newState;
      });
    },

    allocateStat: (stat) => {
      set((state) => {
        if (state.hunter.statPoints <= 0) return state;

        const newStats = {
          ...state.hunter.stats,
          [stat]: state.hunter.stats[stat] + 1,
        };

        const newMaxHp = calculateMaxHp(newStats.vitality, state.hunter.level);
        const newMaxMana = calculateMaxMana(newStats.intelligence, state.hunter.level);

        const newState = {
          ...state,
          hunter: {
            ...state.hunter,
            stats: newStats,
            statPoints: state.hunter.statPoints - 1,
            maxHp: newMaxHp,
            hp: stat === 'vitality' ? newMaxHp : state.hunter.hp,
            maxMana: newMaxMana,
            mana: stat === 'intelligence' ? newMaxMana : state.hunter.mana,
          },
        };

        persistState(newState);
        return newState;
      });
    },

    reset: () => {
      set({ hunter: createInitialHunter() });
      localStorage.removeItem(STORAGE_KEY);
    },
  };

  return store;
});

