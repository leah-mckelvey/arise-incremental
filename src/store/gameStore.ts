import { createStore } from '@ts-query/core';
import type { Resources, ResourceCaps } from './types';
import { useBuildingsStore, type Building } from './buildingsStore';
import { useResearchStore, type Research } from './researchStore';
import { useHunterStore } from './hunterStore';

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
    essence: 100,
    crystals: 50,
    gold: 200,
    souls: 10,
    attraction: 25,
    gems: 10,
    knowledge: 100,
    ...partial,
  };
};

// Calculate total resource caps based on base caps + building bonuses + research
export const calculateResourceCaps = (
  buildings: Record<string, Building>,
  research: Record<string, Research>,
  hunterLevel: number = 1
): ResourceCaps => {
  const baseCaps = createResourceCaps();
  const caps = { ...baseCaps };

  // Add building cap increases
  Object.values(buildings).forEach((building) => {
    if (building.increasesCaps && building.count > 0) {
      (Object.keys(building.increasesCaps) as Array<keyof ResourceCaps>).forEach((resource) => {
        const increase = building.increasesCaps![resource];
        if (increase) {
          caps[resource] = caps[resource] + increase * building.count;
        }
      });
    }
  });
  
  // Apply research multipliers
  const researchedTechs = Object.values(research).filter(r => r.researched);
  researchedTechs.forEach(tech => {
    if (tech.effects?.capMultiplier) {
      Object.entries(tech.effects.capMultiplier).forEach(([resource, multiplier]) => {
        if (multiplier) {
          caps[resource as keyof ResourceCaps] *= multiplier;
        }
      });
    }
    
    if (tech.effects?.capIncrease) {
      Object.entries(tech.effects.capIncrease).forEach(([resource, increase]) => {
        if (increase) {
          caps[resource as keyof ResourceCaps] += increase;
        }
      });
    }
  });
  
  // Apply Transcendence: +10% caps per hunter level
  if (research.transcendence?.researched) {
    const levelMultiplier = 1 + (hunterLevel * 0.1);
    Object.keys(caps).forEach((resource) => {
      caps[resource as keyof ResourceCaps] *= levelMultiplier;
    });
  }

  return caps;
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

          const baseGatherAmounts: Record<typeof resource, number> = {
            essence: 1,
            crystals: 0.5,
            gold: 2,
          };

          const statBonuses: Record<typeof resource, keyof typeof hunter.stats> = {
            essence: 'sense',
            crystals: 'intelligence',
            gold: 'agility',
          };

          const baseStat = hunter.stats[statBonuses[resource]];
          let amount = baseGatherAmounts[resource] * (1 + baseStat / 100);

          // Apply research bonuses
          const researchedTechs = Object.values(research).filter(r => r.researched);
          researchedTechs.forEach(tech => {
            if (tech.effects?.gatheringBonus?.[resource]) {
              amount *= (1 + tech.effects.gatheringBonus[resource]!);
            }
          });

          get().addResource(resource, amount);

          // Add XP for gathering
          const xpGain = 0.1 * (1 + baseStat / 200);
          useHunterStore.getState().addXp(xpGain, (newLevel) => {
            // Recalculate caps when leveling up (for transcendence)
            const buildings = useBuildingsStore.getState().buildings;
            const research = useResearchStore.getState().research;
            set({
              resourceCaps: calculateResourceCaps(buildings, research, newLevel),
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
          const researchedTechs = Object.values(research).filter(r => r.researched);

          // Calculate global multipliers
          let globalProductionMultiplier = 1.0;

          if (research.shadowEconomy?.researched) {
            globalProductionMultiplier *= (1 + state.resources.souls * 0.01);
          }

          if (research.knowledgeLoop?.researched) {
            const knowledgeBonus = Math.floor(state.resources.knowledge / 100) * 0.05;
            globalProductionMultiplier *= (1 + knowledgeBonus);
          }

          if (research.transcendence?.researched) {
            globalProductionMultiplier *= (1 + hunter.level * 0.01);
          }

          const resourceGains: Resources = createResources();
          let xpGain = 0;

          // Add production from buildings
          Object.values(buildings).forEach((building) => {
            if (building.produces && building.perSecond) {
              (Object.keys(building.produces) as Array<keyof Resources>).forEach((resource) => {
                const amount = building.produces![resource];
                if (amount) {
                  let production = amount * building.count * building.perSecond! * deltaTime;

                  // Apply building efficiency bonuses
                  researchedTechs.forEach(tech => {
                    if (tech.effects?.buildingEfficiency?.[building.id]) {
                      production *= tech.effects.buildingEfficiency[building.id];
                    }
                  });

                  // Apply synergies
                  if (building.id === 'essenceExtractor' && research.manaResonance?.researched) {
                    const crystalMines = buildings.crystalMine?.count || 0;
                    production *= (1 + crystalMines * 0.25);
                  }

                  if (building.id === 'crystalMine' && research.crystalSynergy?.researched) {
                    const essenceVaults = buildings.essenceVault?.count || 0;
                    production *= (1 + essenceVaults * 0.1);
                  }

                  if (building.id === 'hunterGuild' && research.guildNetwork?.researched) {
                    const guildCount = buildings.hunterGuild?.count || 0;
                    production *= (1 + (guildCount - 1) * 0.05);
                  }

                  production *= globalProductionMultiplier;
                  resourceGains[resource as keyof Resources] += production;
                }
              });
            }

            if (building.xpPerSecond) {
              xpGain += building.count * building.xpPerSecond * deltaTime;
            }

            // Knowledge generation
            if (building.id === 'trainingGround' && research.knowledgeGeneration?.researched) {
              let knowledgeProduction = building.count * 0.1 * deltaTime;

              if (research.compoundedLearning?.researched) {
                knowledgeProduction *= Math.pow(1.1, building.count);
              }

              resourceGains.knowledge += knowledgeProduction;
            }
          });

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

          if (xpGain > 0) {
            useHunterStore.getState().addXp(xpGain, (newLevel) => {
              const buildings = useBuildingsStore.getState().buildings;
              const research = useResearchStore.getState().research;
              set({
                resourceCaps: calculateResourceCaps(buildings, research, newLevel),
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
          // Note: Substores handle their own reset via localStorage clear
        },
      };

      return store;
    });

// Coordinated purchase functions that update multiple stores
export const purchaseBuilding = (buildingId: string) => {
  const resources = gameStore.getState().resources;
  const research = useResearchStore.getState().research;
  const hunter = useHunterStore.getState().hunter;

  useBuildingsStore.getState().purchaseBuilding(buildingId, resources, (cost, newBuildings) => {
    // Deduct resources
    gameStore.setState({
      resources: createResources({
        essence: resources.essence - cost.essence,
        crystals: resources.crystals - cost.crystals,
        gold: resources.gold - cost.gold,
        souls: resources.souls - cost.souls,
        attraction: resources.attraction - cost.attraction,
        gems: resources.gems - cost.gems,
        knowledge: resources.knowledge - cost.knowledge,
      }),
      resourceCaps: calculateResourceCaps(newBuildings, research, hunter.level),
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
      resourceCaps: calculateResourceCaps(buildings, newResearch, hunter.level),
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

