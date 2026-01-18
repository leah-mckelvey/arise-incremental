import { createStore } from '@ts-query/core';
import type { Shadow } from './types';

const STORAGE_KEY = 'arise-shadows-state';

// Counter to ensure unique shadow IDs even when extracted in the same millisecond
let shadowIdCounter = 0;

export interface ShadowsState {
  shadows: Shadow[];
  necromancerUnlocked: boolean; // Unlocks at level 40
  
  // Actions
  extractShadow: (name: string, dungeonId: string) => Shadow;
  addXpToShadow: (shadowId: string, xp: number, onLevelUp?: (newLevel: number) => void) => void;
  getShadowsForDungeon: (dungeonId: string) => Shadow[];
  unlockNecromancer: () => void;
  reset: () => void;
}

const getInitialState = () => ({
  shadows: [] as Shadow[],
  necromancerUnlocked: false,
});

const loadPersistedState = (): Partial<ShadowsState> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load shadows state:', error);
  }
  return null;
};

const persistState = (state: ShadowsState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      shadows: state.shadows,
      necromancerUnlocked: state.necromancerUnlocked,
    }));
  } catch (error) {
    console.error('Failed to persist shadows state:', error);
  }
};

const calculateXpToNextLevel = (level: number): number => {
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

export const useShadowsStore = createStore<ShadowsState>((set, get) => {
  const persisted = loadPersistedState();
  const initial = getInitialState();

  const store: ShadowsState = {
    shadows: persisted?.shadows ?? initial.shadows,
    necromancerUnlocked: persisted?.necromancerUnlocked ?? initial.necromancerUnlocked,

    extractShadow: (name, dungeonId) => {
      if (!get().necromancerUnlocked) {
        console.warn('Cannot extract shadows - Necromancer not unlocked');
        return {} as Shadow;
      }

      // Check if this shadow already exists (by name)
      const existingShadow = get().shadows.find((s) => s.name === name);
      if (existingShadow) {
        console.warn(`Shadow ${name} already extracted`);
        return existingShadow;
      }

      const newShadow: Shadow = {
        id: `shadow-${Date.now()}-${shadowIdCounter++}`,
        name,
        type: 'shadow',
        originDungeonId: dungeonId,
        level: 1,
        xp: 0,
        xpToNextLevel: calculateXpToNextLevel(1),
      };

      set((state) => ({
        shadows: [...state.shadows, newShadow],
      }));

      console.log(`👻 Extracted shadow: ${name} from ${dungeonId}`);
      return newShadow;
    },

    addXpToShadow: (shadowId, xp, onLevelUp) => {
      set((state) => {
        const shadowIndex = state.shadows.findIndex((s) => s.id === shadowId);
        if (shadowIndex === -1) return state;

        const shadow = { ...state.shadows[shadowIndex] };
        shadow.xp += xp;

        // Check for level ups
        while (shadow.xp >= shadow.xpToNextLevel) {
          shadow.xp -= shadow.xpToNextLevel;
          shadow.level += 1;
          shadow.xpToNextLevel = calculateXpToNextLevel(shadow.level);
          
          console.log(`⭐ ${shadow.name} leveled up to ${shadow.level}!`);
          if (onLevelUp) {
            onLevelUp(shadow.level);
          }
        }

        const newShadows = [...state.shadows];
        newShadows[shadowIndex] = shadow;

        return { shadows: newShadows };
      });
    },

    getShadowsForDungeon: (dungeonId) => {
      return get().shadows.filter((shadow) => shadow.originDungeonId === dungeonId);
    },

    unlockNecromancer: () => {
      set({ necromancerUnlocked: true });
      console.log('🌑 Necromancer unlocked! You can now extract shadows from solo dungeons.');
    },

    reset: () => {
      set(getInitialState());
    },
  };

  return store;
});

// Subscribe to persist state changes (wrapped in setTimeout to avoid circular dependency)
setTimeout(() => {
  useShadowsStore.subscribe((state) => {
    persistState(state);
  });
}, 0);

