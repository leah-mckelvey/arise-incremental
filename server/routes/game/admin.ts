import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { gameStates } from '../../db/schema.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { initialBuildings } from '../../data/initialBuildings.js';
import type { TransactionResponse } from '../../../shared/types.js';
import { getDb, checkIdempotency, commitTransaction } from './utils/index.js';
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

    // Initial hunter for reset
    const initialHunter = {
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      rank: 'E' as const,
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
    };

    const initialArtifacts = {
      equipped: {},
      inventory: [],
      blacksmithLevel: 1,
      blacksmithXp: 0,
    };

    const initialResources = {
      essence: 0,
      crystals: 0,
      gold: 0,
      souls: 0,
      attraction: 0,
      gems: 0,
      knowledge: 0,
    };

    const stateDTO = await commitTransaction({
      userId,
      clientTxId,
      gameState,
      resources: initialResources,
      resourceCaps: { ...BASE_RESOURCE_CAPS },
      dbUpdates: {
        buildings: initialBuildings,
        research: {},
        allies: [],
        shadows: [],
        activeDungeons: [],
        artifacts: initialArtifacts,
        dungeons: [],
        hunterStatPoints: initialHunter.statPoints,
        hunterMaxHp: initialHunter.maxHp,
        hunterMaxMana: initialHunter.maxMana,
        hunterStrength: initialHunter.stats.strength,
        hunterAgility: initialHunter.stats.agility,
        hunterIntelligence: initialHunter.stats.intelligence,
        hunterVitality: initialHunter.stats.vitality,
        hunterSense: initialHunter.stats.sense,
        hunterAuthority: initialHunter.stats.authority,
        hunterLevel: initialHunter.level,
        hunterXp: initialHunter.xp,
        hunterXpToNextLevel: initialHunter.xpToNextLevel,
        hunterHp: initialHunter.hp,
        hunterMana: initialHunter.mana,
      },
      transaction: { type: 'reset', payload: {} },
      overrides: {
        buildings: initialBuildings,
        research: {},
        allies: [],
        shadows: [],
        activeDungeons: [],
        artifacts: initialArtifacts,
        dungeons: [],
        hunter: initialHunter,
      },
    });

    res.json({ success: true, state: stateDTO } as TransactionResponse);
  } catch (error) {
    console.error('Error resetting game:', error);
    res.status(500).json({ error: 'Failed to reset game' });
  }
});
