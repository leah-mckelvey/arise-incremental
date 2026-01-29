/**
 * Core game store
 * Contains resources, resource caps, and core game loop (tick)
 * Action functions are imported from src/store/actions/
 */

import { createStore } from '@ts-query/core';
import type { Resources, ResourceCaps } from './types';
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
  calculateTickGains,
  calculateGatherAmount,
  calculateGatherXp,
} from '../lib/calculations/resourceCalculations';
import { baseResourceCaps } from '../data/initialHunter';
import { runMigrations, getCurrentVersion } from '../lib/migrations';
import * as gameApi from '../api/gameApi';

// Main game state (resources, caps, tick)
export interface GameState {
  version: number;
  resources: Resources;
  resourceCaps: ResourceCaps;
  lastUpdate: number;
  lastServerSync: number; // Track when we last synced with server
  pendingMutations: number; // Track number of in-flight mutations

  // Actions
  addResource: (resource: keyof Resources, amount: number) => void;
  gatherResource: (resource: 'essence' | 'crystals' | 'gold') => void;
  tick: () => void;
  reset: () => Promise<void>;
  syncWithServer: () => Promise<void>; // Sync all stores with server state

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
  lastServerSync: 0, // Never synced yet
  pendingMutations: 0, // No mutations in flight
};

// Deep merge helper - properly merges nested objects like resources and resourceCaps
const deepMerge = <T extends Record<string, unknown>>(target: T, source: Partial<T>): T => {
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
        const hasNaN = Object.values(resources).some(
          (val) => typeof val === 'number' && isNaN(val)
        );
        if (hasNaN) {
          console.warn(
            '🔧 Corrupted resources detected in localStorage, resetting game state...',
            resources
          );
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: state.version,
        resources: state.resources,
        resourceCaps: state.resourceCaps,
        lastUpdate: state.lastUpdate,
      })
    );
  } catch (error) {
    console.error('Failed to persist game state:', error);
  }
};

export const gameStore = createStore<GameState>((set, get) => {
  // Run migrations before loading state
  runMigrations();

  const persisted = loadPersistedState();
  const mergedState =
    persisted && persisted.version === getCurrentVersion()
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

    gatherResource: async (resource: 'essence' | 'crystals' | 'gold') => {
      const research = useResearchStore.getState().research;
      const effectiveStats = getEffectiveHunterStats();

      // Calculate expected gains (optimistic)
      const amount = calculateGatherAmount(resource, effectiveStats, research);
      const xpGain = calculateGatherXp(resource, effectiveStats);

      // Store previous state for rollback
      const previousResources = get().resources;
      const previousHunter = useHunterStore.getState().hunter;

      // Optimistic update - apply immediately for instant feedback
      get().addResource(resource, amount);
      useHunterStore.getState().addXp(xpGain, handleLevelUp);

      // Track pending mutation
      set((s) => ({ pendingMutations: s.pendingMutations + 1 }));

      try {
        // Background API call
        const response = await gameApi.gatherResource(resource);
        // Success - sync server state
        syncServerState(response.state);
      } catch (error) {
        // Rollback on error
        set({ resources: previousResources });
        useHunterStore.setState({ hunter: previousHunter });
        console.error('Failed to gather resource:', error);
        useNotificationsStore
          .getState()
          .addNotification(
            'error',
            'Action Failed',
            `Failed to gather ${resource}. Your progress has been reverted.`,
            undefined,
            5000
          );
      } finally {
        // Always decrement pending mutations
        set((s) => ({ pendingMutations: s.pendingMutations - 1 }));
      }
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
          essence: Math.min(
            state.resourceCaps.essence,
            state.resources.essence + resourceGains.essence
          ),
          crystals: Math.min(
            state.resourceCaps.crystals,
            state.resources.crystals + resourceGains.crystals
          ),
          gold: Math.min(state.resourceCaps.gold, state.resources.gold + resourceGains.gold),
          souls: Math.min(state.resourceCaps.souls, state.resources.souls + resourceGains.souls),
          attraction: Math.min(
            state.resourceCaps.attraction,
            state.resources.attraction + resourceGains.attraction
          ),
          gems: Math.min(state.resourceCaps.gems, state.resources.gems + resourceGains.gems),
          knowledge: Math.min(
            state.resourceCaps.knowledge,
            state.resources.knowledge + resourceGains.knowledge
          ),
        }),
        lastUpdate: now,
      }));

      // Apply XP gain and recalculate caps on level up
      if (xpGain > 0) {
        useHunterStore.getState().addXp(xpGain, handleLevelUp);
      }
    },

    reset: async () => {
      try {
        // Call backend to reset server state
        await gameApi.resetGame();

        // Sync with server to get fresh state
        await get().syncWithServer();
      } catch (error) {
        console.error('Failed to reset game:', error);
        // If backend fails, still reset locally
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
          resourceCaps: calculateResourceCaps(
            baseResourceCaps,
            buildings,
            research,
            hunter.level,
            effectiveStats
          ),
          lastUpdate: Date.now(),
        });
        persistState(get());
      }
    },

    syncWithServer: async () => {
      // Don't sync if there are pending mutations
      if (get().pendingMutations > 0) {
        console.log('⏸️ Skipping sync - mutations in flight');
        return;
      }

      try {
        const response = await gameApi.getGameState();
        const serverState = response.state;

        // Update all stores with server state
        set({
          resources: serverState.resources,
          resourceCaps: serverState.resourceCaps,
          lastUpdate: serverState.lastUpdate,
          lastServerSync: Date.now(),
        });

        // Update hunter store
        useHunterStore.setState({ hunter: serverState.hunter });

        // Update buildings store
        useBuildingsStore.setState({ buildings: serverState.buildings });

        // Update research store
        useResearchStore.setState({ research: serverState.research });

        // Update artifacts store
        useArtifactsStore.setState({
          equipped: serverState.artifacts.equipped,
          inventory: serverState.artifacts.inventory,
          blacksmithLevel: serverState.artifacts.blacksmithLevel,
          blacksmithXp: serverState.artifacts.blacksmithXp,
        });

        // Update dungeons store
        useDungeonsStore.setState({
          dungeons: serverState.dungeons,
          activeDungeons: serverState.activeDungeons,
        });

        // Update allies store
        useAlliesStore.setState({ allies: serverState.allies });

        // Update shadows store
        useShadowsStore.setState({ shadows: serverState.shadows });

        // Show offline gains if present (skip notification for now - type mismatch)
        if (response.offlineGains && response.offlineGains.timeAway > 5000) {
          console.log(
            `⏰ Welcome back! You were away for ${Math.floor(response.offlineGains.timeAway / 1000 / 60)} minutes`
          );
        }

        console.log('✅ Synced with server');
      } catch (error) {
        console.error('Failed to sync with server:', error);
      }
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

// Import action functions from action modules
// These are re-exported below for backwards compatibility
import {
  getEffectiveHunterStats,
  handleLevelUp,
  checkDungeonUnlocks,
  checkNecromancerUnlock,
  allocateStat,
} from './actions/hunterActions';
import { syncServerState } from './actions/syncActions';
import { purchaseBuilding, purchaseBuildingBulk } from './actions/buildingActions';
import { purchaseResearch } from './actions/researchActions';
import {
  craftArtifact,
  craftArtifactBulk,
  equipArtifact,
  unequipArtifact,
  upgradeArtifact,
  upgradeArtifactBulk,
  destroyArtifact,
  destroyArtifactsUnderRank,
} from './actions/artifactActions';
import { startDungeon, cancelDungeon, checkDungeonCompletion } from './actions/dungeonActions';
import { recruitGenericAlly, extractShadowManual } from './actions/companionActions';

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
    resourceCaps: calculateResourceCaps(
      baseResourceCaps,
      buildings,
      research,
      hunterLevel,
      effectiveStats
    ),
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

// Re-export action functions for backwards compatibility
export {
  // Hunter actions
  getEffectiveHunterStats,
  handleLevelUp,
  checkDungeonUnlocks,
  checkNecromancerUnlock,
  allocateStat,
  // Sync actions (internal - not typically used externally)
  syncServerState,
  // Building actions
  purchaseBuilding,
  purchaseBuildingBulk,
  // Research actions
  purchaseResearch,
  // Artifact actions
  craftArtifact,
  craftArtifactBulk,
  equipArtifact,
  unequipArtifact,
  upgradeArtifact,
  upgradeArtifactBulk,
  destroyArtifact,
  destroyArtifactsUnderRank,
  // Dungeon actions
  startDungeon,
  cancelDungeon,
  checkDungeonCompletion,
  // Companion actions
  recruitGenericAlly,
  extractShadowManual,
};
