import { createStore } from "@ts-query/core";
import type { Ally } from "./types";

const STORAGE_KEY = "arise-allies-state";

// Counter to ensure unique ally IDs even when recruited in the same millisecond
let allyIdCounter = 0;

export interface AlliesState {
  allies: Ally[];

  // Actions
  recruitAlly: (name: string, dungeonId: string) => Ally; // For named allies from dungeons (unique)
  recruitGenericAlly: (name: string, rank: string) => Ally; // For generic allies from attraction (can have multiples)
  addXpToAlly: (
    allyId: string,
    xp: number,
    onLevelUp?: (newLevel: number) => void,
  ) => void;
  getAlliesForDungeon: (dungeonId: string) => Ally[];
  reset: () => void;
}

const getInitialState = () => ({
  allies: [] as Ally[],
});

const loadPersistedState = (): Partial<AlliesState> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load allies state:", error);
  }
  return null;
};

const persistState = (state: AlliesState) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        allies: state.allies,
      }),
    );
  } catch (error) {
    console.error("Failed to persist allies state:", error);
  }
};

const calculateXpToNextLevel = (level: number): number => {
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

export const useAlliesStore = createStore<AlliesState>((set, get) => {
  const persisted = loadPersistedState();
  const initial = getInitialState();

  const store: AlliesState = {
    allies: persisted?.allies ?? initial.allies,

    recruitAlly: (name, dungeonId) => {
      // Check if this named ally already exists (by name and dungeonId)
      // Named allies from dungeons are unique
      const existingAlly = get().allies.find(
        (a) => a.name === name && a.originDungeonId === dungeonId,
      );
      if (existingAlly) {
        console.warn(`Named ally ${name} already recruited from ${dungeonId}`);
        return existingAlly;
      }

      const newAlly: Ally = {
        id: `ally-${Date.now()}-${allyIdCounter++}`,
        name,
        type: "ally",
        originDungeonId: dungeonId,
        level: 1,
        xp: 0,
        xpToNextLevel: calculateXpToNextLevel(1),
      };

      set((state) => ({
        allies: [...state.allies, newAlly],
      }));

      console.log(`🤝 Recruited named ally: ${name} from ${dungeonId}`);
      return newAlly;
    },

    recruitGenericAlly: (name, rank) => {
      // Generic allies can have multiples, so no duplicate check
      const newAlly: Ally = {
        id: `ally-${Date.now()}-${allyIdCounter++}`,
        name: `${name} #${get().allies.filter((a) => a.name.startsWith(name)).length + 1}`,
        type: "ally",
        originDungeonId: "recruited", // Mark as recruited with attraction
        level: 1,
        xp: 0,
        xpToNextLevel: calculateXpToNextLevel(1),
      };

      set((state) => ({
        allies: [...state.allies, newAlly],
      }));

      console.log(`🤝 Recruited generic ally: ${newAlly.name} (${rank})`);
      return newAlly;
    },

    addXpToAlly: (allyId, xp, onLevelUp) => {
      set((state) => {
        const allyIndex = state.allies.findIndex((a) => a.id === allyId);
        if (allyIndex === -1) return state;

        const ally = { ...state.allies[allyIndex] };
        ally.xp += xp;

        // Check for level ups
        while (ally.xp >= ally.xpToNextLevel) {
          ally.xp -= ally.xpToNextLevel;
          ally.level += 1;
          ally.xpToNextLevel = calculateXpToNextLevel(ally.level);

          console.log(`⭐ ${ally.name} leveled up to ${ally.level}!`);
          if (onLevelUp) {
            onLevelUp(ally.level);
          }
        }

        const newAllies = [...state.allies];
        newAllies[allyIndex] = ally;

        return { allies: newAllies };
      });
    },

    getAlliesForDungeon: (dungeonId) => {
      return get().allies.filter((ally) => ally.originDungeonId === dungeonId);
    },

    reset: () => {
      set(getInitialState());
    },
  };

  return store;
});

// Subscribe to persist state changes
useAlliesStore.subscribe((state) => {
  persistState(state);
});
