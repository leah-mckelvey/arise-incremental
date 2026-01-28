/**
 * Server-side game logic
 * Uses shared calculation functions for consistency with frontend
 */

import type {
  Resources,
  ResourceCaps,
  Hunter,
  HunterStats,
  Building,
  Research,
  GameStateDTO,
  OfflineGains,
} from '../../shared/types.js';

// Import shared calculation functions
import {
  calculateResourceCaps as calculateResourceCapsShared,
  calculateTickGains as calculateTickGainsShared,
  calculateGatherXp as calculateGatherXpShared,
} from '../../shared/calculations/resourceCalculations.js';
import {
  calculateBuildingCost as calculateBuildingCostShared,
  canAffordCost as canAffordCostShared,
} from '../../shared/calculations/buildingCalculations.js';

// Re-export shared functions for use in route handlers
export const calculateResourceCaps = calculateResourceCapsShared;
export const calculateGatherXp = calculateGatherXpShared;

// ============================================================================
// Constants
// ============================================================================

const MAX_OFFLINE_TIME_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Base resource caps before any buildings, research, or hunter bonuses
 * These are the starting caps that get modified by game progression
 * IMPORTANT: Pass these to applyPassiveIncome(), NOT the caps from the database
 */
export const BASE_RESOURCE_CAPS: Resources = {
  essence: 100,
  crystals: 100,
  gold: 200,
  souls: 50,
  attraction: 5,
  gems: 1,
  knowledge: 100,
};

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

// Re-export shared function (handles Partial<Resources> via type coercion)
export const canAffordCost = (resources: Resources, cost: Partial<Resources>): boolean => {
  const fullCost: Resources = {
    essence: cost.essence ?? 0,
    crystals: cost.crystals ?? 0,
    gold: cost.gold ?? 0,
    souls: cost.souls ?? 0,
    attraction: cost.attraction ?? 0,
    gems: cost.gems ?? 0,
    knowledge: cost.knowledge ?? 0,
  };
  return canAffordCostShared(resources, fullCost);
};

/**
 * Get missing resources for a cost
 * Returns an object with only the resources that are insufficient
 */
export function getMissingResources(
  resources: Resources,
  cost: Partial<Resources>
): Partial<Resources> {
  const missing: Partial<Resources> = {};

  if (cost.essence !== undefined && resources.essence < cost.essence) {
    missing.essence = cost.essence - resources.essence;
  }
  if (cost.crystals !== undefined && resources.crystals < cost.crystals) {
    missing.crystals = cost.crystals - resources.crystals;
  }
  if (cost.gold !== undefined && resources.gold < cost.gold) {
    missing.gold = cost.gold - resources.gold;
  }
  if (cost.souls !== undefined && resources.souls < cost.souls) {
    missing.souls = cost.souls - resources.souls;
  }
  if (cost.attraction !== undefined && resources.attraction < cost.attraction) {
    missing.attraction = cost.attraction - resources.attraction;
  }
  if (cost.gems !== undefined && resources.gems < cost.gems) {
    missing.gems = cost.gems - resources.gems;
  }
  if (cost.knowledge !== undefined && resources.knowledge < cost.knowledge) {
    missing.knowledge = cost.knowledge - resources.knowledge;
  }

  return missing;
}

/**
 * Format missing resources into a human-readable error message
 */
export function formatMissingResourcesMessage(missing: Partial<Resources>): string {
  const parts: string[] = [];

  if (missing.essence) parts.push(`${Math.ceil(missing.essence)} essence`);
  if (missing.crystals) parts.push(`${Math.ceil(missing.crystals)} crystals`);
  if (missing.gold) parts.push(`${Math.ceil(missing.gold)} gold`);
  if (missing.souls) parts.push(`${Math.ceil(missing.souls)} souls`);
  if (missing.attraction) parts.push(`${Math.ceil(missing.attraction)} attraction`);
  if (missing.gems) parts.push(`${Math.ceil(missing.gems)} gems`);
  if (missing.knowledge) parts.push(`${Math.ceil(missing.knowledge)} knowledge`);

  if (parts.length === 0) return 'Insufficient resources';
  if (parts.length === 1) return `Need ${parts[0]} more`;
  if (parts.length === 2) return `Need ${parts[0]} and ${parts[1]} more`;

  const lastPart = parts.pop();
  return `Need ${parts.join(', ')}, and ${lastPart} more`;
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
// Building Calculations (using shared functions)
// ============================================================================

// Re-export shared function
export const calculateBuildingCost = calculateBuildingCostShared;

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
// Production Calculations (using shared functions)
// ============================================================================

/**
 * Calculate tick gains using shared calculation function
 * This properly accounts for research, hunter stats, synergies, etc.
 */
export function calculateTickGains(
  buildings: Record<string, Building>,
  research: Record<string, Research>,
  resources: Resources,
  hunterLevel: number,
  tickDuration: number, // in seconds
  hunterStats?: HunterStats
): { resourceGains: Resources; xpGain: number } {
  return calculateTickGainsShared(buildings, research, resources, hunterLevel, tickDuration, hunterStats);
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

  // Calculate resource and XP gains using shared function
  const { resourceGains, xpGain } = calculateTickGains(
    state.buildings,
    state.research,
    state.resources,
    state.hunter.level,
    deltaSeconds,
    state.hunter.stats
  );

  return {
    timeAway,
    resourceGains,
    xpGained: xpGain,
    capped: timeAway > MAX_OFFLINE_TIME_MS,
  };
}

/**
 * Apply passive income since lastUpdate to current resources
 * This should be called BEFORE any validation in mutations
 * Uses shared calculation functions to properly account for research, hunter stats, synergies, etc.
 *
 * IMPORTANT: This function calculates DYNAMIC resource caps based on buildings/research/hunter stats.
 * Do NOT pass static caps from the database - they will be recalculated here.
 */
export function applyPassiveIncome(
  currentResources: Resources,
  baseCaps: Resources,
  buildings: Record<string, Building>,
  research: Record<string, Research>,
  hunterLevel: number,
  hunterStats: HunterStats,
  lastUpdate: number | null | undefined,
  now: number = Date.now(),
): Resources {
  // If lastUpdate is null/undefined, use current time (no passive income)
  const lastUpdateTime = lastUpdate ?? now;
  const deltaMs = Math.max(0, now - lastUpdateTime);
  const deltaSeconds = deltaMs / 1000;

  // Calculate DYNAMIC resource caps (accounts for buildings, research, hunter stats)
  const dynamicCaps = calculateResourceCaps(baseCaps, buildings, research, hunterLevel, hunterStats);

  // Calculate passive gains using shared function (includes all bonuses)
  const { resourceGains } = calculateTickGains(
    buildings,
    research,
    currentResources,
    hunterLevel,
    deltaSeconds,
    hunterStats
  );

  // Add gains to current resources and apply DYNAMIC caps
  const newResources = addResources(currentResources, resourceGains);
  return applyResourceCaps(newResources, dynamicCaps);
}

