import { createStore } from '@ts-query/core';
import type { Dungeon, ActiveDungeon, DungeonRewards } from './types';
import { initialDungeons } from '../data/initialDungeons';

const STORAGE_KEY = 'arise-dungeons-state';

export interface DungeonsState {
  dungeons: Dungeon[];
  activeDungeons: ActiveDungeon[]; // Changed to array for parallel runs

  // Actions
  startDungeon: (dungeonId: string, currentTime: number, partyIds: string[], onSuccess: () => void) => void;
  completeDungeon: (activeDungeonId: string, currentTime: number, onSuccess: (rewards: DungeonRewards, dungeonName: string, dungeon: Dungeon) => void) => void;
  cancelDungeon: (activeDungeonId: string) => void;
  unlockDungeon: (dungeonId: string) => void;
  reset: () => void;
}

const getInitialState = () => ({
  dungeons: JSON.parse(JSON.stringify(initialDungeons)) as Dungeon[], // Deep copy to avoid mutations
  activeDungeons: [] as ActiveDungeon[],
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
      activeDungeons: state.activeDungeons,
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
    activeDungeons: persisted?.activeDungeons || initialState.activeDungeons,

    startDungeon: (dungeonId, currentTime, partyIds, onSuccess) => {
      const state = get();

      const dungeon = state.dungeons.find((d) => d.id === dungeonId);
      if (!dungeon) {
        console.warn('Dungeon not found');
        return;
      }

      if (!dungeon.unlocked) {
        console.warn('Dungeon not unlocked');
        return;
      }

      // Check if any companions in the party are already assigned to another dungeon
      const busyCompanions = partyIds.filter((companionId) =>
        state.activeDungeons.some((ad) => ad.partyIds?.includes(companionId))
      );
      if (busyCompanions.length > 0) {
        console.warn('Some companions are already in another dungeon:', busyCompanions);
        return;
      }

      // Generate unique ID for this dungeon run
      const activeDungeonId = `${dungeonId}-${currentTime}-${Math.random().toString(36).substr(2, 9)}`;

      const activeDungeon: ActiveDungeon = {
        id: activeDungeonId,
        dungeonId,
        startTime: currentTime,
        endTime: currentTime + dungeon.duration * 1000, // Convert to ms
        partyIds,
      };

      console.log(`🏰 Started dungeon: ${dungeon.name} (${dungeon.duration}s) with ${partyIds.length} companion(s)`);

      set((state) => ({
        activeDungeons: [...state.activeDungeons, activeDungeon],
      }));
      onSuccess();
    },

    completeDungeon: (activeDungeonId, currentTime, onSuccess) => {
      const state = get();
      const activeDungeon = state.activeDungeons.find((ad) => ad.id === activeDungeonId);

      if (!activeDungeon) {
        console.warn('No active dungeon with that ID');
        return;
      }

      if (currentTime < activeDungeon.endTime) {
        console.warn('Dungeon not complete yet');
        return;
      }

      const dungeon = state.dungeons.find((d) => d.id === activeDungeon.dungeonId);
      if (!dungeon) {
        console.warn('Dungeon not found');
        return;
      }

      console.log(`✅ Completed dungeon: ${dungeon.name}`);
      console.log('Rewards:', dungeon.rewards);

      const rewards = dungeon.rewards;
      const dungeonName = dungeon.name;

      // Remove this dungeon from active dungeons
      set((state) => ({
        activeDungeons: state.activeDungeons.filter((ad) => ad.id !== activeDungeonId),
      }));

      onSuccess(rewards, dungeonName, dungeon);
    },

    cancelDungeon: (activeDungeonId) => {
      console.log('❌ Cancelled dungeon:', activeDungeonId);
      set((state) => ({
        activeDungeons: state.activeDungeons.filter((ad) => ad.id !== activeDungeonId),
      }));
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
        activeDungeons: freshState.activeDungeons,
      });
    },
  };

  return store;
});

// Subscribe to persist state changes (wrapped in setTimeout to avoid circular dependency)
setTimeout(() => {
  useDungeonsStore.subscribe((state) => {
    persistState(state);
  });
}, 0);

