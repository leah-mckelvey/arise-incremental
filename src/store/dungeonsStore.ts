import { createStore } from '@ts-query/core';
import type { Dungeon, ActiveDungeon, DungeonRewards } from './types';
import { initialDungeons } from '../data/initialDungeons';

const STORAGE_KEY = 'arise-dungeons-state';

export interface DungeonsState {
  dungeons: Dungeon[];
  activeDungeon: ActiveDungeon | null;

  // Actions
  startDungeon: (dungeonId: string, currentTime: number, onSuccess: () => void) => void;
  completeDungeon: (currentTime: number, onSuccess: (rewards: DungeonRewards, dungeonName: string) => void) => void;
  cancelDungeon: () => void;
  unlockDungeon: (dungeonId: string) => void;
  reset: () => void;
}

const getInitialState = () => ({
  dungeons: JSON.parse(JSON.stringify(initialDungeons)) as Dungeon[], // Deep copy to avoid mutations
  activeDungeon: null as ActiveDungeon | null,
});

const loadPersistedState = (): Partial<DungeonsState> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load dungeons state:', error);
  }
  return null;
};

const persistState = (state: DungeonsState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      dungeons: state.dungeons,
      activeDungeon: state.activeDungeon,
    }));
  } catch (error) {
    console.error('Failed to persist dungeons state:', error);
  }
};

export const useDungeonsStore = createStore<DungeonsState>((set, get) => {
  const persisted = loadPersistedState();
  const initialState = getInitialState();

  const store: DungeonsState = {
    dungeons: persisted?.dungeons || initialState.dungeons,
    activeDungeon: persisted?.activeDungeon || initialState.activeDungeon,

    startDungeon: (dungeonId, currentTime, onSuccess) => {
      const state = get();

      if (state.activeDungeon) {
        console.warn('Already in a dungeon');
        return;
      }

      const dungeon = state.dungeons.find((d) => d.id === dungeonId);
      if (!dungeon) {
        console.warn('Dungeon not found');
        return;
      }

      if (!dungeon.unlocked) {
        console.warn('Dungeon not unlocked');
        return;
      }

      const activeDungeon: ActiveDungeon = {
        dungeonId,
        startTime: currentTime,
        endTime: currentTime + dungeon.duration * 1000, // Convert to ms
      };

      console.log(`🏰 Started dungeon: ${dungeon.name} (${dungeon.duration}s)`);

      set({ activeDungeon });
      onSuccess();
    },

    completeDungeon: (currentTime, onSuccess) => {
      const state = get();

      if (!state.activeDungeon) {
        console.warn('No active dungeon');
        return;
      }

      if (currentTime < state.activeDungeon.endTime) {
        console.warn('Dungeon not complete yet');
        return;
      }

      const dungeon = state.dungeons.find((d) => d.id === state.activeDungeon!.dungeonId);
      if (!dungeon) {
        console.warn('Dungeon not found');
        return;
      }

      console.log(`✅ Completed dungeon: ${dungeon.name}`);
      console.log('Rewards:', dungeon.rewards);

      const rewards = dungeon.rewards;
      const dungeonName = dungeon.name;
      set({ activeDungeon: null });
      onSuccess(rewards, dungeonName);
    },

    cancelDungeon: () => {
      console.log('❌ Cancelled dungeon');
      set({ activeDungeon: null });
    },

    unlockDungeon: (dungeonId) => {
      set((state) => {
        const dungeon = state.dungeons.find((d) => d.id === dungeonId);
        if (dungeon && !dungeon.unlocked) {
          dungeon.unlocked = true;
          console.log(`🔓 Unlocked dungeon: ${dungeon.name}`);
        }
        return { dungeons: [...state.dungeons] };
      });
    },

    reset: () => {
      const freshState = getInitialState();
      set({
        dungeons: freshState.dungeons,
        activeDungeon: freshState.activeDungeon,
      });
    },
  };

  return store;
});

useDungeonsStore.subscribe((state) => {
  persistState(state);
});

