import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Game resource types
export interface Resources {
  catnip: number;
  wood: number;
  minerals: number;
  science: number;
}

// Building types
export interface Building {
  id: string;
  name: string;
  count: number;
  baseCost: Resources;
  costMultiplier: number;
  produces?: Partial<Resources>;
  perSecond?: number;
}

// Game state
export interface GameState {
  resources: Resources;
  buildings: Record<string, Building>;
  lastUpdate: number;
  
  // Actions
  addResource: (resource: keyof Resources, amount: number) => void;
  purchaseBuilding: (buildingId: string) => void;
  tick: () => void;
  reset: () => void;
}

// Initial building definitions
const initialBuildings: Record<string, Building> = {
  catnipField: {
    id: 'catnipField',
    name: 'Catnip Field',
    count: 0,
    baseCost: { catnip: 10, wood: 0, minerals: 0, science: 0 },
    costMultiplier: 1.15,
    produces: { catnip: 1 },
    perSecond: 0.1,
  },
  hut: {
    id: 'hut',
    name: 'Hut',
    count: 0,
    baseCost: { catnip: 50, wood: 5, minerals: 0, science: 0 },
    costMultiplier: 1.15,
  },
  logHouse: {
    id: 'logHouse',
    name: 'Log House',
    count: 0,
    baseCost: { catnip: 0, wood: 200, minerals: 250, science: 0 },
    costMultiplier: 1.15,
  },
  library: {
    id: 'library',
    name: 'Library',
    count: 0,
    baseCost: { catnip: 0, wood: 25, minerals: 0, science: 0 },
    costMultiplier: 1.15,
    produces: { science: 1 },
    perSecond: 0.05,
  },
  mine: {
    id: 'mine',
    name: 'Mine',
    count: 0,
    baseCost: { catnip: 0, wood: 100, minerals: 0, science: 0 },
    costMultiplier: 1.15,
    produces: { minerals: 1 },
    perSecond: 0.2,
  },
};

// Calculate building cost based on count
const calculateCost = (building: Building): Resources => {
  const multiplier = Math.pow(building.costMultiplier, building.count);
  return {
    catnip: Math.floor(building.baseCost.catnip * multiplier),
    wood: Math.floor(building.baseCost.wood * multiplier),
    minerals: Math.floor(building.baseCost.minerals * multiplier),
    science: Math.floor(building.baseCost.science * multiplier),
  };
};

// Check if player can afford a building
const canAfford = (resources: Resources, cost: Resources): boolean => {
  return (
    resources.catnip >= cost.catnip &&
    resources.wood >= cost.wood &&
    resources.minerals >= cost.minerals &&
    resources.science >= cost.science
  );
};

// Initial state
const initialState = {
  resources: {
    catnip: 0,
    wood: 0,
    minerals: 0,
    science: 0,
  },
  buildings: initialBuildings,
  lastUpdate: Date.now(),
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialState,

      addResource: (resource: keyof Resources, amount: number) => {
        set((state) => ({
          resources: {
            ...state.resources,
            [resource]: Math.max(0, state.resources[resource] + amount),
          },
        }));
      },

      purchaseBuilding: (buildingId: string) => {
        const state = get();
        const building = state.buildings[buildingId];
        if (!building) return;

        const cost = calculateCost(building);
        if (!canAfford(state.resources, cost)) return;

        set((state) => ({
          resources: {
            catnip: state.resources.catnip - cost.catnip,
            wood: state.resources.wood - cost.wood,
            minerals: state.resources.minerals - cost.minerals,
            science: state.resources.science - cost.science,
          },
          buildings: {
            ...state.buildings,
            [buildingId]: {
              ...building,
              count: building.count + 1,
            },
          },
        }));
      },

      tick: () => {
        const state = get();
        const now = Date.now();
        const deltaTime = (now - state.lastUpdate) / 1000; // Convert to seconds

        // Calculate resource generation
        const resourceGains: Resources = {
          catnip: 0,
          wood: 0,
          minerals: 0,
          science: 0,
        };

        // Add production from buildings
        Object.values(state.buildings).forEach((building) => {
          if (building.produces && building.perSecond) {
            Object.entries(building.produces).forEach(([resource, amount]) => {
              if (amount) {
                resourceGains[resource as keyof Resources] +=
                  amount * building.count * building.perSecond! * deltaTime;
              }
            });
          }
        });

        set((state) => ({
          resources: {
            catnip: state.resources.catnip + resourceGains.catnip,
            wood: state.resources.wood + resourceGains.wood,
            minerals: state.resources.minerals + resourceGains.minerals,
            science: state.resources.science + resourceGains.science,
          },
          lastUpdate: now,
        }));
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'arise-incremental-storage',
    }
  )
);

// Helper function to get current building cost
export const getBuildingCost = (building: Building): Resources => {
  return calculateCost(building);
};

// Helper function to check affordability
export const canAffordBuilding = (
  resources: Resources,
  building: Building
): boolean => {
  return canAfford(resources, calculateCost(building));
};
