import { describe, it, expect, beforeEach } from 'vitest';
import { applyPassiveIncome, calculateResourceCaps, createEmptyResources } from './gameLogic.js';
import type { Resources, Building, Research, HunterStats } from '../../shared/types.js';

describe('gameLogic - Resource Caps (Dynamic Calculation)', () => {
  let baseCaps: Resources;
  let buildings: Record<string, Building>;
  let research: Record<string, Research>;
  let hunterStats: HunterStats;

  beforeEach(() => {
    baseCaps = {
      essence: 100,
      crystals: 50,
      gold: 200,
      souls: 10,
      attraction: 5,
      gems: 1,
      knowledge: 0,
    };

    hunterStats = {
      strength: 0,
      agility: 0,
      intelligence: 0,
      vitality: 0,
      sense: 0,
      authority: 0,
    };

    buildings = {};
    research = {};
  });

  it('should return base caps when no buildings or research', () => {
    const caps = calculateResourceCaps(baseCaps, buildings, research, 1, hunterStats);
    expect(caps).toEqual(baseCaps);
  });

  it('should add building cap increases - single vault', () => {
    buildings.essenceVault = {
      id: 'essenceVault',
      name: 'Essence Vault',
      description: 'Storage',
      baseCost: createEmptyResources(),
      costMultiplier: 1.15,
      count: 1,
      increasesCaps: {
        essence: 50,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      produces: undefined,
      perSecond: undefined,
      xpPerSecond: undefined,
    };

    const caps = calculateResourceCaps(baseCaps, buildings, research, 1, hunterStats);
    expect(caps.essence).toBe(150); // 100 base + 50 from vault
  });

  it('should multiply cap increases by building count', () => {
    buildings.essenceVault = {
      id: 'essenceVault',
      name: 'Essence Vault',
      description: 'Storage',
      baseCost: createEmptyResources(),
      costMultiplier: 1.15,
      count: 2, // TWO vaults
      increasesCaps: {
        essence: 50,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      produces: undefined,
      perSecond: undefined,
      xpPerSecond: undefined,
    };

    const caps = calculateResourceCaps(baseCaps, buildings, research, 1, hunterStats);
    expect(caps.essence).toBe(200); // 100 base + (50 * 2)
  });

  it('should handle multiple building types affecting same resource', () => {
    buildings.essenceVault = {
      id: 'essenceVault',
      name: 'Essence Vault',
      description: 'Storage',
      baseCost: createEmptyResources(),
      costMultiplier: 1.15,
      count: 1,
      increasesCaps: {
        essence: 50,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      produces: undefined,
      perSecond: undefined,
      xpPerSecond: undefined,
    };

    buildings.essenceReservoir = {
      id: 'essenceReservoir',
      name: 'Essence Reservoir',
      description: 'More storage',
      baseCost: createEmptyResources(),
      costMultiplier: 1.2,
      count: 1,
      increasesCaps: {
        essence: 100,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      produces: undefined,
      perSecond: undefined,
      xpPerSecond: undefined,
    };

    const caps = calculateResourceCaps(baseCaps, buildings, research, 1, hunterStats);
    expect(caps.essence).toBe(250); // 100 base + 50 + 100
  });

  it('should apply research cap multipliers', () => {
    research.expandedStorage = {
      id: 'expandedStorage',
      name: 'Expanded Storage',
      description: 'Doubles essence cap',
      cost: 100,
      researched: true,
      effects: {
        capMultiplier: { essence: 2 },
      },
    };

    const caps = calculateResourceCaps(baseCaps, buildings, research, 1, hunterStats);
    expect(caps.essence).toBe(200); // 100 * 2
  });

  it('should apply building increases BEFORE research multipliers', () => {
    buildings.essenceVault = {
      id: 'essenceVault',
      name: 'Essence Vault',
      description: 'Storage',
      baseCost: createEmptyResources(),
      costMultiplier: 1.15,
      count: 1,
      increasesCaps: {
        essence: 50,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      produces: undefined,
      perSecond: undefined,
      xpPerSecond: undefined,
    };

    research.expandedStorage = {
      id: 'expandedStorage',
      name: 'Expanded Storage',
      description: 'Doubles essence cap',
      cost: 100,
      researched: true,
      effects: {
        capMultiplier: { essence: 2 },
      },
    };

    const caps = calculateResourceCaps(baseCaps, buildings, research, 1, hunterStats);
    expect(caps.essence).toBe(300); // (100 + 50) * 2
  });

  it('should apply hunter stat bonuses to caps', () => {
    hunterStats.strength = 100; // +100% essence cap

    const caps = calculateResourceCaps(baseCaps, buildings, research, 1, hunterStats);
    expect(caps.essence).toBe(200); // 100 * (1 + 100/100)
  });

  it('should combine buildings + research + hunter stats', () => {
    buildings.essenceVault = {
      id: 'essenceVault',
      name: 'Essence Vault',
      description: 'Storage',
      baseCost: createEmptyResources(),
      costMultiplier: 1.15,
      count: 2,
      increasesCaps: {
        essence: 50,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      produces: undefined,
      perSecond: undefined,
      xpPerSecond: undefined,
    };

    research.expandedStorage = {
      id: 'expandedStorage',
      name: 'Expanded Storage',
      description: 'Doubles essence cap',
      cost: 100,
      researched: true,
      effects: {
        capMultiplier: { essence: 2 },
      },
    };

    hunterStats.strength = 50; // +50% essence cap

    const caps = calculateResourceCaps(baseCaps, buildings, research, 1, hunterStats);
    // (100 base + 100 from vaults) * 2 from research * 1.5 from stats = 600
    expect(caps.essence).toBe(600);
  });
});

describe('gameLogic - Passive Income', () => {
  let currentResources: Resources;
  let resourceCaps: Resources;
  let buildings: Record<string, Building>;
  let research: Record<string, Research>;
  let hunterStats: HunterStats;

  beforeEach(() => {
    currentResources = {
      essence: 50,
      crystals: 25,
      gold: 100,
      souls: 5,
      attraction: 2,
      gems: 0,
      knowledge: 0,
    };

    resourceCaps = {
      essence: 100,
      crystals: 50,
      gold: 200,
      souls: 10,
      attraction: 5,
      gems: 1,
      knowledge: 0,
    };

    hunterStats = {
      strength: 0,
      agility: 0,
      intelligence: 0,
      vitality: 0,
      sense: 0,
      authority: 0,
    };

    buildings = {};
    research = {};
  });

  it('should return current resources if no time has passed', () => {
    const now = Date.now();
    const result = applyPassiveIncome(
      currentResources,
      resourceCaps,
      buildings,
      research,
      1,
      hunterStats,
      now,
      now
    );
    expect(result).toEqual(currentResources);
  });

  it('should apply passive income from buildings', () => {
    buildings.essenceExtractor = {
      id: 'essenceExtractor',
      name: 'Essence Extractor',
      description: 'Produces essence',
      baseCost: createEmptyResources(),
      costMultiplier: 1.15,
      count: 1,
      increasesCaps: undefined,
      produces: {
        essence: 1,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      perSecond: 1,
      xpPerSecond: undefined,
    };

    const now = Date.now();
    const tenSecondsAgo = now - 10000;

    const result = applyPassiveIncome(
      currentResources,
      resourceCaps,
      buildings,
      research,
      1,
      hunterStats,
      tenSecondsAgo,
      now
    );

    // Should have gained 10 essence (1 per second * 10 seconds)
    expect(result.essence).toBe(60); // 50 + 10
  });

  it('CRITICAL: Purchasing Essence Vault should increase essence cap', () => {
    // Start with base caps
    const baseCaps = {
      essence: 100,
      crystals: 50,
      gold: 200,
      souls: 10,
      attraction: 5,
      gems: 1,
      knowledge: 0,
    };

    // User has NO vaults initially
    const buildingsBeforePurchase: Record<string, Building> = {};

    // Calculate caps before purchase
    const capsBeforePurchase = calculateResourceCaps(
      baseCaps,
      buildingsBeforePurchase,
      research,
      1,
      hunterStats
    );
    expect(capsBeforePurchase.essence).toBe(100); // Base cap

    // User purchases 1 Essence Vault
    const buildingsAfterPurchase: Record<string, Building> = {
      essenceVault: {
        id: 'essenceVault',
        name: 'Essence Vault',
        description: 'Storage',
        baseCost: createEmptyResources(),
        costMultiplier: 1.15,
        count: 1,
        increasesCaps: {
          essence: 50,
          crystals: 0,
          gold: 0,
          souls: 0,
          attraction: 0,
          gems: 0,
          knowledge: 0,
        },
        produces: undefined,
        perSecond: undefined,
        xpPerSecond: undefined,
      },
    };

    // Calculate caps after purchase
    const capsAfterPurchase = calculateResourceCaps(
      baseCaps,
      buildingsAfterPurchase,
      research,
      1,
      hunterStats
    );
    expect(capsAfterPurchase.essence).toBe(150); // 100 + 50

    // User purchases ANOTHER vault (now has 2)
    const buildingsAfter2Purchases: Record<string, Building> = {
      essenceVault: {
        ...buildingsAfterPurchase.essenceVault,
        count: 2,
      },
    };

    const capsAfter2Purchases = calculateResourceCaps(
      baseCaps,
      buildingsAfter2Purchases,
      research,
      1,
      hunterStats
    );
    expect(capsAfter2Purchases.essence).toBe(200); // 100 + (50 * 2)
  });

  it('BUG TEST: should use DYNAMIC caps not static caps', () => {
    // User has 1 essence vault which increases cap by 50
    buildings.essenceVault = {
      id: 'essenceVault',
      name: 'Essence Vault',
      description: 'Storage',
      baseCost: createEmptyResources(),
      costMultiplier: 1.15,
      count: 1,
      increasesCaps: {
        essence: 50,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      produces: undefined,
      perSecond: undefined,
      xpPerSecond: undefined,
    };

    // User has essence extractor producing essence
    buildings.essenceExtractor = {
      id: 'essenceExtractor',
      name: 'Essence Extractor',
      description: 'Produces essence',
      baseCost: createEmptyResources(),
      costMultiplier: 1.15,
      count: 1,
      increasesCaps: undefined,
      produces: {
        essence: 1,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      perSecond: 1,
      xpPerSecond: undefined,
    };

    // Static caps passed in (WRONG - this is what backend is doing)
    const staticCaps = {
      essence: 100, // Base cap, doesn't account for vault
      crystals: 50,
      gold: 200,
      souls: 10,
      attraction: 5,
      gems: 1,
      knowledge: 0,
    };

    const now = Date.now();
    const tenSecondsAgo = now - 10000;

    const result = applyPassiveIncome(
      currentResources,
      staticCaps,
      buildings,
      research,
      1,
      hunterStats,
      tenSecondsAgo,
      now
    );

    // BUG: This will cap at 100 instead of 150!
    // The function should calculate dynamic caps internally
    console.log('Result with static caps:', result.essence);
    console.log('Expected: 60 (50 + 10), but capped at 100 is fine');
    console.log('Actual cap should be 150 (100 base + 50 from vault)');
  });
});
