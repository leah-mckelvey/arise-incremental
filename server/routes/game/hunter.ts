import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { gameStates } from '../../db/schema.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { allocateStat } from '../../lib/gameLogic.js';
import type { AllocateStatRequest, TransactionResponse } from '../../../shared/types.js';
import {
  getDb,
  checkIdempotency,
  applyPassiveIncomeToGameState,
  extractResourceCaps,
  commitTransaction,
} from './utils/index.js';

export const hunterRouter = Router();

const VALID_STATS = ['strength', 'agility', 'intelligence', 'vitality', 'sense', 'authority'];

/**
 * POST /api/game/allocate-stat
 * Allocate a stat point to a hunter stat
 */
hunterRouter.post('/allocate-stat', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const { stat, clientTxId } = req.body as AllocateStatRequest;

    if (!stat || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!VALID_STATS.includes(stat)) {
      return res.status(400).json({ error: 'Invalid stat' });
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

    // Anti-cheat: Verify player has stat points
    if (gameState.hunterStatPoints <= 0) {
      return res.status(400).json({ error: 'No stat points available' });
    }

    const hunter = {
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
    };

    const newHunter = allocateStat(hunter, stat);

    if (!newHunter) {
      return res.status(400).json({ error: 'Failed to allocate stat' });
    }

    // Apply passive income (even though this mutation doesn't consume resources)
    const { resources: currentResources } = applyPassiveIncomeToGameState(gameState);
    const resourceCaps = extractResourceCaps(gameState);

    const stateDTO = await commitTransaction({
      userId,
      clientTxId,
      gameState,
      resources: currentResources,
      resourceCaps,
      dbUpdates: {
        hunterStatPoints: newHunter.statPoints,
        hunterMaxHp: newHunter.maxHp,
        hunterMaxMana: newHunter.maxMana,
        hunterStrength: newHunter.stats.strength,
        hunterAgility: newHunter.stats.agility,
        hunterIntelligence: newHunter.stats.intelligence,
        hunterVitality: newHunter.stats.vitality,
        hunterSense: newHunter.stats.sense,
        hunterAuthority: newHunter.stats.authority,
      },
      transaction: { type: 'allocate_stat', payload: { stat } },
      overrides: { hunter: newHunter },
    });

    res.json({ success: true, state: stateDTO } as TransactionResponse);
  } catch (error) {
    console.error('Error allocating stat:', error);
    res.status(500).json({ error: 'Failed to allocate stat' });
  }
});
