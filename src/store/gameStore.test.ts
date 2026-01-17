import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gameStore } from './gameStore';

describe('gameStore', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset the store to initial state
    gameStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have initial resources set to zero', () => {
      const state = gameStore.getState();
      expect(state.resources).toEqual({
        essence: 0,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      });
    });

    it('should have all buildings with count 0', () => {
      const state = gameStore.getState();
      Object.values(state.buildings).forEach((building) => {
        expect(building.count).toBe(0);
      });
    });

    it('should have lastUpdate timestamp', () => {
      const state = gameStore.getState();
      expect(state.lastUpdate).toBeGreaterThan(0);
    });
  });

  describe('addResource', () => {
    it('should add essence correctly', () => {
      const state = gameStore.getState();
      state.addResource('essence', 10);
      expect(gameStore.getState().resources.essence).toBe(10);
    });

    it('should add crystals correctly', () => {
      const state = gameStore.getState();
      state.addResource('crystals', 5);
      expect(gameStore.getState().resources.crystals).toBe(5);
    });

    it('should add gold correctly', () => {
      const state = gameStore.getState();
      state.addResource('gold', 15);
      expect(gameStore.getState().resources.gold).toBe(15);
    });

    it('should add gems correctly', () => {
      const state = gameStore.getState();
      state.addResource('gems', 3);
      expect(gameStore.getState().resources.gems).toBe(3);
    });

    it('should accumulate resources when called multiple times', () => {
      const state = gameStore.getState();
      state.addResource('essence', 10);
      state.addResource('essence', 5);
      state.addResource('essence', 3);
      expect(gameStore.getState().resources.essence).toBe(18);
    });

    it('should not allow negative resources', () => {
      const state = gameStore.getState();
      state.addResource('essence', 10);
      state.addResource('essence', -20);
      expect(gameStore.getState().resources.essence).toBe(0);
    });
  });

  describe('purchaseBuilding', () => {
    it('should purchase a building when resources are sufficient', () => {
      const state = gameStore.getState();
      // Add enough essence to buy an essence extractor (costs 10)
      state.addResource('essence', 20);
      state.purchaseBuilding('essenceExtractor');

      const newState = gameStore.getState();
      expect(newState.buildings.essenceExtractor.count).toBe(1);
      expect(newState.resources.essence).toBe(10); // 20 - 10
    });

    it('should not purchase when resources are insufficient', () => {
      const state = gameStore.getState();
      // Try to buy without enough resources
      state.purchaseBuilding('essenceExtractor');

      const newState = gameStore.getState();
      expect(newState.buildings.essenceExtractor.count).toBe(0);
    });

    it('should increase cost with each purchase (1.15x multiplier)', () => {
      const state = gameStore.getState();
      // Give enough resources for multiple purchases (respecting caps)
      // Essence cap is 100, so we need to manually set resources to bypass cap for testing
      state.reset();
      // Directly set resources bypassing caps for this test
      gameStore.setState({ resources: { essence: 1000, crystals: 0, gold: 0, souls: 0, attraction: 0, gems: 0 } });

      // First purchase costs 10
      state.purchaseBuilding('essenceExtractor');
      expect(gameStore.getState().resources.essence).toBe(990);

      // Second purchase costs floor(10 * 1.15) = 11
      state.purchaseBuilding('essenceExtractor');
      expect(gameStore.getState().resources.essence).toBe(979);

      // Third purchase costs floor(10 * 1.15^2) = 13
      state.purchaseBuilding('essenceExtractor');
      expect(gameStore.getState().resources.essence).toBe(966);
    });

    it('should handle buildings with multiple resource costs', () => {
      const state = gameStore.getState();
      // Training Ground costs 50 essence and 5 crystals
      state.addResource('essence', 100);
      state.addResource('crystals', 10);

      state.purchaseBuilding('trainingGround');

      const newState = gameStore.getState();
      expect(newState.buildings.trainingGround.count).toBe(1);
      expect(newState.resources.essence).toBe(50);
      expect(newState.resources.crystals).toBe(5);
    });

    it('should not purchase if any resource is insufficient', () => {
      const state = gameStore.getState();
      // Training Ground costs 50 essence and 5 crystals - only provide essence
      state.addResource('essence', 100);

      state.purchaseBuilding('trainingGround');

      const newState = gameStore.getState();
      expect(newState.buildings.trainingGround.count).toBe(0);
      expect(newState.resources.essence).toBe(100); // No deduction
    });
  });

  describe('tick', () => {
    it('should generate resources from buildings over time', () => {
      const state = gameStore.getState();

      // Buy an essence extractor (produces 1 essence per second at 0.1/s rate)
      state.addResource('essence', 20);
      state.purchaseBuilding('essenceExtractor');

      // Wait a bit to ensure time passes
      const beforeTick = gameStore.getState().resources.essence;

      // Simulate 1 second passing
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now + 1000);

      state.tick();

      const afterTick = gameStore.getState().resources.essence;
      // Should have gained approximately 0.1 essence (1 * 0.1 * 1 second)
      expect(afterTick).toBeGreaterThan(beforeTick);
      expect(afterTick - beforeTick).toBeCloseTo(0.1, 1);

      vi.useRealTimers();
    });

    it('should update lastUpdate timestamp', () => {
      const state = gameStore.getState();
      const beforeTick = state.lastUpdate;

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 1000);

      state.tick();

      const afterTick = gameStore.getState().lastUpdate;
      expect(afterTick).toBeGreaterThan(beforeTick);

      vi.useRealTimers();
    });

    it('should handle multiple producing buildings', () => {
      const state = gameStore.getState();

      // Buy multiple essence extractors
      state.addResource('essence', 100);
      state.purchaseBuilding('essenceExtractor');
      state.purchaseBuilding('essenceExtractor');
      state.purchaseBuilding('essenceExtractor');

      const beforeTick = gameStore.getState().resources.essence;

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 1000);

      state.tick();

      const afterTick = gameStore.getState().resources.essence;
      // 3 extractors * 1 essence * 0.1/s * 1 second = 0.3 essence
      expect(afterTick - beforeTick).toBeCloseTo(0.3, 1);

      vi.useRealTimers();
    });
  });

  describe('reset', () => {
    it('should reset all resources to zero', () => {
      const state = gameStore.getState();
      state.addResource('essence', 100);
      state.addResource('crystals', 50);
      state.addResource('gold', 25);
      state.addResource('gems', 10);

      state.reset();

      const newState = gameStore.getState();
      expect(newState.resources).toEqual({
        essence: 0,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      });
    });

    it('should reset all building counts to zero', () => {
      const state = gameStore.getState();
      state.addResource('essence', 1000);
      state.purchaseBuilding('essenceExtractor');
      state.purchaseBuilding('essenceExtractor');

      state.reset();

      const newState = gameStore.getState();
      expect(newState.buildings.essenceExtractor.count).toBe(0);
    });

    it('should refresh lastUpdate to current time on reset', () => {
      vi.useFakeTimers();
      const initialTime = Date.now();
      vi.setSystemTime(initialTime);

      const state = gameStore.getState();
      state.addResource('essence', 100);

      // Advance time by 1 hour
      vi.advanceTimersByTime(3600000);
      const timeBeforeReset = Date.now();

      state.reset();

      const newState = gameStore.getState();
      // lastUpdate should be close to current time, not the initial module load time
      expect(newState.lastUpdate).toBeGreaterThanOrEqual(timeBeforeReset);
      expect(newState.lastUpdate).toBeLessThanOrEqual(Date.now());

      vi.useRealTimers();
    });
  });

  describe('Persistence', () => {
    it('should save state to localStorage on changes', () => {
      const state = gameStore.getState();
      state.addResource('essence', 42);

      // Check localStorage
      const saved = localStorage.getItem('arise-incremental-storage');
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      expect(parsed.resources.essence).toBe(42);
    });
  });
});
