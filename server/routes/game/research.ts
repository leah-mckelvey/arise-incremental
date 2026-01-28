import { Router } from 'express';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { gameStates, transactions } from '../../db/schema.js';
import { queryClient } from '../../db/cache.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { calculateResourceCaps, BASE_RESOURCE_CAPS } from '../../lib/gameLogic.js';
import { createTransactionLogger } from '../../lib/debugLogger.js';
import type {
  PurchaseResearchRequest,
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
  transformToGameStateDTO,
  applyPassiveIncomeToGameState,
} from './utils/index.js';

export const researchRouter = Router();

/**
 * POST /api/game/purchase-research
 * Purchase a research upgrade with knowledge
 */
researchRouter.post('/purchase-research', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const { researchId, clientTxId } = req.body as PurchaseResearchRequest;

    const logger = createTransactionLogger('/purchase-research', userId, clientTxId);

    if (!researchId || !clientTxId) {
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

    const research = parseResearch(gameState.research);
    const researchItem = research[researchId];

    if (!researchItem) {
      return res.status(400).json({ success: false, error: 'Invalid research ID' });
    }

    if (researchItem.researched) {
      return res.status(400).json({ success: false, error: 'Research already purchased' });
    }

    // Check prerequisites
    if (researchItem.requires) {
      const hasPrereqs = researchItem.requires.every(
        (reqId: string) => research[reqId]?.researched
      );
      if (!hasPrereqs) {
        return res.status(400).json({ success: false, error: 'Prerequisites not met' });
      }
    }

    const rawResources = extractResources(gameState);
    const rawResourceCaps = extractResourceCaps(gameState);
    const hunterStats = extractHunterStats(gameState);
    const buildings = parseBuildings(gameState.buildings);

    logger.start(rawResources, rawResourceCaps);
    logger.beforePassive(rawResources);

    const { resources: currentResources, resourceCaps: currentResourceCaps } =
      applyPassiveIncomeToGameState(gameState);

    logger.afterPassive(currentResources, currentResourceCaps);

    // Check affordability (research costs knowledge)
    const cost = researchItem.cost;
    const partialCost = { knowledge: cost };

    logger.validation(
      `Purchase research ${researchId}`,
      partialCost as unknown as Partial<Record<string, number>>,
      currentResources
    );

    if (currentResources.knowledge < cost) {
      const missing = { knowledge: cost - currentResources.knowledge };
      const message = `Need ${Math.ceil(missing.knowledge)} knowledge more`;

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

    // Update research and deduct knowledge
    const newResearch = {
      ...research,
      [researchId]: { ...researchItem, researched: true },
    };

    const newResources = {
      ...currentResources,
      knowledge: currentResources.knowledge - cost,
    };

    // Recalculate resource caps with new research
    const newResourceCaps = calculateResourceCaps(
      BASE_RESOURCE_CAPS,
      buildings,
      newResearch,
      gameState.hunterLevel,
      hunterStats
    );

    const now = new Date();
    await db
      .update(gameStates)
      .set({
        essence: newResources.essence,
        crystals: newResources.crystals,
        gold: newResources.gold,
        souls: newResources.souls,
        attraction: newResources.attraction,
        gems: newResources.gems,
        knowledge: newResources.knowledge,
        essenceCap: newResourceCaps.essence,
        crystalsCap: newResourceCaps.crystals,
        goldCap: newResourceCaps.gold,
        soulsCap: newResourceCaps.souls,
        attractionCap: newResourceCaps.attraction,
        gemsCap: newResourceCaps.gems,
        knowledgeCap: newResourceCaps.knowledge,
        research: newResearch,
        lastUpdate: now,
        updatedAt: now,
      })
      .where(eq(gameStates.id, gameState.id));

    await queryClient.invalidateQueries(['gameState', userId]);

    const stateDTO: GameStateDTO = transformToGameStateDTO(
      gameState,
      newResources,
      newResourceCaps,
      { research: newResearch, lastUpdate: now.getTime() }
    );
    logger.success(newResources, newResourceCaps);

    await db.insert(transactions).values({
      id: randomUUID(),
      userId,
      clientTxId,
      type: 'purchase_research',
      payload: { researchId, cost },
      stateAfter: stateDTO,
    });

    res.json({ success: true, state: stateDTO } as TransactionResponse);
  } catch (error) {
    console.error('Error purchasing research:', error);
    res.status(500).json({ error: 'Failed to purchase research' });
  }
});
