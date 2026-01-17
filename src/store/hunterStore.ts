import { createStore } from '@ts-query/core';
import type { Hunter, HunterStats } from './types';
import { processXpGain, calculateStatAllocation } from '../lib/calculations/hunterCalculations';
import { createInitialHunter } from '../data/initialHunter';

export interface HunterState {
  hunter: Hunter;
  addXp: (amount: number, onLevelUp?: (newLevel: number) => void) => void;
  allocateStat: (stat: keyof HunterStats) => void;
  reset: () => void;
}

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
        const result = processXpGain(state.hunter, amount);

        if (result.leveledUp && onLevelUp && result.newLevel) {
          onLevelUp(result.newLevel);
        }

        const newState = {
          ...state,
          hunter: result.hunter,
        };

        persistState(newState);
        return newState;
      });
    },

    allocateStat: (stat) => {
      set((state) => {
        const result = calculateStatAllocation(state.hunter, stat);
        if (!result) return state;

        const newState = {
          ...state,
          hunter: result,
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

