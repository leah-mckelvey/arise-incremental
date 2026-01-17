import { createStore } from '@ts-query/core';
import type { Resources, ResourceCaps, HunterStats } from './types';
import { useBuildingsStore, type Building } from './buildingsStore';
import { useResearchStore, type Research } from './researchStore';
import { useHunterStore } from './hunterStore';
import { useArtifactsStore } from './artifactsStore';
import {
  calculateResourceCaps,
  calculateGatherAmount,
  calculateGatherXp,
  calculateTickGains
} from '../lib/calculations/resourceCalculations';
import { calculateEquippedStatBonuses, applyArtifactBonuses } from '../lib/calculations/artifactCalculations';
import { deductCost } from '../lib/calculations/buildingCalculations';
import { baseResourceCaps } from '../data/initialHunter';
import { runMigrations, getCurrentVersion } from '../lib/migrations';

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

  // Dev mode
  devFillResources: () => void;
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

// Initial state
const initialState = {
  version: getCurrentVersion(),
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
      const parsed = JSON.parse(stored);

      // Validate resources - ensure no NaN values
      if (parsed.resources) {
        const resources = parsed.resources;
        const hasNaN = Object.values(resources).some((val) => typeof val === 'number' && isNaN(val));
        if (hasNaN) {
          console.warn('🔧 Corrupted resources detected in localStorage, resetting game state...', resources);
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
      }

      return parsed;
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
  // Run migrations before loading state
  runMigrations();

  const persisted = loadPersistedState();
  const mergedState = persisted && persisted.version === getCurrentVersion()
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
          const research = useResearchStore.getState().research;
          const effectiveStats = getEffectiveHunterStats();

          // Use calculation library for gathering (with artifact bonuses)
          const amount = calculateGatherAmount(resource, effectiveStats, research);
          get().addResource(resource, amount);

          // Add XP for gathering
          const xpGain = calculateGatherXp(resource, effectiveStats);
          useHunterStore.getState().addXp(xpGain, (newLevel) => {
            // Recalculate caps when leveling up (for transcendence and stat bonuses)
            const buildings = useBuildingsStore.getState().buildings;
            const research = useResearchStore.getState().research;
            const updatedEffectiveStats = getEffectiveHunterStats();
            set({
              resourceCaps: calculateResourceCaps(baseResourceCaps, buildings, research, newLevel, updatedEffectiveStats),
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
          const effectiveStats = getEffectiveHunterStats();

          // Use calculation library to compute all gains (with artifact bonuses)
          const { resourceGains, xpGain } = calculateTickGains(
            buildings,
            research,
            state.resources,
            hunter.level,
            deltaTime,
            effectiveStats
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
              const updatedEffectiveStats = getEffectiveHunterStats();
              set({
                resourceCaps: calculateResourceCaps(baseResourceCaps, buildings, research, newLevel, updatedEffectiveStats),
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
          useArtifactsStore.getState().reset();
        },

        devFillResources: () => {
          set((state) => ({
            resources: createResources({
              essence: state.resourceCaps.essence,
              crystals: state.resourceCaps.crystals,
              gold: state.resourceCaps.gold,
              souls: state.resourceCaps.souls,
              attraction: state.resourceCaps.attraction,
              gems: state.resourceCaps.gems,
              knowledge: state.resourceCaps.knowledge,
            }),
          }));
        },
      };

      return store;
    });

// Subscribe to state changes to persist automatically
gameStore.subscribe((state) => {
  persistState(state);
});

/**
 * Get effective hunter stats (base stats + artifact bonuses)
 */
export const getEffectiveHunterStats = (): HunterStats => {
  const hunter = useHunterStore.getState().hunter;
  const equipped = useArtifactsStore.getState().equipped;
  const artifactBonuses = calculateEquippedStatBonuses(equipped);
  return applyArtifactBonuses(hunter.stats, artifactBonuses);
};

// Coordinated purchase functions that update multiple stores
export const purchaseBuilding = (buildingId: string) => {
  const resources = gameStore.getState().resources;
  const research = useResearchStore.getState().research;
  const hunter = useHunterStore.getState().hunter;
  const effectiveStats = getEffectiveHunterStats();

  useBuildingsStore.getState().purchaseBuilding(buildingId, resources, (cost, newBuildings) => {
    // Get fresh resources in case they changed
    const currentResources = gameStore.getState().resources;
    const newResources = deductCost(currentResources, cost);

    // Deduct resources using calculation library (with artifact bonuses)
    gameStore.setState({
      resources: newResources,
      resourceCaps: calculateResourceCaps(baseResourceCaps, newBuildings, research, hunter.level, effectiveStats),
    });
  });
};

export const purchaseResearch = (researchId: string) => {
  const resources = gameStore.getState().resources;
  const buildings = useBuildingsStore.getState().buildings;
  const hunter = useHunterStore.getState().hunter;
  const effectiveStats = getEffectiveHunterStats();

  useResearchStore.getState().purchaseResearch(researchId, resources.knowledge, (cost, newResearch) => {
    // Get fresh resources in case they changed
    const currentResources = gameStore.getState().resources;

    // Deduct knowledge (with artifact bonuses)
    gameStore.setState({
      resources: createResources({
        ...currentResources,
        knowledge: currentResources.knowledge - cost,
      }),
      resourceCaps: calculateResourceCaps(baseResourceCaps, buildings, newResearch, hunter.level, effectiveStats),
    });
  });
};

export const allocateStat = (stat: keyof import('./types').HunterStats) => {
  useHunterStore.getState().allocateStat(stat);

  // Recalculate caps after stat allocation (stats + artifacts affect caps now)
  const buildings = useBuildingsStore.getState().buildings;
  const research = useResearchStore.getState().research;
  const hunter = useHunterStore.getState().hunter;
  const effectiveStats = getEffectiveHunterStats();

  gameStore.setState({
    resourceCaps: calculateResourceCaps(baseResourceCaps, buildings, research, hunter.level, effectiveStats),
  });
};

export const craftArtifact = (rank: import('./types').ArtifactRank, slot: import('./types').ArtifactSlot) => {
  const resources = gameStore.getState().resources;

  useArtifactsStore.getState().craftArtifact(rank, slot, resources, (cost) => {
    const currentResources = gameStore.getState().resources;
    const newResources = deductCost(currentResources, cost);
    gameStore.setState({ resources: newResources });

    // Grant blacksmith XP based on rank
    const xpGains: Record<import('./types').ArtifactRank, number> = {
      E: 10,
      D: 25,
      C: 50,
      B: 100,
      A: 200,
      S: 400,
    };
    useArtifactsStore.getState().addBlacksmithXp(xpGains[rank]);
  });
};

export const equipArtifact = (artifact: import('./types').Artifact) => {
  useArtifactsStore.getState().equipArtifact(artifact);

  // Recalculate caps after equipping (artifact stats affect caps)
  const buildings = useBuildingsStore.getState().buildings;
  const research = useResearchStore.getState().research;
  const hunter = useHunterStore.getState().hunter;
  const effectiveStats = getEffectiveHunterStats();

  gameStore.setState({
    resourceCaps: calculateResourceCaps(baseResourceCaps, buildings, research, hunter.level, effectiveStats),
  });
};

export const unequipArtifact = (slot: import('./types').ArtifactSlot) => {
  useArtifactsStore.getState().unequipArtifact(slot);

  // Recalculate caps after unequipping
  const buildings = useBuildingsStore.getState().buildings;
  const research = useResearchStore.getState().research;
  const hunter = useHunterStore.getState().hunter;
  const effectiveStats = getEffectiveHunterStats();

  gameStore.setState({
    resourceCaps: calculateResourceCaps(baseResourceCaps, buildings, research, hunter.level, effectiveStats),
  });
};

export const upgradeArtifact = (artifactId: string, upgradeId: string) => {
  const resources = gameStore.getState().resources;

  useArtifactsStore.getState().upgradeArtifact(artifactId, upgradeId, resources, (cost, blacksmithXpGain) => {
    const currentResources = gameStore.getState().resources;
    const newResources = deductCost(currentResources, cost);
    gameStore.setState({ resources: newResources });

    // Grant blacksmith XP for upgrading
    useArtifactsStore.getState().addBlacksmithXp(blacksmithXpGain);
  });
};

export const destroyArtifact = (artifactId: string) => {
  useArtifactsStore.getState().destroyArtifact(artifactId, (essenceGain) => {
    const currentResources = gameStore.getState().resources;
    gameStore.setState({
      resources: {
        ...currentResources,
        essence: currentResources.essence + essenceGain,
      },
    });
  });
};

export const destroyArtifactsUnderRank = (maxRank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S') => {
  useArtifactsStore.getState().destroyArtifactsUnderRank(maxRank, (essenceGain, count) => {
    const currentResources = gameStore.getState().resources;
    gameStore.setState({
      resources: {
        ...currentResources,
        essence: currentResources.essence + essenceGain,
      },
    });
    console.log(`✅ Destroyed ${count} artifacts for ${essenceGain} essence`);
  });
};

// Re-export types and helpers
export type { Resources, ResourceCaps, Building, Research };
export { createResources };
export { getBuildingCost, canAffordBuilding } from './buildingsStore';
export { useBuildingsStore, useResearchStore, useHunterStore, useArtifactsStore };

