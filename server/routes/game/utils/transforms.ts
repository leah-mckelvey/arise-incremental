import type { GameState } from '../../../db/schema.js';
import type {
  GameStateDTO,
  Resources,
  ResourceCaps,
  HunterStats,
} from '../../../../shared/types.js';
import {
  parseBuildings,
  parseResearch,
  parseDungeons,
  parseActiveDungeons,
  parseAllies,
  parseShadows,
  parseArtifactsState,
} from '../../../lib/parseGameState.js';

/**
 * Helper to safely get lastUpdate timestamp
 * Returns current time if lastUpdate is null/undefined
 */
export function getLastUpdateTime(lastUpdate: Date | null | undefined): number {
  if (!lastUpdate) return Date.now();
  return new Date(lastUpdate).getTime();
}

/**
 * Extract Resources object from GameState database row
 */
export function extractResources(gameState: GameState): Resources {
  return {
    essence: gameState.essence,
    crystals: gameState.crystals,
    gold: gameState.gold,
    souls: gameState.souls,
    attraction: gameState.attraction,
    gems: gameState.gems,
    knowledge: gameState.knowledge,
  };
}

/**
 * Extract ResourceCaps object from GameState database row
 */
export function extractResourceCaps(gameState: GameState): ResourceCaps {
  return {
    essence: gameState.essenceCap,
    crystals: gameState.crystalsCap,
    gold: gameState.goldCap,
    souls: gameState.soulsCap,
    attraction: gameState.attractionCap,
    gems: gameState.gemsCap,
    knowledge: gameState.knowledgeCap,
  };
}

/**
 * Extract HunterStats object from GameState database row
 */
export function extractHunterStats(gameState: GameState): HunterStats {
  return {
    strength: gameState.hunterStrength,
    agility: gameState.hunterAgility,
    intelligence: gameState.hunterIntelligence,
    vitality: gameState.hunterVitality,
    sense: gameState.hunterSense,
    authority: gameState.hunterAuthority,
  };
}

import type {
  Building,
  Research,
  Dungeon,
  ActiveDungeon,
  Ally,
  Shadow,
  Hunter,
} from '../../../../shared/types.js';
import type { ParsedArtifactsState } from '../../../../shared/schemas.js';

/**
 * Options for overriding specific fields in the transformed DTO
 * Used when we've updated specific fields but haven't re-fetched the game state
 */
export interface TransformOverrides {
  buildings?: Record<string, Building>;
  research?: Record<string, Research>;
  dungeons?: Dungeon[];
  activeDungeons?: ActiveDungeon[];
  allies?: Ally[];
  shadows?: Shadow[];
  artifacts?: ParsedArtifactsState;
  hunter?: Hunter;
  lastUpdate?: number;
}

/**
 * Helper to transform database row to GameStateDTO
 * Used for consistent response formatting
 *
 * @param gameState - The database row (may be stale for updated fields)
 * @param resources - Current resources (after any mutations)
 * @param resourceCaps - Current resource caps (after any mutations)
 * @param overrides - Optional overrides for fields that were updated but not in gameState
 */
export function transformToGameStateDTO(
  gameState: GameState,
  resources: Resources,
  resourceCaps: ResourceCaps,
  overrides?: TransformOverrides
): GameStateDTO {
  const lastUpdateMs = overrides?.lastUpdate ?? new Date(gameState.lastUpdate).getTime();

  return {
    version: gameState.version,
    resources: {
      essence: resources.essence,
      crystals: resources.crystals,
      gold: resources.gold,
      souls: resources.souls,
      attraction: resources.attraction,
      gems: resources.gems,
      knowledge: resources.knowledge,
    },
    resourceCaps: {
      essence: resourceCaps.essence,
      crystals: resourceCaps.crystals,
      gold: resourceCaps.gold,
      souls: resourceCaps.souls,
      attraction: resourceCaps.attraction,
      gems: resourceCaps.gems,
      knowledge: resourceCaps.knowledge,
    },
    hunter: overrides?.hunter ?? {
      level: gameState.hunterLevel,
      xp: gameState.hunterXp,
      xpToNextLevel: gameState.hunterXpToNextLevel,
      rank: gameState.hunterRank,
      statPoints: gameState.hunterStatPoints,
      hp: gameState.hunterHp,
      maxHp: gameState.hunterMaxHp,
      mana: gameState.hunterMana,
      maxMana: gameState.hunterMaxMana,
      stats: {
        strength: gameState.hunterStrength,
        agility: gameState.hunterAgility,
        intelligence: gameState.hunterIntelligence,
        vitality: gameState.hunterVitality,
        sense: gameState.hunterSense,
        authority: gameState.hunterAuthority,
      },
    },
    buildings: overrides?.buildings ?? parseBuildings(gameState.buildings),
    artifacts: overrides?.artifacts ?? parseArtifactsState(gameState.artifacts),
    dungeons: overrides?.dungeons ?? parseDungeons(gameState.dungeons),
    activeDungeons: overrides?.activeDungeons ?? parseActiveDungeons(gameState.activeDungeons),
    allies: overrides?.allies ?? parseAllies(gameState.allies),
    shadows: overrides?.shadows ?? parseShadows(gameState.shadows),
    research: overrides?.research ?? parseResearch(gameState.research),
    lastUpdate: lastUpdateMs,
  };
}
