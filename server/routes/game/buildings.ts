import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { gameStates } from '../../db/schema.js';
import { type AuthRequest } from '../../middleware/auth.js';
import {
  subtractResources,
  canAffordCost,
  getMissingResources,
  formatMissingResourcesMessage,
  calculateBuildingCost,
  calculateBulkBuildingCost,
  calculateResourceCaps,
  BASE_RESOURCE_CAPS,
} from '../../lib/gameLogic.js';
import { createTransactionLogger } from '../../lib/debugLogger.js';
import type {
  PurchaseBuildingRequest,
  PurchaseBulkBuildingRequest,
  TransactionResponse,
  GameStateDTO,
} from '../../../shared/types.js';
import { parseBuildings, parseResearch } from '../../lib/parseGameState.js';
import {
  getDb,
  checkIdempotency,
  extractResources,
  extractResourceCaps,
  extractHunterStats,
  applyPassiveIncomeToGameState,
  commitTransaction,
  transformToGameStateDTO,
} from './utils/index.js';

export const buildingsRouter = Router();

/**
 * POST /api/game/purchase-building
 * Purchase a single building with anti-cheat validation
 */
buildingsRouter.post('/purchase-building', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const { buildingId, clientTxId } = req.body as PurchaseBuildingRequest;

    const logger = createTransactionLogger('/purchase-building', userId, clientTxId);

    if (!buildingId || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const idempotencyResult = await checkIdempotency(userId, clientTxId);
    if (idempotencyResult.isDuplicate) {
      return res.json({ success: true, state: idempotencyResult.existingState });
    }

    const gameState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameState) {
      return res.status(404).json({ error: 'Game state not found' });
    }

    const buildings = parseBuildings(gameState.buildings);
    const building = buildings[buildingId];

    if (!building) {
      return res.status(400).json({ error: 'Invalid building ID' });
    }

    const cost = calculateBuildingCost(building);
    const rawResources = extractResources(gameState);
    const rawResourceCaps = extractResourceCaps(gameState);
    const hunterStats = extractHunterStats(gameState);
    const research = parseResearch(gameState.research);

    logger.start(rawResources, rawResourceCaps);
    logger.beforePassive(rawResources);

    const { resources: currentResources, resourceCaps: currentResourceCaps } =
      applyPassiveIncomeToGameState(gameState);

    logger.afterPassive(currentResources, currentResourceCaps);
    logger.validation(
      `Purchase ${buildingId}`,
      cost as unknown as Partial<Record<string, number>>,
      currentResources
    );

    if (!canAffordCost(currentResources, cost)) {
      const missing = getMissingResources(currentResources, cost);
      const message = formatMissingResourcesMessage(missing);
      logger.error(message, currentResources);

      const stateDTO: GameStateDTO = transformToGameStateDTO(
        gameState,
        currentResources,
        currentResourceCaps
      );

      return res.status(400).json({
        success: false,
        error: message,
        missing,
        state: stateDTO,
      });
    }

    const newResources = subtractResources(currentResources, cost);
    const newBuildings = {
      ...buildings,
      [buildingId]: { ...building, count: building.count + 1 },
    };

    const newResourceCaps = calculateResourceCaps(
      BASE_RESOURCE_CAPS,
      newBuildings,
      research,
      gameState.hunterLevel,
      hunterStats
    );

    console.log('🏗️ PURCHASE BUILDING:', buildingId);
    console.log('  Building count:', building.count, '->', newBuildings[buildingId].count);
    console.log('  Old essence cap:', gameState.essenceCap);
    console.log('  New essence cap:', newResourceCaps.essence);
    console.log('  Building increasesCaps:', building.increasesCaps);

    const stateDTO = await commitTransaction({
      userId,
      clientTxId,
      gameState,
      resources: newResources,
      resourceCaps: newResourceCaps,
      dbUpdates: { buildings: newBuildings },
      transaction: { type: 'purchase_building', payload: { buildingId, cost, quantity: 1 } },
      overrides: { buildings: newBuildings },
    });

    logger.success(newResources, newResourceCaps);
    res.json({ success: true, state: stateDTO } as TransactionResponse);
  } catch (error) {
    console.error('Error purchasing building:', error);
    res.status(500).json({ error: 'Failed to purchase building' });
  }
});

/**
 * POST /api/game/purchase-bulk-building
 * Purchase multiple buildings at once with anti-cheat validation
 */
buildingsRouter.post('/purchase-bulk-building', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const { buildingId, quantity, clientTxId } = req.body as PurchaseBulkBuildingRequest;

    const logger = createTransactionLogger('/purchase-bulk-building', userId, clientTxId);

    if (!buildingId || !quantity || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (quantity < 1 || quantity > 100) {
      return res.status(400).json({ error: 'Invalid quantity (must be 1-100)' });
    }

    const idempotencyResult = await checkIdempotency(userId, clientTxId);
    if (idempotencyResult.isDuplicate) {
      return res.json({ success: true, state: idempotencyResult.existingState });
    }

    const gameState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameState) {
      return res.status(404).json({ error: 'Game state not found' });
    }

    const buildings = parseBuildings(gameState.buildings);
    const building = buildings[buildingId];

    if (!building) {
      return res.status(400).json({ error: 'Invalid building ID' });
    }

    const cost = calculateBulkBuildingCost(building, quantity);
    const rawResources = extractResources(gameState);
    const rawResourceCaps = extractResourceCaps(gameState);
    const hunterStats = extractHunterStats(gameState);
    const research = parseResearch(gameState.research);

    logger.start(rawResources, rawResourceCaps);
    logger.beforePassive(rawResources);

    const { resources: currentResources, resourceCaps: currentResourceCaps } =
      applyPassiveIncomeToGameState(gameState);

    logger.afterPassive(currentResources, currentResourceCaps);
    logger.validation(
      `Purchase ${quantity}x ${buildingId}`,
      cost as unknown as Partial<Record<string, number>>,
      currentResources
    );

    if (!canAffordCost(currentResources, cost)) {
      const missing = getMissingResources(currentResources, cost);
      const message = formatMissingResourcesMessage(missing);
      logger.error(message, currentResources);

      const stateDTO: GameStateDTO = transformToGameStateDTO(
        gameState,
        currentResources,
        currentResourceCaps
      );

      return res.status(400).json({
        success: false,
        error: message,
        missing,
        state: stateDTO,
      });
    }

    const newResources = subtractResources(currentResources, cost);
    const newBuildings = {
      ...buildings,
      [buildingId]: { ...building, count: building.count + quantity },
    };

    const newResourceCaps = calculateResourceCaps(
      BASE_RESOURCE_CAPS,
      newBuildings,
      research,
      gameState.hunterLevel,
      hunterStats
    );

    const stateDTO = await commitTransaction({
      userId,
      clientTxId,
      gameState,
      resources: newResources,
      resourceCaps: newResourceCaps,
      dbUpdates: { buildings: newBuildings },
      transaction: { type: 'purchase_bulk_building', payload: { buildingId, cost, quantity } },
      overrides: { buildings: newBuildings },
    });

    logger.success(newResources, newResourceCaps);
    res.json({ success: true, state: stateDTO } as TransactionResponse);
  } catch (error) {
    console.error('Error purchasing bulk buildings:', error);
    res.status(500).json({ error: 'Failed to purchase buildings' });
  }
});
