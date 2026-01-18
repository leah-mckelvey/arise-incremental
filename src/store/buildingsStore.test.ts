import { describe, it, expect, beforeEach } from 'vitest';
import { useBuildingsStore, getBuildingCost, canAffordBuilding } from './buildingsStore';
import { createResources } from './gameStore';

describe('buildingsStore', () => {
  beforeEach(() => {
    useBuildingsStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have all buildings with count 0', () => {
      const buildings = useBuildingsStore.getState().buildings;
      Object.values(buildings).forEach((building) => {
        expect(building.count).toBe(0);
      });
    });

    it('should have correct base costs', () => {
      const buildings = useBuildingsStore.getState().buildings;
      expect(buildings.essenceExtractor.baseCost.essence).toBe(10);
      expect(buildings.trainingGround.baseCost.essence).toBe(30);
      expect(buildings.trainingGround.baseCost.gold).toBe(20);
    });
  });

  describe('getBuildingCost', () => {
    it('should return base cost for count 0', () => {
      const building = useBuildingsStore.getState().buildings.essenceExtractor;
      const cost = getBuildingCost(building);
      expect(cost.essence).toBe(10);
    });

    it('should scale cost with multiplier', () => {
      const buildings = useBuildingsStore.getState().buildings;
      const building = { ...buildings.essenceExtractor, count: 1 };
      const cost = getBuildingCost(building);
      expect(cost.essence).toBe(11); // floor(10 * 1.15)
    });

    it('should compound cost correctly', () => {
      const buildings = useBuildingsStore.getState().buildings;
      const building = { ...buildings.essenceExtractor, count: 2 };
      const cost = getBuildingCost(building);
      expect(cost.essence).toBe(13); // floor(10 * 1.15^2)
    });
  });

  describe('canAffordBuilding', () => {
    it('should return true when resources are sufficient', () => {
      const resources = createResources({ essence: 100 });
      const cost = createResources({ essence: 10 });
      expect(canAffordBuilding(resources, cost)).toBe(true);
    });

    it('should return false when resources are insufficient', () => {
      const resources = createResources({ essence: 5 });
      const cost = createResources({ essence: 10 });
      expect(canAffordBuilding(resources, cost)).toBe(false);
    });

    it('should check all resource types', () => {
      const resources = createResources({ essence: 100, gold: 10 });
      const cost = createResources({ essence: 50, gold: 25 });
      expect(canAffordBuilding(resources, cost)).toBe(false);
    });
  });

  describe('purchaseBuilding', () => {
    it('should increment building count on successful purchase', () => {
      const resources = createResources({ essence: 100 });
      let purchaseSucceeded = false;

      useBuildingsStore.getState().purchaseBuilding('essenceExtractor', resources, (cost, newBuildings) => {
        purchaseSucceeded = true;
        expect(newBuildings.essenceExtractor.count).toBe(1);
        expect(cost.essence).toBe(10);
      });

      expect(purchaseSucceeded).toBe(true);
      expect(useBuildingsStore.getState().buildings.essenceExtractor.count).toBe(1);
    });

    it('should not purchase when resources are insufficient', () => {
      const resources = createResources({ essence: 5 });
      let callbackCalled = false;

      useBuildingsStore.getState().purchaseBuilding('essenceExtractor', resources, () => {
        callbackCalled = true;
      });

      expect(callbackCalled).toBe(false);
      expect(useBuildingsStore.getState().buildings.essenceExtractor.count).toBe(0);
    });

    it('should not purchase invalid building', () => {
      const resources = createResources({ essence: 1000 });
      let callbackCalled = false;

      useBuildingsStore.getState().purchaseBuilding('invalidBuilding', resources, () => {
        callbackCalled = true;
      });

      expect(callbackCalled).toBe(false);
    });

    it('should handle multiple purchases with increasing costs', () => {
      const resources = createResources({ essence: 1000 });
      const costs: number[] = [];

      // First purchase
      useBuildingsStore.getState().purchaseBuilding('essenceExtractor', resources, (cost) => {
        costs.push(cost.essence);
      });

      // Second purchase
      useBuildingsStore.getState().purchaseBuilding('essenceExtractor', resources, (cost) => {
        costs.push(cost.essence);
      });

      // Third purchase
      useBuildingsStore.getState().purchaseBuilding('essenceExtractor', resources, (cost) => {
        costs.push(cost.essence);
      });

      expect(costs).toEqual([10, 11, 13]);
      expect(useBuildingsStore.getState().buildings.essenceExtractor.count).toBe(3);
    });
  });

  describe('Building Properties', () => {
    it('should have production buildings with produces and perSecond', () => {
      const building = useBuildingsStore.getState().buildings.essenceExtractor;
      expect(building.produces).toBeDefined();
      expect(building.perSecond).toBeDefined();
      expect(building.produces?.essence).toBe(3);
      expect(building.perSecond).toBe(0.1);
    });

    it('should have storage buildings with increasesCaps', () => {
      const building = useBuildingsStore.getState().buildings.essenceVault;
      expect(building.increasesCaps).toBeDefined();
      expect(building.increasesCaps?.essence).toBe(50);
    });

    it('should have XP buildings with xpPerSecond', () => {
      const building = useBuildingsStore.getState().buildings.trainingGround;
      expect(building.xpPerSecond).toBeDefined();
      expect(building.xpPerSecond).toBe(0.5);
    });
  });
});

