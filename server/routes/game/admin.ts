import { Router } from 'express';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { gameStates, transactions } from '../../db/schema.js';
import { queryClient } from '../../db/cache.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { initialBuildings } from '../../data/initialBuildings.js';
import type { TransactionResponse, GameStateDTO } from '../../../shared/types.js';
import { getDb, checkIdempotency } from './utils/index.js';
import { BASE_RESOURCE_CAPS } from '../../lib/gameLogic.js';

export const adminRouter = Router();

/**
 * POST /api/game/reset
 * Reset game to initial state
 */
adminRouter.post('/reset', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const { clientTxId } = req.body;

    if (!clientTxId) {
      return res.status(400).json({ error: 'Missing clientTxId' });
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

    const now = new Date();

    // Reset to initial state
    await db
      .update(gameStates)
      .set({
        version: 1,
        essence: 0,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
        essenceCap: 100,
        crystalsCap: 50,
        goldCap: 1000,
        soulsCap: 10,
        attractionCap: 10,
        gemsCap: 100,
        knowledgeCap: 50,
        hunterLevel: 1,
        hunterXp: 0,
        hunterXpToNextLevel: 100,
        hunterRank: 'E',
        hunterStatPoints: 0,
        hunterHp: 100,
        hunterMaxHp: 100,
        hunterMana: 50,
        hunterMaxMana: 50,
        hunterStrength: 10,
        hunterAgility: 10,
        hunterIntelligence: 10,
        hunterVitality: 10,
        hunterSense: 10,
        hunterAuthority: 10,
        buildings: initialBuildings,
        artifacts: {
          equipped: { weapon: null, armor: null, accessory: null },
          inventory: [],
          blacksmithLevel: 1,
          blacksmithXp: 0,
        },
        dungeons: [],
        activeDungeons: [],
        allies: [],
        shadows: [],
        research: {},
        lastUpdate: now,
        updatedAt: now,
      })
      .where(eq(gameStates.id, gameState.id));

    await queryClient.invalidateQueries(['gameState', userId]);

    // Build full state DTO from reset values
    const stateDTO: GameStateDTO = {
      version: 1,
      resources: {
        essence: 0,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      resourceCaps: { ...BASE_RESOURCE_CAPS },
      hunter: {
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        rank: 'E',
        statPoints: 0,
        hp: 100,
        maxHp: 100,
        mana: 50,
        maxMana: 50,
        stats: {
          strength: 10,
          agility: 10,
          intelligence: 10,
          vitality: 10,
          sense: 10,
          authority: 10,
        },
      },
      buildings: initialBuildings,
      artifacts: {
        equipped: {},
        inventory: [],
        blacksmithLevel: 1,
        blacksmithXp: 0,
      },
      dungeons: [],
      activeDungeons: [],
      allies: [],
      shadows: [],
      research: {},
      lastUpdate: now.getTime(),
    };

    await db.insert(transactions).values({
      id: randomUUID(),
      userId,
      clientTxId,
      type: 'reset',
      payload: {},
      stateAfter: stateDTO,
    });

    res.json({ success: true, state: stateDTO } as TransactionResponse);
  } catch (error) {
    console.error('Error resetting game:', error);
    res.status(500).json({ error: 'Failed to reset game' });
  }
});
