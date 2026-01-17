import { createStore } from '@ts-query/core';
import type { Resources, ResourceCaps } from './types';

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
  purchaseBuilding: (buildingId: string, resources: Resources, onSuccess: (cost: Resources, newBuildings: Record<string, Building>) => void) => void;
  reset: () => void;
}

// Helper to create full Resources object with defaults
const createResources = (partial: Partial<Resources> = {}): Resources => {
  return {
    essence: 0,
    crystals: 0,
    gold: 0,
    souls: 0,
    attraction: 0,
    gems: 0,
    knowledge: 0,
    ...partial,
  };
};

// Initial buildings
const initialBuildings: Record<string, Building> = {
  essenceExtractor: {
    id: 'essenceExtractor',
    name: '⚗️ Essence Extractor',
    description: 'Automatically extracts essence from the environment',
    count: 0,
    baseCost: createResources({ essence: 10 }),
    costMultiplier: 1.15,
    produces: { essence: 1 },
    perSecond: 0.1,
  },
  trainingGround: {
    id: 'trainingGround',
    name: '🏋️ Training Ground',
    description: 'Provides passive XP gain for your hunter',
    count: 0,
    baseCost: createResources({ essence: 50, gold: 25 }),
    costMultiplier: 1.15,
    xpPerSecond: 0.5,
  },
  hunterGuild: {
    id: 'hunterGuild',
    name: '🏛️ Hunter Guild',
    description: 'Generates attraction for recruiting allies',
    count: 0,
    baseCost: createResources({ crystals: 200, gold: 250 }),
    costMultiplier: 1.15,
    produces: { attraction: 1 },
    perSecond: 0.1,
  },
  mageTower: {
    id: 'mageTower',
    name: '🗼 Mage Tower',
    description: 'Produces rare gems through arcane rituals',
    count: 0,
    baseCost: createResources({ essence: 200, crystals: 100 }),
    costMultiplier: 1.15,
    produces: { gems: 1 },
    perSecond: 0.05,
  },
  crystalMine: {
    id: 'crystalMine',
    name: '💎 Crystal Mine',
    description: 'Extracts valuable crystals from dungeon depths',
    count: 0,
    baseCost: createResources({ essence: 100 }),
    costMultiplier: 1.15,
    produces: { crystals: 1 },
    perSecond: 0.2,
  },
  // Storage buildings
  essenceVault: {
    id: 'essenceVault',
    name: '📦 Essence Vault',
    description: 'Increases essence storage capacity',
    count: 0,
    baseCost: createResources({ essence: 50 }),
    costMultiplier: 1.12,
    increasesCaps: { essence: 50 },
  },
  crystalWarehouse: {
    id: 'crystalWarehouse',
    name: '🏪 Crystal Warehouse',
    description: 'Increases crystal storage capacity',
    count: 0,
    baseCost: createResources({ essence: 75, crystals: 25 }),
    costMultiplier: 1.12,
    increasesCaps: { crystals: 25 },
  },
  goldVault: {
    id: 'goldVault',
    name: '🏦 Gold Vault',
    description: 'Increases gold storage capacity',
    count: 0,
    baseCost: createResources({ essence: 100, gold: 50 }),
    costMultiplier: 1.12,
    increasesCaps: { gold: 100 },
  },
  // Advanced buildings (unlocked by research)
  soulHarvester: {
    id: 'soulHarvester',
    name: '👻 Soul Harvester',
    description: 'Harvests souls from defeated enemies. Each soul boosts all production by 1%',
    count: 0,
    baseCost: createResources({ essence: 500, crystals: 200, gold: 300 }),
    costMultiplier: 1.2,
    produces: { souls: 1 },
    perSecond: 0.05,
  },
};

// Calculate building cost based on count
const calculateCost = (building: Building): Resources => {
  const multiplier = Math.pow(building.costMultiplier, building.count);
  return createResources({
    essence: Math.floor(building.baseCost.essence * multiplier),
    crystals: Math.floor(building.baseCost.crystals * multiplier),
    gold: Math.floor(building.baseCost.gold * multiplier),
    souls: Math.floor(building.baseCost.souls * multiplier),
    attraction: Math.floor(building.baseCost.attraction * multiplier),
    gems: Math.floor(building.baseCost.gems * multiplier),
    knowledge: Math.floor(building.baseCost.knowledge * multiplier),
  });
};

// Check if player can afford a building
const canAfford = (resources: Resources, cost: Resources): boolean => {
  return (
    resources.essence >= cost.essence &&
    resources.crystals >= cost.crystals &&
    resources.gold >= cost.gold &&
    resources.souls >= cost.souls &&
    resources.attraction >= cost.attraction &&
    resources.gems >= cost.gems &&
    resources.knowledge >= cost.knowledge
  );
};

const STORAGE_KEY = 'arise-buildings-storage';

const loadPersistedState = (): Partial<BuildingsState> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load buildings state:', error);
  }
  return null;
};

const persistState = (state: BuildingsState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ buildings: state.buildings }));
  } catch (error) {
    console.error('Failed to persist buildings state:', error);
  }
};

export const useBuildingsStore = createStore<BuildingsState>((set, get) => {
  const persisted = loadPersistedState();
  const initialState = {
    buildings: persisted?.buildings || initialBuildings,
  };

  const store: BuildingsState = {
    ...initialState,

    purchaseBuilding: (buildingId, resources, onSuccess) => {
      const building = get().buildings[buildingId];
      if (!building) return;

      const cost = calculateCost(building);
      if (!canAfford(resources, cost)) return;

      set((state) => {
        const newBuildings = {
          ...state.buildings,
          [buildingId]: {
            ...building,
            count: building.count + 1,
          },
        };

        onSuccess(cost, newBuildings);
        const newState = { ...state, buildings: newBuildings };
        persistState(newState);
        return newState;
      });
    },

    reset: () => {
      set({ buildings: initialBuildings });
      localStorage.removeItem(STORAGE_KEY);
    },
  };

  return store;
});

// Export helper functions
export { calculateCost as getBuildingCost, canAfford as canAffordBuilding };

