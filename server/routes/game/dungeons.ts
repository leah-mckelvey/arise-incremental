import { Router } from 'express';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { gameStates, transactions } from '../../db/schema.js';
import { queryClient } from '../../db/cache.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { processXpGain, applyResourceCaps } from '../../lib/gameLogic.js';
import type {
  StartDungeonRequest,
  CompleteDungeonRequest,
  CancelDungeonRequest,
  TransactionResponse,
  GameStateDTO,
  Resources,
  Dungeon,
  ActiveDungeon,
} from '../../../shared/types.js';
import { getDb, checkIdempotency, applyPassiveIncomeToGameState } from './utils/index.js';

export const dungeonsRouter = Router();

/**
 * POST /api/game/start-dungeon
 * Start a dungeon run with a party
 */
dungeonsRouter.post('/start-dungeon', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const { dungeonId, partyIds, clientTxId } = req.body as StartDungeonRequest;

    if (!dungeonId || !clientTxId) {
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
      return res.status(400).json({ error: 'Invalid dungeon ID' });
    }

    if (!dungeon.unlocked) {
      return res.status(400).json({ error: 'Dungeon not unlocked' });
    }

    const activeDungeons = gameState.activeDungeons as ActiveDungeon[];

    // Check if any companions in the party are already assigned to another dungeon
    const busyCompanions = (partyIds || []).filter((companionId) =>
      activeDungeons.some((ad) => ad.partyIds?.includes(companionId))
    );
    if (busyCompanions.length > 0) {
      return res.status(400).json({ error: 'Some companions are already in another dungeon' });
    }

    const now = Date.now();
    const activeDungeonId = `${dungeonId}-${now}-${Math.random().toString(36).substr(2, 9)}`;

    const activeDungeon: ActiveDungeon = {
      id: activeDungeonId,
      dungeonId,
      startTime: now,
      endTime: now + dungeon.duration * 1000,
      partyIds,
    };

    const newActiveDungeons = [...activeDungeons, activeDungeon];

    const { resources: currentResources } = applyPassiveIncomeToGameState(gameState);

    const nowDate = new Date();
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
        activeDungeons: newActiveDungeons,
        lastUpdate: nowDate,
        updatedAt: nowDate,
      })
      .where(eq(gameStates.id, gameState.id));

    await queryClient.invalidateQueries(['gameState', userId]);

    await db.insert(transactions).values({
      id: randomUUID(),
      userId,
      clientTxId,
      type: 'start_dungeon',
      payload: { dungeonId, partyIds },
      stateAfter: {
        resources: currentResources,
        activeDungeons: newActiveDungeons,
      } as unknown as GameStateDTO,
    });

    res.json({
      success: true,
      state: {
        resources: currentResources,
        activeDungeons: newActiveDungeons,
      } as unknown as GameStateDTO,
    } as TransactionResponse);
  } catch (error) {
    console.error('Error starting dungeon:', error);
    res.status(500).json({ error: 'Failed to start dungeon' });
  }
});

/**
 * POST /api/game/complete-dungeon
 * Complete a dungeon and claim rewards
 */
dungeonsRouter.post('/complete-dungeon', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const { activeDungeonId, clientTxId } = req.body as CompleteDungeonRequest;

    if (!activeDungeonId || !clientTxId) {
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

    const activeDungeons = gameState.activeDungeons as ActiveDungeon[];
    const activeDungeon = activeDungeons.find((ad) => ad.id === activeDungeonId);

    if (!activeDungeon) {
      return res.status(400).json({ error: 'Active dungeon not found' });
    }

    const now = Date.now();
    if (now < activeDungeon.endTime) {
      return res.status(400).json({ error: 'Dungeon not complete yet' });
    }

    const dungeons = gameState.dungeons as Dungeon[];
    const dungeon = dungeons.find((d) => d.id === activeDungeon.dungeonId);

    if (!dungeon) {
      return res.status(400).json({ error: 'Dungeon not found' });
    }

    // Apply rewards
    const rewards = dungeon.rewards;
    const newResources: Resources = {
      essence: gameState.essence + (rewards.essence || 0),
      crystals: gameState.crystals + (rewards.crystals || 0),
      gold: gameState.gold + (rewards.gold || 0),
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
    };

    // Apply resource caps
    const resourceCaps = {
      essence: gameState.essenceCap,
      crystals: gameState.crystalsCap,
      gold: gameState.goldCap,
      souls: gameState.soulsCap,
      attraction: gameState.attractionCap,
      gems: gameState.gemsCap,
      knowledge: gameState.knowledgeCap,
    };
    const cappedResources = applyResourceCaps(newResources, resourceCaps);

    // Apply XP
    const hunterState = {
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

    const { hunter: newHunter } = processXpGain(hunterState, rewards.experience || 0);

    // Remove completed dungeon from active dungeons
    const newActiveDungeons = activeDungeons.filter((ad) => ad.id !== activeDungeonId);

    await db
      .update(gameStates)
      .set({
        essence: cappedResources.essence,
        crystals: cappedResources.crystals,
        gold: cappedResources.gold,
        hunterLevel: newHunter.level,
        hunterXp: newHunter.xp,
        hunterXpToNextLevel: newHunter.xpToNextLevel,
        hunterRank: newHunter.rank,
        hunterStatPoints: newHunter.statPoints,
        activeDungeons: newActiveDungeons,
        updatedAt: new Date(),
      })
      .where(eq(gameStates.id, gameState.id));

    await queryClient.invalidateQueries(['gameState', userId]);

    await db.insert(transactions).values({
      id: randomUUID(),
      userId,
      clientTxId,
      type: 'complete_dungeon',
      payload: { activeDungeonId, rewards },
      stateAfter: {
        resources: cappedResources,
        hunter: newHunter,
        activeDungeons: newActiveDungeons,
      } as unknown as GameStateDTO,
    });

    res.json({
      success: true,
      state: {
        resources: cappedResources,
        hunter: newHunter,
        activeDungeons: newActiveDungeons,
      } as unknown as GameStateDTO,
    } as TransactionResponse);
  } catch (error) {
    console.error('Error completing dungeon:', error);
    res.status(500).json({ error: 'Failed to complete dungeon' });
  }
});

/**
 * POST /api/game/cancel-dungeon
 * Cancel an active dungeon run
 */
dungeonsRouter.post('/cancel-dungeon', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const { activeDungeonId, clientTxId } = req.body as CancelDungeonRequest;

    if (!activeDungeonId || !clientTxId) {
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

    const activeDungeons = gameState.activeDungeons as ActiveDungeon[];
    const activeDungeon = activeDungeons.find((ad: ActiveDungeon) => ad.id === activeDungeonId);

    if (!activeDungeon) {
      return res.status(400).json({ error: 'Active dungeon not found' });
    }

    // Remove the active dungeon
    const newActiveDungeons = activeDungeons.filter(
      (ad: ActiveDungeon) => ad.id !== activeDungeonId
    );

    const { resources: currentResources } = applyPassiveIncomeToGameState(gameState);

    const nowDate = new Date();
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
        activeDungeons: newActiveDungeons,
        lastUpdate: nowDate,
        updatedAt: nowDate,
      })
      .where(eq(gameStates.id, gameState.id));

    await queryClient.invalidateQueries(['gameState', userId]);

    await db.insert(transactions).values({
      id: randomUUID(),
      userId,
      clientTxId,
      type: 'cancel_dungeon',
      payload: { activeDungeonId },
      stateAfter: {
        resources: currentResources,
        activeDungeons: newActiveDungeons,
      } as unknown as GameStateDTO,
    });

    res.json({
      success: true,
      state: {
        resources: currentResources,
        activeDungeons: newActiveDungeons,
      } as unknown as GameStateDTO,
    } as TransactionResponse);
  } catch (error) {
    console.error('Error canceling dungeon:', error);
    res.status(500).json({ error: 'Failed to cancel dungeon' });
  }
});
