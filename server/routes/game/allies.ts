import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { gameStates } from '../../db/schema.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { createTransactionLogger } from '../../lib/debugLogger.js';
import type {
  RecruitAllyRequest,
  TransactionResponse,
  GameStateDTO,
  Ally,
} from '../../../shared/types.js';
import {
  getDb,
  checkIdempotency,
  extractResources,
  extractResourceCaps,
  applyPassiveIncomeToGameState,
  commitTransaction,
  transformToGameStateDTO,
} from './utils/index.js';

export const alliesRouter = Router();

const RANK_COSTS: Record<string, number> = {
  E: 100,
  D: 300,
  C: 1000,
  B: 3000,
  A: 10000,
  S: 30000,
};

/**
 * POST /api/game/recruit-ally
 * Recruit a new ally with attraction
 */
alliesRouter.post('/recruit-ally', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const { name, rank, clientTxId } = req.body as RecruitAllyRequest;

    const logger = createTransactionLogger('/recruit-ally', userId, clientTxId);

    if (!name || !rank || !clientTxId) {
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

    const cost = RANK_COSTS[rank] || 100;

    const rawResources = extractResources(gameState);
    const rawResourceCaps = extractResourceCaps(gameState);

    logger.start(rawResources, rawResourceCaps);
    logger.beforePassive(rawResources);

    const { resources: currentResources, resourceCaps: currentResourceCaps } =
      applyPassiveIncomeToGameState(gameState);

    logger.afterPassive(currentResources, currentResourceCaps);

    const partialCost = { attraction: cost };
    logger.validation(
      `Recruit ${rank}-rank ally ${name}`,
      partialCost as unknown as Partial<Record<string, number>>,
      currentResources
    );

    if (currentResources.attraction < cost) {
      const missing = { attraction: cost - currentResources.attraction };
      const message = `Need ${Math.ceil(missing.attraction)} attraction more`;

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

    const allies = gameState.allies as Ally[];
    const newAlly: Ally = {
      id: `ally-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type: 'ally',
      originDungeonId: 'recruitment',
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
    };

    const newAllies = [...allies, newAlly];
    const newResources = {
      ...currentResources,
      attraction: currentResources.attraction - cost,
    };

    const stateDTO = await commitTransaction({
      userId,
      clientTxId,
      gameState,
      resources: newResources,
      resourceCaps: currentResourceCaps,
      dbUpdates: { allies: newAllies },
      transaction: { type: 'recruit_ally', payload: { name, rank, cost } },
      overrides: { allies: newAllies },
    });

    logger.success(newResources, currentResourceCaps);
    res.json({ success: true, state: stateDTO } as TransactionResponse);
  } catch (error) {
    console.error('Error recruiting ally:', error);
    res.status(500).json({ error: 'Failed to recruit ally' });
  }
});
