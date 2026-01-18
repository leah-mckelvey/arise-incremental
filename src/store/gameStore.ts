import { createStore } from '@ts-query/core';
import type { Resources, ResourceCaps, HunterStats } from './types';
import { useBuildingsStore, type Building } from './buildingsStore';
import { useResearchStore, type Research } from './researchStore';
import { useHunterStore } from './hunterStore';
import { useArtifactsStore } from './artifactsStore';
import { useDungeonsStore } from './dungeonsStore';
import { useNotificationsStore } from './notificationsStore';
import { useAlliesStore } from './alliesStore';
import { useShadowsStore } from './shadowsStore';
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

// Deep merge helper - properly merges nested objects like resources and resourceCaps
const deepMerge = <T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T => {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      const sourceValue = source[key];
      const targetValue = result[key];

      // If both are plain objects, merge them recursively
      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
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
          useHunterStore.getState().addXp(xpGain, handleLevelUp);
        },

        tick: () => {
          const state = get();
          const now = Date.now();
          const deltaTime = Math.max(0, (now - state.lastUpdate) / 1000);

          const buildings = useBuildingsStore.getState().buildings;
          const research = useResearchStore.getState().research;
          const hunter = useHunterStore.getState().hunter;
          const effectiveStats = getEffectiveHunterStats();

          // Check for dungeon completion
          checkDungeonCompletion();

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
            useHunterStore.getState().addXp(xpGain, handleLevelUp);
          }
        },

        reset: () => {
          // Reset all substores first
          useBuildingsStore.getState().reset();
          useResearchStore.getState().reset();
          useHunterStore.getState().reset();
          useArtifactsStore.getState().reset();
          useDungeonsStore.getState().reset();
          useAlliesStore.getState().reset();
          useShadowsStore.getState().reset();

          // Recalculate caps with fresh hunter stats and buildings
          const buildings = useBuildingsStore.getState().buildings;
          const research = useResearchStore.getState().research;
          const hunter = useHunterStore.getState().hunter;
          const effectiveStats = getEffectiveHunterStats();

          set({
            resources: createResources(),
            resourceCaps: calculateResourceCaps(baseResourceCaps, buildings, research, hunter.level, effectiveStats),
            lastUpdate: Date.now(),
          });
          persistState(get());
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
  const research = useResearchStore.getState().research;
  const hunter = useHunterStore.getState().hunter;
  const effectiveStats = getEffectiveHunterStats();

  useBuildingsStore.getState().purchaseBuilding(buildingId, () => gameStore.getState().resources, (cost, newBuildings) => {
    // Get fresh resources and deduct cost
    const currentResources = gameStore.getState().resources;
    const newResources = deductCost(currentResources, cost);

    // Deduct resources using calculation library (with artifact bonuses)
    gameStore.setState({
      resources: newResources,
      resourceCaps: calculateResourceCaps(baseResourceCaps, newBuildings, research, hunter.level, effectiveStats),
    });
  });
};

export const purchaseBuildingBulk = (buildingId: string, quantity: number) => {
  const research = useResearchStore.getState().research;
  const hunter = useHunterStore.getState().hunter;
  const effectiveStats = getEffectiveHunterStats();

  useBuildingsStore.getState().purchaseBuildingBulk(buildingId, quantity, () => gameStore.getState().resources, (cost, newBuildings) => {
    // Get fresh resources and deduct cost
    const currentResources = gameStore.getState().resources;
    const newResources = deductCost(currentResources, cost);

    // Deduct resources
    gameStore.setState({
      resources: newResources,
      resourceCaps: calculateResourceCaps(baseResourceCaps, newBuildings, research, hunter.level, effectiveStats),
    });
  });
};

export const purchaseResearch = (researchId: string) => {
  const buildings = useBuildingsStore.getState().buildings;
  const hunter = useHunterStore.getState().hunter;
  const effectiveStats = getEffectiveHunterStats();

  useResearchStore.getState().purchaseResearch(researchId, () => gameStore.getState().resources.knowledge, (cost, newResearch) => {
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

export const craftArtifactBulk = (rank: import('./types').ArtifactRank, slot: import('./types').ArtifactSlot, quantity: number) => {
  for (let i = 0; i < quantity; i++) {
    craftArtifact(rank, slot);
  }
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

export const upgradeArtifactBulk = (artifactId: string, upgradeId: string, quantity: number) => {
  for (let i = 0; i < quantity; i++) {
    upgradeArtifact(artifactId, upgradeId);
  }
};

export const destroyArtifact = (artifactId: string) => {
  useArtifactsStore.getState().destroyArtifact(artifactId, (essenceGain) => {
    const currentResources = gameStore.getState().resources;
    const currentCaps = gameStore.getState().resourceCaps;
    gameStore.setState({
      resources: {
        ...currentResources,
        essence: Math.min(currentCaps.essence, currentResources.essence + essenceGain),
      },
    });
  });
};

export const destroyArtifactsUnderRank = (maxRank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S') => {
  useArtifactsStore.getState().destroyArtifactsUnderRank(maxRank, (essenceGain, count) => {
    const currentResources = gameStore.getState().resources;
    const currentCaps = gameStore.getState().resourceCaps;
    gameStore.setState({
      resources: {
        ...currentResources,
        essence: Math.min(currentCaps.essence, currentResources.essence + essenceGain),
      },
    });
    console.log(`✅ Destroyed ${count} artifacts for ${essenceGain} essence`);
  });
};

// Dungeon actions
export const startDungeon = (dungeonId: string, partyIds: string[] = []) => {
  const currentTime = Date.now();
  useDungeonsStore.getState().startDungeon(dungeonId, currentTime, partyIds, () => {
    console.log('🏰 Dungeon started successfully');
  });
};

export const cancelDungeon = (activeDungeonId: string) => {
  useDungeonsStore.getState().cancelDungeon(activeDungeonId);
};

// Check and complete dungeons if time is up (called from tick)
export const checkDungeonCompletion = () => {
  const activeDungeons = useDungeonsStore.getState().activeDungeons;
  if (activeDungeons.length === 0) return;

  const currentTime = Date.now();

  // Check each active dungeon
  activeDungeons.forEach((activeDungeon) => {
    if (currentTime >= activeDungeon.endTime) {
      useDungeonsStore.getState().completeDungeon(activeDungeon.id, currentTime, (rewards, dungeonName, dungeon) => {
      // Calculate companion effectiveness based on their level vs Sung Jinwoo's level
      const hunterLevel = useHunterStore.getState().hunter.level;
      let companionEffectiveness = 0;

      if (activeDungeon.partyIds && activeDungeon.partyIds.length > 0) {
        activeDungeon.partyIds.forEach((companionId) => {
          // Find the companion
          const ally = useAlliesStore.getState().allies.find((a) => a.id === companionId);
          const shadow = useShadowsStore.getState().shadows.find((s) => s.id === companionId);
          const companion = ally || shadow;

          if (companion) {
            // Companion effectiveness = their level / hunter level
            // e.g., level 4 companion with level 12 hunter = 4/12 = 0.33 (33% effectiveness)
            const effectiveness = companion.level / hunterLevel;
            companionEffectiveness += effectiveness;
          }
        });
      }

      // Total multiplier = 1 (Sung Jinwoo) + companion effectiveness
      const rewardMultiplier = 1 + companionEffectiveness;

      // Multiply all rewards by effectiveness
      const multipliedRewards = {
        essence: Math.floor(rewards.essence * rewardMultiplier),
        crystals: Math.floor(rewards.crystals * rewardMultiplier),
        gold: Math.floor(rewards.gold * rewardMultiplier),
        souls: Math.floor(rewards.souls * rewardMultiplier),
        attraction: Math.floor(rewards.attraction * rewardMultiplier),
        gems: Math.floor(rewards.gems * rewardMultiplier),
        knowledge: Math.floor(rewards.knowledge * rewardMultiplier),
        experience: Math.floor(rewards.experience * rewardMultiplier),
      };

      // Grant all rewards (clamped to caps)
      const currentResources = gameStore.getState().resources;
      const currentCaps = gameStore.getState().resourceCaps;
      gameStore.setState({
        resources: {
          essence: Math.min(currentCaps.essence, currentResources.essence + multipliedRewards.essence),
          crystals: Math.min(currentCaps.crystals, currentResources.crystals + multipliedRewards.crystals),
          gold: Math.min(currentCaps.gold, currentResources.gold + multipliedRewards.gold),
          souls: Math.min(currentCaps.souls, currentResources.souls + multipliedRewards.souls),
          attraction: Math.min(currentCaps.attraction, currentResources.attraction + multipliedRewards.attraction),
          gems: Math.min(currentCaps.gems, currentResources.gems + multipliedRewards.gems),
          knowledge: Math.min(currentCaps.knowledge, currentResources.knowledge + multipliedRewards.knowledge),
        },
      });

      // Grant hunter XP
      useHunterStore.getState().addXp(multipliedRewards.experience, (newLevel) => {
        console.log(`🎉 Leveled up to ${newLevel}!`);
        handleLevelUp(newLevel);
      });

      // Grant XP to companions in party
      if (activeDungeon.partyIds && activeDungeon.partyIds.length > 0) {
        const companionXp = Math.floor(rewards.experience * 0.5); // Companions get 50% of base XP

        activeDungeon.partyIds.forEach((companionId) => {
          // Check if it's an ally or shadow
          const ally = useAlliesStore.getState().allies.find((a) => a.id === companionId);
          if (ally) {
            useAlliesStore.getState().addXpToAlly(companionId, companionXp);
          } else {
            const shadow = useShadowsStore.getState().shadows.find((s) => s.id === companionId);
            if (shadow) {
              useShadowsStore.getState().addXpToShadow(companionId, companionXp);
            }
          }
        });
      }

      // Check for companion drop
      if (dungeon.companionDropChance && dungeon.companionNames && dungeon.companionNames.length > 0) {
        // Filter out companions you already have
        let availableCompanionNames: string[] = [];

        if (dungeon.type === 'alliance') {
          const existingAllyNames = useAlliesStore.getState().allies
            .filter(a => a.originDungeonId === dungeon.id)
            .map(a => a.name);
          availableCompanionNames = dungeon.companionNames.filter(name => !existingAllyNames.includes(name));
        } else if (dungeon.type === 'solo') {
          const existingShadowNames = useShadowsStore.getState().shadows
            .filter(s => s.originDungeonId === dungeon.id)
            .map(s => s.name);
          availableCompanionNames = dungeon.companionNames.filter(name => !existingShadowNames.includes(name));
        }

        // Only roll if there are companions left to recruit
        if (availableCompanionNames.length > 0) {
          const roll = Math.random();
          console.log(`🎲 Companion drop roll: ${roll.toFixed(3)} vs ${dungeon.companionDropChance} (${dungeon.name})`);
          console.log(`   Available companions: ${availableCompanionNames.join(', ')} (${availableCompanionNames.length}/${dungeon.companionNames.length})`);

          if (roll < dungeon.companionDropChance) {
            // Randomly select from available companions
            const randomName = availableCompanionNames[Math.floor(Math.random() * availableCompanionNames.length)];
            console.log(`✅ Companion dropped! Type: ${dungeon.type}, Name: ${randomName}`);

            if (dungeon.type === 'alliance') {
              // Recruit ally
              const newAlly = useAlliesStore.getState().recruitAlly(randomName, dungeon.id);
              console.log(`🤝 Recruited ally:`, newAlly);
              useNotificationsStore.getState().addNotification(
                'unlock',
                'New Ally Recruited!',
                `${newAlly.name} has joined your cause!`,
                undefined,
                6000
              );
            } else if (dungeon.type === 'solo' && useShadowsStore.getState().necromancerUnlocked) {
              // Extract shadow (only if necromancer unlocked)
              const newShadow = useShadowsStore.getState().extractShadow(randomName, dungeon.id);
              console.log(`👻 Extracted shadow:`, newShadow);
              if (newShadow.id) {
                useNotificationsStore.getState().addNotification(
                  'unlock',
                  'Shadow Extracted!',
                  `${newShadow.name} has been added to your shadow army!`,
                  undefined,
                  6000
                );
              }
            }
          } else {
            console.log(`❌ No companion dropped this time`);
          }
        } else {
          console.log(`✅ All companions from ${dungeon.name} already recruited!`);
        }
      }

      // Show completion notification
      const partySize = activeDungeon.partyIds?.length || 0;
      useNotificationsStore.getState().addNotification(
        'dungeon_complete',
        'Dungeon Complete!',
        partySize > 0
          ? `${dungeonName} cleared with ${partySize} companion${partySize > 1 ? 's' : ''}! (${rewardMultiplier.toFixed(2)}x rewards)`
          : `${dungeonName} cleared successfully!`,
        multipliedRewards,
        6000 // 6 seconds
      );

      console.log('🎉 Dungeon rewards granted!', multipliedRewards);
      });
    }
  });
};

// Unlock dungeons based on hunter level
export const checkDungeonUnlocks = (hunterLevel: number) => {
  const dungeons = useDungeonsStore.getState().dungeons;
  dungeons.forEach((dungeon) => {
    if (!dungeon.unlocked && hunterLevel >= dungeon.requiredLevel) {
      useDungeonsStore.getState().unlockDungeon(dungeon.id);
    }
  });
};

// Check and unlock necromancer at level 40
const checkNecromancerUnlock = (hunterLevel: number) => {
  if (hunterLevel >= 40 && !useShadowsStore.getState().necromancerUnlocked) {
    useShadowsStore.getState().unlockNecromancer();
  }
};

// Centralized level-up handler - call this from all level-up paths
const handleLevelUp = (newLevel: number) => {
  const buildings = useBuildingsStore.getState().buildings;
  const research = useResearchStore.getState().research;
  const updatedEffectiveStats = getEffectiveHunterStats();

  // Recalculate resource caps with new level
  gameStore.setState({
    resourceCaps: calculateResourceCaps(baseResourceCaps, buildings, research, newLevel, updatedEffectiveStats),
  });

  // Check for dungeon unlocks
  checkDungeonUnlocks(newLevel);

  // Check for necromancer unlock
  checkNecromancerUnlock(newLevel);
};

// Initialize game systems after all stores are loaded
// Call this from App.tsx or main.tsx after imports
export const initializeGame = () => {
  const hunterLevel = useHunterStore.getState().hunter.level;
  const buildings = useBuildingsStore.getState().buildings;
  const research = useResearchStore.getState().research;
  const effectiveStats = getEffectiveHunterStats();

  // Recalculate resource caps with hunter stats, research, and building bonuses
  // This ensures caps are correct from the first tick/gather
  gameStore.setState({
    resourceCaps: calculateResourceCaps(baseResourceCaps, buildings, research, hunterLevel, effectiveStats),
  });

  checkDungeonUnlocks(hunterLevel);
  checkNecromancerUnlock(hunterLevel);
  console.log('🎮 Game initialized, checked dungeon unlocks for level', hunterLevel);
};

// Re-export types and helpers
export type { Resources, ResourceCaps, Building, Research };
export { createResources };
export { getBuildingCost, canAffordBuilding } from './buildingsStore';
export { useBuildingsStore, useResearchStore, useHunterStore, useArtifactsStore, useDungeonsStore };

