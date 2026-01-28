import { Router } from 'express';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { gameStates, transactions } from '../../db/schema.js';
import { queryClient } from '../../db/cache.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { createTransactionLogger } from '../../lib/debugLogger.js';
import type {
  ExtractShadowRequest,
  TransactionResponse,
  GameStateDTO,
  Shadow,
  Dungeon,
} from '../../../shared/types.js';
import {
  getDb,
  checkIdempotency,
  extractResources,
  extractResourceCaps,
  transformToGameStateDTO,
  applyPassiveIncomeToGameState,
} from './utils/index.js';

export const shadowsRouter = Router();

/**
 * POST /api/game/extract-shadow
 * Extract a shadow from a defeated enemy
 */
shadowsRouter.post('/extract-shadow', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const { name, dungeonId, clientTxId } = req.body as ExtractShadowRequest;

    const logger = createTransactionLogger('/extract-shadow', userId, clientTxId);

    if (!name || !dungeonId || !clientTxId) {
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

    const dungeons = gameState.dungeons as Dungeon[];
    const dungeon = dungeons.find((d) => d.id === dungeonId);

    if (!dungeon) {
      return res.status(400).json({ success: false, error: 'Invalid dungeon ID' });
    }

    // Cost is based on dungeon rank
    const cost = 1000; // Simplified cost

    const rawResources = extractResources(gameState);
    const rawResourceCaps = extractResourceCaps(gameState);

    logger.start(rawResources, rawResourceCaps);
    logger.beforePassive(rawResources);

    const { resources: currentResources, resourceCaps: currentResourceCaps } =
      applyPassiveIncomeToGameState(gameState);

    logger.afterPassive(currentResources, currentResourceCaps);

    const partialCost = { souls: cost };
    logger.validation(
      `Extract shadow ${name} from ${dungeonId}`,
      partialCost as unknown as Partial<Record<string, number>>,
      currentResources
    );

    if (currentResources.souls < cost) {
      const missing = { souls: cost - currentResources.souls };
      const message = `Need ${Math.ceil(missing.souls)} souls more`;

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

    const shadows = gameState.shadows as Shadow[];
    const newShadow: Shadow = {
      id: `shadow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type: 'shadow',
      originDungeonId: dungeonId,
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
    };

    const newShadows = [...shadows, newShadow];
    const newResources = {
      ...currentResources,
      souls: currentResources.souls - cost,
    };

    const nowDate = new Date();
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
        essenceCap: currentResourceCaps.essence,
        crystalsCap: currentResourceCaps.crystals,
        goldCap: currentResourceCaps.gold,
        soulsCap: currentResourceCaps.souls,
        attractionCap: currentResourceCaps.attraction,
        gemsCap: currentResourceCaps.gems,
        knowledgeCap: currentResourceCaps.knowledge,
        shadows: newShadows,
        lastUpdate: nowDate,
        updatedAt: nowDate,
      })
      .where(eq(gameStates.id, gameState.id));

    await queryClient.invalidateQueries(['gameState', userId]);

    const stateDTO: GameStateDTO = transformToGameStateDTO(
      gameState,
      newResources,
      currentResourceCaps,
      { shadows: newShadows, lastUpdate: nowDate.getTime() }
    );
    logger.success(newResources, currentResourceCaps);

    await db.insert(transactions).values({
      id: randomUUID(),
      userId,
      clientTxId,
      type: 'extract_shadow',
      payload: { name, dungeonId, cost },
      stateAfter: stateDTO,
    });

    res.json({ success: true, state: stateDTO } as TransactionResponse);
  } catch (error) {
    console.error('Error extracting shadow:', error);
    res.status(500).json({ error: 'Failed to extract shadow' });
  }
});
