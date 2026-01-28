import { Router } from 'express';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { gameStates, transactions } from '../../db/schema.js';
import { queryClient } from '../../db/cache.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { processXpGain, calculateGatherXp } from '../../lib/gameLogic.js';
import { createTransactionLogger } from '../../lib/debugLogger.js';
import type {
  GatherResourceRequest,
  TransactionResponse,
  GameStateDTO,
  Resources,
} from '../../../shared/types.js';
import {
  getDb,
  checkIdempotency,
  extractResources,
  extractResourceCaps,
  extractHunterStats,
  transformToGameStateDTO,
  applyPassiveIncomeToGameState,
} from './utils/index.js';

export const resourcesRouter = Router();

const VALID_RESOURCES = ['essence', 'crystals', 'gold', 'souls', 'attraction', 'gems', 'knowledge'];

/**
 * POST /api/game/gather-resource
 * Manually gather a resource (clicking buttons)
 */
resourcesRouter.post('/gather-resource', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const { resource, clientTxId } = req.body as GatherResourceRequest;

    // Create debug logger
    const logger = createTransactionLogger('/gather-resource', userId, clientTxId);

    // Validation
    if (!resource || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!VALID_RESOURCES.includes(resource)) {
      return res.status(400).json({ error: 'Invalid resource type' });
    }

    // Anti-cheat: always gather exactly 1
    const amount = 1;

    // Check for duplicate transaction (idempotency)
    const idempotencyResult = await checkIdempotency(userId, clientTxId);
    if (idempotencyResult.isDuplicate) {
      return res.json({ success: true, state: idempotencyResult.existingState });
    }

    // Get current game state
    const gameState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameState) {
      return res.status(404).json({ error: 'Game state not found' });
    }

    const rawResources = extractResources(gameState);
    const rawResourceCaps = extractResourceCaps(gameState);
    const hunterStats = extractHunterStats(gameState);

    // Log initial state
    logger.start(rawResources, rawResourceCaps);
    logger.beforePassive(rawResources);

    // Apply passive income and get dynamic caps
    const { resources: currentResources, resourceCaps: dynamicCaps } =
      applyPassiveIncomeToGameState(gameState);

    logger.afterPassive(currentResources, dynamicCaps);

    // Apply resource gain (with cap check)
    const resourceKey = resource as keyof Resources;
    const currentValue = currentResources[resourceKey];
    const cap = dynamicCaps[resourceKey];
    const newValue = Math.min(currentValue + amount, cap);

    const newResources = {
      ...currentResources,
      [resourceKey]: newValue,
    };

    // Calculate and apply XP gain for gathering (only for essence, crystals, gold)
    let newHunter = {
      level: gameState.hunterLevel,
      xp: gameState.hunterXp,
      xpToNextLevel: gameState.hunterXpToNextLevel,
      rank: gameState.hunterRank,
      statPoints: gameState.hunterStatPoints,
      hp: gameState.hunterHp,
      maxHp: gameState.hunterMaxHp,
      mana: gameState.hunterMana,
      maxMana: gameState.hunterMaxMana,
      stats: hunterStats,
    };

    if (resource === 'essence' || resource === 'crystals' || resource === 'gold') {
      const xpGain = calculateGatherXp(resource, hunterStats);
      const result = processXpGain(newHunter, xpGain);
      newHunter = result.hunter;
    }

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
        essenceCap: dynamicCaps.essence,
        crystalsCap: dynamicCaps.crystals,
        goldCap: dynamicCaps.gold,
        soulsCap: dynamicCaps.souls,
        attractionCap: dynamicCaps.attraction,
        gemsCap: dynamicCaps.gems,
        knowledgeCap: dynamicCaps.knowledge,
        hunterXp: newHunter.xp,
        hunterLevel: newHunter.level,
        hunterXpToNextLevel: newHunter.xpToNextLevel,
        hunterRank: newHunter.rank,
        hunterStatPoints: newHunter.statPoints,
        hunterHp: newHunter.hp,
        hunterMaxHp: newHunter.maxHp,
        hunterMana: newHunter.mana,
        hunterMaxMana: newHunter.maxMana,
        lastUpdate: now,
        updatedAt: now,
      })
      .where(eq(gameStates.id, gameState.id));

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Transform to DTO
    const stateDTO: GameStateDTO = transformToGameStateDTO(gameState, newResources, dynamicCaps, {
      hunter: newHunter,
      lastUpdate: now.getTime(),
    });

    // Log success
    logger.success(newResources, dynamicCaps);

    // Log transaction
    await db.insert(transactions).values({
      id: randomUUID(),
      userId,
      clientTxId,
      type: 'gather-resource',
      payload: { resource, amount },
      stateAfter: stateDTO,
    });

    const response: TransactionResponse = {
      success: true,
      state: stateDTO,
    };

    res.json(response);
  } catch (error) {
    console.error('Error gathering resource:', error);
    res.status(500).json({ error: 'Failed to gather resource' });
  }
});
