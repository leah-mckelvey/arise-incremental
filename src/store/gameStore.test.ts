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
        catnip: 0,
        wood: 0,
        minerals: 0,
        science: 0,
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
    it('should add catnip correctly', () => {
      const state = gameStore.getState();
      state.addResource('catnip', 10);
      expect(gameStore.getState().resources.catnip).toBe(10);
    });

    it('should add wood correctly', () => {
      const state = gameStore.getState();
      state.addResource('wood', 5);
      expect(gameStore.getState().resources.wood).toBe(5);
    });

    it('should add minerals correctly', () => {
      const state = gameStore.getState();
      state.addResource('minerals', 15);
      expect(gameStore.getState().resources.minerals).toBe(15);
    });

    it('should add science correctly', () => {
      const state = gameStore.getState();
      state.addResource('science', 3);
      expect(gameStore.getState().resources.science).toBe(3);
    });

    it('should accumulate resources when called multiple times', () => {
      const state = gameStore.getState();
      state.addResource('catnip', 10);
      state.addResource('catnip', 5);
      state.addResource('catnip', 3);
      expect(gameStore.getState().resources.catnip).toBe(18);
    });

    it('should not allow negative resources', () => {
      const state = gameStore.getState();
      state.addResource('catnip', 10);
      state.addResource('catnip', -20);
      expect(gameStore.getState().resources.catnip).toBe(0);
    });
  });

  describe('purchaseBuilding', () => {
    it('should purchase a building when resources are sufficient', () => {
      const state = gameStore.getState();
      // Add enough catnip to buy a catnip field (costs 10)
      state.addResource('catnip', 20);
      state.purchaseBuilding('catnipField');
      
      const newState = gameStore.getState();
      expect(newState.buildings.catnipField.count).toBe(1);
      expect(newState.resources.catnip).toBe(10); // 20 - 10
    });

    it('should not purchase when resources are insufficient', () => {
      const state = gameStore.getState();
      // Try to buy without enough resources
      state.purchaseBuilding('catnipField');
      
      const newState = gameStore.getState();
      expect(newState.buildings.catnipField.count).toBe(0);
    });

    it('should increase cost with each purchase (1.15x multiplier)', () => {
      const state = gameStore.getState();
      // Give enough resources for multiple purchases
      state.addResource('catnip', 1000);
      
      // First purchase costs 10
      state.purchaseBuilding('catnipField');
      expect(gameStore.getState().resources.catnip).toBe(990);
      
      // Second purchase costs floor(10 * 1.15) = 11
      state.purchaseBuilding('catnipField');
      expect(gameStore.getState().resources.catnip).toBe(979);
      
      // Third purchase costs floor(10 * 1.15^2) = 13
      state.purchaseBuilding('catnipField');
      expect(gameStore.getState().resources.catnip).toBe(966);
    });

    it('should handle buildings with multiple resource costs', () => {
      const state = gameStore.getState();
      // Hut costs 50 catnip and 5 wood
      state.addResource('catnip', 100);
      state.addResource('wood', 10);
      
      state.purchaseBuilding('hut');
      
      const newState = gameStore.getState();
      expect(newState.buildings.hut.count).toBe(1);
      expect(newState.resources.catnip).toBe(50);
      expect(newState.resources.wood).toBe(5);
    });

    it('should not purchase if any resource is insufficient', () => {
      const state = gameStore.getState();
      // Hut costs 50 catnip and 5 wood - only provide catnip
      state.addResource('catnip', 100);
      
      state.purchaseBuilding('hut');
      
      const newState = gameStore.getState();
      expect(newState.buildings.hut.count).toBe(0);
      expect(newState.resources.catnip).toBe(100); // No deduction
    });
  });

  describe('tick', () => {
    it('should generate resources from buildings over time', () => {
      const state = gameStore.getState();

      // Buy a catnip field (produces 1 catnip per second at 0.1/s rate)
      state.addResource('catnip', 20);
      state.purchaseBuilding('catnipField');

      // Wait a bit to ensure time passes
      const beforeTick = gameStore.getState().resources.catnip;

      // Simulate 1 second passing
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now + 1000);

      state.tick();

      const afterTick = gameStore.getState().resources.catnip;
      // Should have gained approximately 0.1 catnip (1 * 0.1 * 1 second)
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

      // Buy multiple catnip fields
      state.addResource('catnip', 100);
      state.purchaseBuilding('catnipField');
      state.purchaseBuilding('catnipField');
      state.purchaseBuilding('catnipField');

      const beforeTick = gameStore.getState().resources.catnip;

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 1000);

      state.tick();

      const afterTick = gameStore.getState().resources.catnip;
      // 3 fields * 1 catnip * 0.1/s * 1 second = 0.3 catnip
      expect(afterTick - beforeTick).toBeCloseTo(0.3, 1);

      vi.useRealTimers();
    });
  });

  describe('reset', () => {
    it('should reset all resources to zero', () => {
      const state = gameStore.getState();
      state.addResource('catnip', 100);
      state.addResource('wood', 50);
      state.addResource('minerals', 25);
      state.addResource('science', 10);

      state.reset();

      const newState = gameStore.getState();
      expect(newState.resources).toEqual({
        catnip: 0,
        wood: 0,
        minerals: 0,
        science: 0,
      });
    });

    it('should reset all building counts to zero', () => {
      const state = gameStore.getState();
      state.addResource('catnip', 1000);
      state.purchaseBuilding('catnipField');
      state.purchaseBuilding('catnipField');

      state.reset();

      const newState = gameStore.getState();
      expect(newState.buildings.catnipField.count).toBe(0);
    });
  });

  describe('Persistence', () => {
    it('should save state to localStorage on changes', () => {
      const state = gameStore.getState();
      state.addResource('catnip', 42);

      // Check localStorage
      const saved = localStorage.getItem('arise-incremental-storage');
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      expect(parsed.resources.catnip).toBe(42);
    });
  });
});
