import { and, eq } from 'drizzle-orm';
import { transactions } from '../../../db/schema.js';
import { getDb } from './dbContext.js';
import type { GameStateDTO } from '../../../../shared/types.js';

export interface IdempotencyResult {
  isDuplicate: boolean;
  existingState?: GameStateDTO;
}

/**
 * Check if a transaction has already been processed (idempotency check).
 * Scoped by userId to prevent cross-user collisions.
 *
 * @returns { isDuplicate: true, existingState } if already processed
 * @returns { isDuplicate: false } if this is a new transaction
 */
export async function checkIdempotency(
  userId: string,
  clientTxId: string
): Promise<IdempotencyResult> {
  const db = getDb();

  const existingTx = await db.query.transactions.findFirst({
    where: and(eq(transactions.clientTxId, clientTxId), eq(transactions.userId, userId)),
  });

  if (existingTx) {
    return {
      isDuplicate: true,
      existingState: existingTx.stateAfter as GameStateDTO,
    };
  }

  return { isDuplicate: false };
}
