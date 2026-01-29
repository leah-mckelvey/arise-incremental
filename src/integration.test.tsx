import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  gameStore,
  initializeGame,
  useBuildingsStore,
  useHunterStore,
  useResearchStore,
  purchaseBuilding,
  allocateStat,
} from './store/gameStore';
import * as gameApi from './api/gameApi';
import type { TransactionResponse, GameStateResponse } from '../shared/types';
import { initialBuildings } from './data/initialBuildings';

/**
 * Frontend Integration Tests
 *
 * Tests the frontend integration: React → Zustand stores → API client
 * Backend is MOCKED - these are not end-to-end tests.
 *
 * For full end-to-end tests with real backend, see e2e tests.
 */

// Mock the API module
vi.mock('./api/gameApi');

// Helper to get current resources
function getResources() {
  return gameStore.getState().resources;
}

// Helper to get current buildings
function getBuildings() {
  return useBuildingsStore.getState().buildings;
}

// Helper to get current hunter
function getHunter() {
  return useHunterStore.getState().hunter;
}

// Helper to create mock API responses
function createMockGameState(): GameStateResponse {
  return {
    state: {
      version: 1,
      resources: {
        essence: 0,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      resourceCaps: {
        essence: 100,
        crystals: 50,
        gold: 100,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      buildings: {},
      research: {},
      hunter: {
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        statPoints: 0,
        rank: 'E',
        stats: {
          strength: 10,
          agility: 10,
          intelligence: 10,
          vitality: 10,
          sense: 10,
          authority: 10,
        },
        hp: 100,
        maxHp: 100,
        mana: 50,
        maxMana: 50,
      },
      artifacts: {
        equipped: {},
        inventory: [],
        blacksmithLevel: 1,
        blacksmithXp: 0,
      },
      dungeons: [],
      activeDungeons: [],
      allies: [],
      shadows: [],
      lastUpdate: Date.now(),
    },
    offlineGains: undefined,
  };
}

describe('Frontend Integration Tests', () => {
  beforeEach(async () => {
    // Clear localStorage to start fresh
    localStorage.clear();

    // Reset all stores
    gameStore.setState({
      version: 1,
      resources: {
        essence: 0,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      resourceCaps: {
        essence: 100,
        crystals: 50,
        gold: 100,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      lastUpdate: Date.now(),
      pendingMutations: 0,
    });

    useBuildingsStore.getState().reset();
    useHunterStore.getState().reset();
    useResearchStore.getState().reset();

    // Setup default mocks
    vi.mocked(gameApi.getGameState).mockResolvedValue(createMockGameState());
  });

  afterEach(() => {
    // Clean up
    vi.restoreAllMocks();
  });

  describe('1. Initial Load & Sync', () => {
    it('1.1 should load first-time user and sync with backend', async () => {
      // GIVEN: New user with no saved state and mocked API response
      localStorage.clear();

      const mockResponse = createMockGameState();
      vi.mocked(gameApi.getGameState).mockResolvedValue(mockResponse);

      // WHEN: App initializes and syncs
      initializeGame();
      await gameStore.getState().syncWithServer();

      // THEN: API was called
      expect(gameApi.getGameState).toHaveBeenCalled();

      // Backend creates new game state and frontend syncs
      const resources = getResources();
      expect(resources).toBeDefined();
      expect(typeof resources.essence).toBe('number');
      expect(typeof resources.crystals).toBe('number');
      expect(typeof resources.gold).toBe('number');

      const hunter = getHunter();
      expect(hunter.level).toBeGreaterThanOrEqual(1);
      expect(hunter.xp).toBeGreaterThanOrEqual(0);

      console.log('✅ 1.1: Initial sync successful', {
        resources,
        hunter: { level: hunter.level, xp: hunter.xp },
      });
    });

    it('1.2 should skip sync when mutations are pending', async () => {
      // GIVEN: User has synced once
      initializeGame();
      await gameStore.getState().syncWithServer();

      // Set pending mutations
      gameStore.setState({ pendingMutations: 1 });
      const lastSyncBefore = gameStore.getState().lastServerSync;

      // WHEN: Sync is called again
      await gameStore.getState().syncWithServer();

      // THEN: Sync is skipped (lastServerSync unchanged)
      const lastSyncAfter = gameStore.getState().lastServerSync;
      expect(lastSyncAfter).toBe(lastSyncBefore);
      expect(gameStore.getState().pendingMutations).toBe(1);

      console.log('✅ 1.2: Sync correctly skipped during pending mutations');
    });
  });

  describe('2. Resource Gathering Flow', () => {
    it('2.1 should successfully gather resource with mocked API', async () => {
      // GIVEN: User has initial resources
      initializeGame();

      const essenceBefore = getResources().essence;

      // Mock successful API response - backend confirms the gather with updated XP
      const mockResponse: TransactionResponse = {
        success: true,
        state: {
          ...createMockGameState().state,
          resources: {
            ...createMockGameState().state.resources,
            essence: 1.1, // Gathered amount
          },
          hunter: {
            ...createMockGameState().state.hunter,
            xp: 0.105, // XP gained from gathering
          },
        },
      };
      vi.mocked(gameApi.gatherResource).mockResolvedValue(mockResponse);

      // WHEN: User gathers essence (optimistic update + API call)
      gameStore.getState().gatherResource('essence');

      // Wait for API call to complete - give it a moment for the async operation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // THEN: API was called
      expect(gameApi.gatherResource).toHaveBeenCalledWith('essence');

      // Pending mutations should be cleared
      expect(gameStore.getState().pendingMutations).toBe(0);

      // Resource increased (optimistic update happened immediately)
      const essenceAfter = getResources().essence;
      expect(essenceAfter).toBeGreaterThan(essenceBefore);

      // Hunter gained XP
      expect(getHunter().xp).toBeGreaterThan(0);

      console.log('✅ 2.1: Gather successful', {
        before: essenceBefore,
        after: essenceAfter,
        xpGained: getHunter().xp,
      });
    });

    it('2.2 should handle rapid gathering with mocked API', async () => {
      // GIVEN: User has initial resources
      initializeGame();

      const essenceBefore = getResources().essence;

      // Clear previous mock and set up new one
      vi.mocked(gameApi.gatherResource).mockClear();

      // Mock successful API responses - each gather returns updated state
      let gatherCount = 0;
      vi.mocked(gameApi.gatherResource).mockImplementation(async () => {
        gatherCount++;
        return {
          success: true,
          state: {
            ...createMockGameState().state,
            resources: {
              ...createMockGameState().state.resources,
              essence: gatherCount * 1.1, // Each gather adds 1.1
            },
          },
        };
      });

      // WHEN: User gathers 3 times rapidly
      gameStore.getState().gatherResource('essence');
      gameStore.getState().gatherResource('essence');
      gameStore.getState().gatherResource('essence');

      // Wait for all API calls to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // THEN: All API calls were made
      expect(gameApi.gatherResource).toHaveBeenCalledTimes(3);

      // Pending mutations should be cleared
      expect(gameStore.getState().pendingMutations).toBe(0);

      // All gathers accumulate (optimistic updates happened immediately)
      const essenceAfter = getResources().essence;
      expect(essenceAfter).toBeGreaterThan(essenceBefore);

      console.log('✅ 2.2: Rapid gathering successful', {
        before: essenceBefore,
        after: essenceAfter,
      });
    });
  });

  describe('3. Building Purchase Flow', () => {
    it('3.1 should successfully purchase building with mocked API', async () => {
      // GIVEN: User has sufficient resources
      initializeGame();

      // Give user enough resources for essenceExtractor (costs 10 essence)
      gameStore.setState({
        resources: {
          ...getResources(),
          essence: 100,
        },
      });

      const essenceBefore = getResources().essence;
      const buildingsBefore = getBuildings();
      const extractorCountBefore = buildingsBefore.essenceExtractor?.count || 0;

      // Mock successful API response - backend confirms the purchase
      const mockResponse: TransactionResponse = {
        success: true,
        state: {
          ...createMockGameState().state,
          resources: {
            ...createMockGameState().state.resources,
            essence: 90, // 100 - 10 cost
          },
          buildings: {
            ...initialBuildings,
            essenceExtractor: {
              ...initialBuildings.essenceExtractor,
              count: 1,
            },
          },
        },
      };
      vi.mocked(gameApi.purchaseBuilding).mockResolvedValue(mockResponse);

      // WHEN: User purchases essenceExtractor via coordinated action
      await purchaseBuilding('essenceExtractor');

      // Wait for API call to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // THEN: API was called
      expect(gameApi.purchaseBuilding).toHaveBeenCalledWith('essenceExtractor');

      // Pending mutations should be cleared
      expect(gameStore.getState().pendingMutations).toBe(0);

      // Resources deducted
      expect(getResources().essence).toBeLessThan(essenceBefore);

      // Building count increased
      expect(getBuildings().essenceExtractor?.count).toBe(extractorCountBefore + 1);

      console.log('✅ 3.1: Building purchase successful', {
        essenceBefore,
        essenceAfter: getResources().essence,
        extractorCount: getBuildings().essenceExtractor?.count,
      });
    });
  });

  describe('4. Hunter Stat Allocation', () => {
    it('4.1 should handle stat allocation failure gracefully with client-side validation', async () => {
      // GIVEN: Hunter has NO stat points (level 1, no XP)
      initializeGame();

      const strengthBefore = getHunter().stats.strength;
      const statPointsBefore = getHunter().statPoints;

      expect(statPointsBefore).toBe(0); // Verify no stat points

      // WHEN: User tries to allocate (should fail client-side validation)
      await allocateStat('strength');

      // Wait a bit to ensure no async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      // THEN: API should NOT be called (client-side validation prevents it)
      expect(gameApi.allocateStat).not.toHaveBeenCalled();

      // Pending mutations should be 0 (no API call was made)
      expect(gameStore.getState().pendingMutations).toBe(0);

      // State unchanged (validation prevented the change)
      expect(getHunter().stats.strength).toBe(strengthBefore);
      expect(getHunter().statPoints).toBe(statPointsBefore);

      console.log(
        '✅ 4.1: Stat allocation correctly rejected when no points available (client-side validation)'
      );
    });
  });
});
