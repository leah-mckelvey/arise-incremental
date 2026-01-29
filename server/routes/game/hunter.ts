import { Router } from 'express';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { gameStates, transactions } from '../../db/schema.js';
import { queryClient } from '../../db/cache.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { allocateStat } from '../../lib/gameLogic.js';
import type {
  AllocateStatRequest,
  TransactionResponse,
  GameStateDTO,
} from '../../../shared/types.js';
import {
  getDb,
  checkIdempotency,
  applyPassiveIncomeToGameState,
  extractResourceCaps,
  transformToGameStateDTO,
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

    // Update database
    const now = new Date();
    await db
      .update(gameStates)
      .set({
        essence: currentResources.essence,
        crystals: currentResources.crystals,
        gold: currentResources.gold,
        souls: currentResources.souls,
        attraction: currentResources.attraction,
        gems: currentResources.gems,
        knowledge: currentResources.knowledge,
        hunterStatPoints: newHunter.statPoints,
        hunterMaxHp: newHunter.maxHp,
        hunterMaxMana: newHunter.maxMana,
        hunterStrength: newHunter.stats.strength,
        hunterAgility: newHunter.stats.agility,
        hunterIntelligence: newHunter.stats.intelligence,
        hunterVitality: newHunter.stats.vitality,
        hunterSense: newHunter.stats.sense,
        hunterAuthority: newHunter.stats.authority,
        lastUpdate: now,
        updatedAt: now,
      })
      .where(eq(gameStates.id, gameState.id));

    await queryClient.invalidateQueries(['gameState', userId]);

    const resourceCaps = extractResourceCaps(gameState);
    const stateDTO: GameStateDTO = transformToGameStateDTO(
      gameState,
      currentResources,
      resourceCaps,
      { hunter: newHunter, lastUpdate: now.getTime() }
    );

    await db.insert(transactions).values({
      id: randomUUID(),
      userId,
      clientTxId,
      type: 'allocate_stat',
      payload: { stat },
      stateAfter: stateDTO,
    });

    res.json({ success: true, state: stateDTO } as TransactionResponse);
  } catch (error) {
    console.error('Error allocating stat:', error);
    res.status(500).json({ error: 'Failed to allocate stat' });
  }
});
