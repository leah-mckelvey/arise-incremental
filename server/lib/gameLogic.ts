/**
 * Server-side game logic
 * Mirrors the frontend calculations but runs on the server for anti-cheat
 */

import type {
  Resources,
  ResourceCaps,
  Hunter,
  HunterStats,
  Building,
  GameStateDTO,
  OfflineGains,
} from '../../shared/types.js';

// ============================================================================
// Constants
// ============================================================================

const MAX_OFFLINE_TIME_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// Resource Helpers
// ============================================================================

export function createEmptyResources(): Resources {
  return {
    essence: 0,
    crystals: 0,
    gold: 0,
    souls: 0,
    attraction: 0,
    gems: 0,
    knowledge: 0,
  };
}

export function addResources(a: Resources, b: Partial<Resources>): Resources {
  return {
    essence: a.essence + (b.essence ?? 0),
    crystals: a.crystals + (b.crystals ?? 0),
    gold: a.gold + (b.gold ?? 0),
    souls: a.souls + (b.souls ?? 0),
    attraction: a.attraction + (b.attraction ?? 0),
    gems: a.gems + (b.gems ?? 0),
    knowledge: a.knowledge + (b.knowledge ?? 0),
  };
}

export function subtractResources(a: Resources, b: Partial<Resources>): Resources {
  return {
    essence: a.essence - (b.essence ?? 0),
    crystals: a.crystals - (b.crystals ?? 0),
    gold: a.gold - (b.gold ?? 0),
    souls: a.souls - (b.souls ?? 0),
    attraction: a.attraction - (b.attraction ?? 0),
    gems: a.gems - (b.gems ?? 0),
    knowledge: a.knowledge - (b.knowledge ?? 0),
  };
}

export function canAffordCost(resources: Resources, cost: Partial<Resources>): boolean {
  return (
    resources.essence >= (cost.essence ?? 0) &&
    resources.crystals >= (cost.crystals ?? 0) &&
    resources.gold >= (cost.gold ?? 0) &&
    resources.souls >= (cost.souls ?? 0) &&
    resources.attraction >= (cost.attraction ?? 0) &&
    resources.gems >= (cost.gems ?? 0) &&
    resources.knowledge >= (cost.knowledge ?? 0)
  );
}

export function applyResourceCaps(resources: Resources, caps: ResourceCaps): Resources {
  return {
    essence: Math.min(resources.essence, caps.essence),
    crystals: Math.min(resources.crystals, caps.crystals),
    gold: Math.min(resources.gold, caps.gold),
    souls: Math.min(resources.souls, caps.souls),
    attraction: Math.min(resources.attraction, caps.attraction),
    gems: Math.min(resources.gems, caps.gems),
    knowledge: Math.min(resources.knowledge, caps.knowledge),
  };
}

// ============================================================================
// Building Calculations
// ============================================================================

export function calculateBuildingCost(building: Building): Resources {
  const multiplier = Math.pow(building.costMultiplier, building.count);
  return {
    essence: Math.floor((building.baseCost.essence ?? 0) * multiplier),
    crystals: Math.floor((building.baseCost.crystals ?? 0) * multiplier),
    gold: Math.floor((building.baseCost.gold ?? 0) * multiplier),
    souls: Math.floor((building.baseCost.souls ?? 0) * multiplier),
    attraction: Math.floor((building.baseCost.attraction ?? 0) * multiplier),
    gems: Math.floor((building.baseCost.gems ?? 0) * multiplier),
    knowledge: Math.floor((building.baseCost.knowledge ?? 0) * multiplier),
  };
}

export function calculateBulkBuildingCost(building: Building, quantity: number): Resources {
  let totalCost = createEmptyResources();
  let currentCount = building.count;

  for (let i = 0; i < quantity; i++) {
    const tempBuilding = { ...building, count: currentCount };
    const cost = calculateBuildingCost(tempBuilding);
    totalCost = addResources(totalCost, cost);
    currentCount++;
  }

  return totalCost;
}

// ============================================================================
// Production Calculations
// ============================================================================

export function calculateTickGains(
  buildings: Record<string, Building>,
  tickDuration: number, // in seconds
): Resources {
  let gains = createEmptyResources();

  for (const building of Object.values(buildings)) {
    if (building.count > 0 && building.produces && building.perSecond) {
      const production = building.produces;
      const rate = building.perSecond;
      const amount = building.count * rate * tickDuration;

      gains = addResources(gains, {
        essence: (production.essence ?? 0) * amount,
        crystals: (production.crystals ?? 0) * amount,
        gold: (production.gold ?? 0) * amount,
        souls: (production.souls ?? 0) * amount,
        attraction: (production.attraction ?? 0) * amount,
        gems: (production.gems ?? 0) * amount,
        knowledge: (production.knowledge ?? 0) * amount,
      });
    }
  }

  return gains;
}

export function calculateXpGains(
  buildings: Record<string, Building>,
  tickDuration: number, // in seconds
): number {
  let xpGain = 0;

  for (const building of Object.values(buildings)) {
    if (building.count > 0 && building.xpPerSecond) {
      xpGain += building.count * building.xpPerSecond * tickDuration;
    }
  }

  return xpGain;
}

// ============================================================================
// Hunter Calculations
// ============================================================================

export function calculateXpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function calculateRank(level: number): string {
  if (level >= 100) return 'S';
  if (level >= 80) return 'A';
  if (level >= 60) return 'B';
  if (level >= 40) return 'C';
  if (level >= 20) return 'D';
  return 'E';
}

export function processXpGain(hunter: Hunter, xpGain: number): { hunter: Hunter; levelsGained: number } {
  const newHunter = { ...hunter };
  let newXp = newHunter.xp + xpGain;
  let levelsGained = 0;

  while (newXp >= newHunter.xpToNextLevel) {
    newXp -= newHunter.xpToNextLevel;
    newHunter.level += 1;
    newHunter.statPoints += 3; // 3 stat points per level
    newHunter.xpToNextLevel = calculateXpToNextLevel(newHunter.level);
    newHunter.rank = calculateRank(newHunter.level);
    levelsGained++;

    // Increase max HP and mana on level up
    newHunter.maxHp += 10;
    newHunter.hp = newHunter.maxHp; // Full heal on level up
    newHunter.maxMana += 5;
    newHunter.mana = newHunter.maxMana; // Full mana on level up
  }

  newHunter.xp = newXp;
  return { hunter: newHunter, levelsGained };
}

export function allocateStat(hunter: Hunter, stat: keyof HunterStats): Hunter | null {
  if (hunter.statPoints <= 0) return null;

  const newHunter = { ...hunter };
  newHunter.stats = { ...newHunter.stats };
  newHunter.stats[stat] += 1;
  newHunter.statPoints -= 1;

  // Update derived stats
  newHunter.maxHp = 100 + newHunter.stats.vitality * 10;
  newHunter.maxMana = 50 + newHunter.stats.intelligence * 5;

  return newHunter;
}

// ============================================================================
// Offline Gains
// ============================================================================

export function calculateOfflineGains(
  state: GameStateDTO,
  lastUpdate: number,
  now: number = Date.now(),
): OfflineGains {
  const timeAway = Math.max(0, now - lastUpdate);
  const cappedTime = Math.min(timeAway, MAX_OFFLINE_TIME_MS);
  const deltaSeconds = cappedTime / 1000;

  // Calculate resource gains
  const resourceGains = calculateTickGains(state.buildings, deltaSeconds);

  // Calculate XP gains
  const xpGained = calculateXpGains(state.buildings, deltaSeconds);

  return {
    timeAway,
    resourceGains,
    xpGained,
    capped: timeAway > MAX_OFFLINE_TIME_MS,
  };
}

