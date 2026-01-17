import { createStore } from '@ts-query/core';
import type { Resources, ResourceCaps } from './types';
import { useBuildingsStore, type Building } from './buildingsStore';
import { useResearchStore, type Research } from './researchStore';
import { useHunterStore } from './hunterStore';
import {
  calculateResourceCaps,
  calculateGatherAmount,
  calculateGatherXp,
  calculateTickGains
} from '../lib/calculations/resourceCalculations';
import { deductCost } from '../lib/calculations/buildingCalculations';
import { baseResourceCaps } from '../data/initialHunter';

// Main game state (resources, caps, tick)
export interface GameState {
  version: number;
  resources: Resources;
  resourceCaps: ResourceCaps;
  lastUpdate: number;

  // Actions
  addResource: (resource: keyof Resources, amount: number) => void;
  gatherResource: (resource: 'essence' | 'crystals' | 'gold') => void;
  tick: () => void;
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

// Helper to create resource caps with defaults
const createResourceCaps = (partial: Partial<ResourceCaps> = {}): ResourceCaps => {
  return {
    ...baseResourceCaps,
    ...partial,
  };
};

// Current schema version
const CURRENT_VERSION = 2;

// Initial state
const initialState = {
  version: CURRENT_VERSION,
  resources: createResources(),
  resourceCaps: createResourceCaps(),
  lastUpdate: Date.now(),
};

// Deep merge helper
const deepMerge = <T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T => {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      result[key] = source[key] as T[Extract<keyof T, string>];
    }
  }
  return result;
};

const STORAGE_KEY = 'arise-game-storage';

const loadPersistedState = (): Partial<GameState> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load game state:', error);
  }
  return null;
};

const persistState = (state: GameState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: state.version,
      resources: state.resources,
      resourceCaps: state.resourceCaps,
      lastUpdate: state.lastUpdate,
    }));
  } catch (error) {
    console.error('Failed to persist game state:', error);
  }
};

export const gameStore = createStore<GameState>((set, get) => {
  const persisted = loadPersistedState();
  const mergedState = persisted && persisted.version === CURRENT_VERSION
    ? deepMerge(initialState, persisted)
    : initialState;

  const store: GameState = {
    ...mergedState,

        addResource: (resource: keyof Resources, amount: number) => {
          set((state) => {
            const newAmount = state.resources[resource] + amount;
            const cap = state.resourceCaps[resource];
            return {
              resources: {
                ...state.resources,
                [resource]: Math.max(0, Math.min(cap, newAmount)),
              },
            };
          });
        },

        gatherResource: (resource: 'essence' | 'crystals' | 'gold') => {
          const hunter = useHunterStore.getState().hunter;
          const research = useResearchStore.getState().research;

          // Use calculation library for gathering
          const amount = calculateGatherAmount(resource, hunter.stats, research);
          get().addResource(resource, amount);

          // Add XP for gathering
          const xpGain = calculateGatherXp(resource, hunter.stats);
          useHunterStore.getState().addXp(xpGain, (newLevel) => {
            // Recalculate caps when leveling up (for transcendence)
            const buildings = useBuildingsStore.getState().buildings;
            const research = useResearchStore.getState().research;
            set({
              resourceCaps: calculateResourceCaps(baseResourceCaps, buildings, research, newLevel),
            });
          });
        },

        tick: () => {
          const state = get();
          const now = Date.now();
          const deltaTime = Math.max(0, (now - state.lastUpdate) / 1000);

          const buildings = useBuildingsStore.getState().buildings;
          const research = useResearchStore.getState().research;
          const hunter = useHunterStore.getState().hunter;

          // Use calculation library to compute all gains
          const { resourceGains, xpGain } = calculateTickGains(
            buildings,
            research,
            state.resources,
            hunter.level,
            deltaTime
          );

          // Apply resource gains with caps
          set((state) => ({
            resources: createResources({
              essence: Math.min(state.resourceCaps.essence, state.resources.essence + resourceGains.essence),
              crystals: Math.min(state.resourceCaps.crystals, state.resources.crystals + resourceGains.crystals),
              gold: Math.min(state.resourceCaps.gold, state.resources.gold + resourceGains.gold),
              souls: Math.min(state.resourceCaps.souls, state.resources.souls + resourceGains.souls),
              attraction: Math.min(state.resourceCaps.attraction, state.resources.attraction + resourceGains.attraction),
              gems: Math.min(state.resourceCaps.gems, state.resources.gems + resourceGains.gems),
              knowledge: Math.min(state.resourceCaps.knowledge, state.resources.knowledge + resourceGains.knowledge),
            }),
            lastUpdate: now,
          }));

          // Apply XP gain and recalculate caps on level up
          if (xpGain > 0) {
            useHunterStore.getState().addXp(xpGain, (newLevel) => {
              const buildings = useBuildingsStore.getState().buildings;
              const research = useResearchStore.getState().research;
              set({
                resourceCaps: calculateResourceCaps(baseResourceCaps, buildings, research, newLevel),
              });
            });
          }
        },

        reset: () => {
          set({
            resources: createResources(),
            resourceCaps: createResourceCaps(),
            lastUpdate: Date.now(),
          });
          persistState(get());
          // Reset all substores
          useBuildingsStore.getState().reset();
          useResearchStore.getState().reset();
          useHunterStore.getState().reset();
        },
      };

      return store;
    });

// Subscribe to state changes to persist automatically
gameStore.subscribe((state) => {
  persistState(state);
});

// Coordinated purchase functions that update multiple stores
export const purchaseBuilding = (buildingId: string) => {
  const resources = gameStore.getState().resources;
  const research = useResearchStore.getState().research;
  const hunter = useHunterStore.getState().hunter;

  useBuildingsStore.getState().purchaseBuilding(buildingId, resources, (cost, newBuildings) => {
    // Deduct resources using calculation library
    gameStore.setState({
      resources: deductCost(resources, cost),
      resourceCaps: calculateResourceCaps(baseResourceCaps, newBuildings, research, hunter.level),
    });
  });
};

export const purchaseResearch = (researchId: string) => {
  const resources = gameStore.getState().resources;
  const buildings = useBuildingsStore.getState().buildings;
  const hunter = useHunterStore.getState().hunter;

  useResearchStore.getState().purchaseResearch(researchId, resources.knowledge, (cost, newResearch) => {
    // Deduct knowledge
    gameStore.setState({
      resources: createResources({
        ...resources,
        knowledge: resources.knowledge - cost,
      }),
      resourceCaps: calculateResourceCaps(baseResourceCaps, buildings, newResearch, hunter.level),
    });
  });
};

export const allocateStat = (stat: keyof import('./types').HunterStats) => {
  useHunterStore.getState().allocateStat(stat);
};

// Re-export types and helpers
export type { Resources, ResourceCaps, Building, Research };
export { createResources };
export { getBuildingCost, canAffordBuilding } from './buildingsStore';
export { useBuildingsStore, useResearchStore, useHunterStore };

