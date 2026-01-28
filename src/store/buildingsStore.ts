import { createStore } from "@ts-query/core";
import type { Resources, ResourceCaps } from "./types";
import {
  calculateBuildingCost,
  canAffordCost,
} from "../lib/calculations/buildingCalculations";
import { calculateBulkBuildingCost } from "../lib/calculations/resourceCalculations";
import { initialBuildings } from "../data/initialBuildings";

// Building types
export interface Building {
  id: string;
  name: string;
  description?: string;
  count: number;
  baseCost: Resources;
  costMultiplier: number;
  produces?: Partial<Resources>;
  perSecond?: number;
  xpPerSecond?: number;
  increasesCaps?: Partial<ResourceCaps>;
}

export interface BuildingsState {
  buildings: Record<string, Building>;
  purchaseBuilding: (
    buildingId: string,
    getResources: () => Resources,
    onSuccess: (
      cost: Resources,
      newBuildings: Record<string, Building>,
    ) => void,
  ) => void;
  purchaseBuildingBulk: (
    buildingId: string,
    quantity: number,
    getResources: () => Resources,
    onSuccess: (
      cost: Resources,
      newBuildings: Record<string, Building>,
    ) => void,
  ) => void;
  reset: () => void;
}

const STORAGE_KEY = "arise-buildings-storage";

const loadPersistedState = (): Partial<BuildingsState> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load buildings state:", error);
  }
  return null;
};

const persistState = (state: BuildingsState) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ buildings: state.buildings }),
    );
  } catch (error) {
    console.error("Failed to persist buildings state:", error);
  }
};

export const useBuildingsStore = createStore<BuildingsState>((set, get) => {
  const persisted = loadPersistedState();
  const initialState = {
    buildings: persisted?.buildings || initialBuildings,
  };

  const store: BuildingsState = {
    ...initialState,

    purchaseBuilding: (buildingId, getResources, onSuccess) => {
      const building = get().buildings[buildingId];
      if (!building) return;

      const cost = calculateBuildingCost(building);
      // Get fresh resources at the moment of affordability check
      const resources = getResources();
      if (!canAffordCost(resources, cost)) return;

      const newBuildings = {
        ...get().buildings,
        [buildingId]: {
          ...building,
          count: building.count + 1,
        },
      };

      set((state) => {
        const newState = { ...state, buildings: newBuildings };
        persistState(newState);
        return newState;
      });

      onSuccess(cost, newBuildings);
    },

    purchaseBuildingBulk: (buildingId, quantity, getResources, onSuccess) => {
      const building = get().buildings[buildingId];
      if (!building || quantity <= 0) return;

      const cost = calculateBulkBuildingCost(building, quantity);
      // Get fresh resources at the moment of affordability check
      const resources = getResources();
      if (!canAffordCost(resources, cost)) return;

      const newBuildings = {
        ...get().buildings,
        [buildingId]: {
          ...building,
          count: building.count + quantity,
        },
      };

      set((state) => {
        const newState = { ...state, buildings: newBuildings };
        persistState(newState);
        return newState;
      });

      onSuccess(cost, newBuildings);
    },

    reset: () => {
      set({ buildings: initialBuildings });
      localStorage.removeItem(STORAGE_KEY);
    },
  };

  return store;
});

// Subscribe to persist state changes
useBuildingsStore.subscribe((state) => {
  persistState(state);
});

// Export helper functions
export {
  calculateBuildingCost as getBuildingCost,
  canAffordCost as canAffordBuilding,
};
