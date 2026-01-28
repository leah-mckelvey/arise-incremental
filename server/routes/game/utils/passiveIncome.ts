import type { GameState } from '../../../db/schema.js';
import type { Resources, ResourceCaps } from '../../../../shared/types.js';
import { parseBuildings, parseResearch } from '../../../lib/parseGameState.js';
import {
  applyPassiveIncome,
  calculateResourceCaps,
  BASE_RESOURCE_CAPS,
} from '../../../lib/gameLogic.js';
import { extractResources, extractHunterStats, getLastUpdateTime } from './transforms.js';

export interface PassiveIncomeResult {
  resources: Resources;
  resourceCaps: ResourceCaps;
}

/**
 * Apply passive income to a game state and calculate dynamic resource caps.
 * This is a common pattern used in most transaction endpoints.
 *
 * @param gameState - The current game state from the database
 * @param now - The current timestamp (defaults to Date.now())
 * @returns Updated resources and resource caps after applying passive income
 */
export function applyPassiveIncomeToGameState(
  gameState: GameState,
  now: number = Date.now()
): PassiveIncomeResult {
  const rawResources = extractResources(gameState);
  const hunterStats = extractHunterStats(gameState);
  const buildings = parseBuildings(gameState.buildings);
  const research = parseResearch(gameState.research);

  // Apply passive income since lastUpdate
  const resources = applyPassiveIncome(
    rawResources,
    BASE_RESOURCE_CAPS,
    buildings,
    research,
    gameState.hunterLevel,
    hunterStats,
    getLastUpdateTime(gameState.lastUpdate),
    now
  );

  // Calculate dynamic caps to account for buildings/research/hunter stats
  const resourceCaps = calculateResourceCaps(
    BASE_RESOURCE_CAPS,
    buildings,
    research,
    gameState.hunterLevel,
    hunterStats
  );

  return { resources, resourceCaps };
}
