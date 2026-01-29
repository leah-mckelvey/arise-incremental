import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import type { GameState } from '../../../db/schema.js';
import { gameStates, transactions } from '../../../db/schema.js';
import { queryClient } from '../../../db/cache.js';
import type {
  Resources,
  ResourceCaps,
  GameStateDTO,
  TransactionData,
  Building,
  Research,
  Dungeon,
  ActiveDungeon,
  Ally,
  Shadow,
} from '../../../../shared/types.js';
import type { ParsedArtifactsState } from '../../../../shared/schemas.js';
import { getDb } from './dbContext.js';
import { transformToGameStateDTO, type TransformOverrides } from './transforms.js';

/**
 * Database update fields for game state.
 * All fields are optional - only specify what you're updating.
 */
export interface GameStateDbUpdates {
  // Domain-specific fields
  buildings?: Record<string, Building>;
  research?: Record<string, Research>;
  allies?: Ally[];
  shadows?: Shadow[];
  activeDungeons?: ActiveDungeon[];
  artifacts?: ParsedArtifactsState;
  dungeons?: Dungeon[];

  // Hunter fields
  hunterStatPoints?: number;
  hunterMaxHp?: number;
  hunterMaxMana?: number;
  hunterStrength?: number;
  hunterAgility?: number;
  hunterIntelligence?: number;
  hunterVitality?: number;
  hunterSense?: number;
  hunterAuthority?: number;
  hunterLevel?: number;
  hunterXp?: number;
  hunterXpToNextLevel?: number;
  hunterHp?: number;
  hunterMana?: number;
}

/**
 * Parameters for committing a transaction.
 * Generic type T ensures the transaction type and payload are correctly paired.
 */
export interface CommitTransactionParams<T extends TransactionData> {
  userId: string;
  clientTxId: string;
  gameState: GameState;
  resources: Resources;
  resourceCaps: ResourceCaps;
  dbUpdates?: GameStateDbUpdates;
  transaction: T;
  overrides?: TransformOverrides;
}

/**
 * Commits a transaction to the database.
 * This is the common pattern used by all transaction endpoints:
 * 1. Update database with resources/caps + domain-specific fields
 * 2. Invalidate cache
 * 3. Build stateDTO with transformToGameStateDTO
 * 4. Insert transaction log
 * 5. Return the stateDTO
 *
 * @param params - Transaction parameters
 * @returns The GameStateDTO after the transaction
 */
export async function commitTransaction<T extends TransactionData>(
  params: CommitTransactionParams<T>
): Promise<GameStateDTO> {
  const {
    userId,
    clientTxId,
    gameState,
    resources,
    resourceCaps,
    dbUpdates,
    transaction,
    overrides,
  } = params;

  const db = getDb();
  const now = new Date();

  // Build the database update object
  const dbUpdateObj: Record<string, unknown> = {
    // Resources
    essence: resources.essence,
    crystals: resources.crystals,
    gold: resources.gold,
    souls: resources.souls,
    attraction: resources.attraction,
    gems: resources.gems,
    knowledge: resources.knowledge,
    // Resource caps
    essenceCap: resourceCaps.essence,
    crystalsCap: resourceCaps.crystals,
    goldCap: resourceCaps.gold,
    soulsCap: resourceCaps.souls,
    attractionCap: resourceCaps.attraction,
    gemsCap: resourceCaps.gems,
    knowledgeCap: resourceCaps.knowledge,
    // Timestamps
    lastUpdate: now,
    updatedAt: now,
  };

  // Add domain-specific updates
  if (dbUpdates) {
    if (dbUpdates.buildings !== undefined) dbUpdateObj.buildings = dbUpdates.buildings;
    if (dbUpdates.research !== undefined) dbUpdateObj.research = dbUpdates.research;
    if (dbUpdates.allies !== undefined) dbUpdateObj.allies = dbUpdates.allies;
    if (dbUpdates.shadows !== undefined) dbUpdateObj.shadows = dbUpdates.shadows;
    if (dbUpdates.activeDungeons !== undefined)
      dbUpdateObj.activeDungeons = dbUpdates.activeDungeons;
    if (dbUpdates.artifacts !== undefined) dbUpdateObj.artifacts = dbUpdates.artifacts;
    if (dbUpdates.dungeons !== undefined) dbUpdateObj.dungeons = dbUpdates.dungeons;

    // Hunter stat updates
    if (dbUpdates.hunterStatPoints !== undefined)
      dbUpdateObj.hunterStatPoints = dbUpdates.hunterStatPoints;
    if (dbUpdates.hunterMaxHp !== undefined) dbUpdateObj.hunterMaxHp = dbUpdates.hunterMaxHp;
    if (dbUpdates.hunterMaxMana !== undefined) dbUpdateObj.hunterMaxMana = dbUpdates.hunterMaxMana;
    if (dbUpdates.hunterStrength !== undefined)
      dbUpdateObj.hunterStrength = dbUpdates.hunterStrength;
    if (dbUpdates.hunterAgility !== undefined) dbUpdateObj.hunterAgility = dbUpdates.hunterAgility;
    if (dbUpdates.hunterIntelligence !== undefined)
      dbUpdateObj.hunterIntelligence = dbUpdates.hunterIntelligence;
    if (dbUpdates.hunterVitality !== undefined)
      dbUpdateObj.hunterVitality = dbUpdates.hunterVitality;
    if (dbUpdates.hunterSense !== undefined) dbUpdateObj.hunterSense = dbUpdates.hunterSense;
    if (dbUpdates.hunterAuthority !== undefined)
      dbUpdateObj.hunterAuthority = dbUpdates.hunterAuthority;
    if (dbUpdates.hunterLevel !== undefined) dbUpdateObj.hunterLevel = dbUpdates.hunterLevel;
    if (dbUpdates.hunterXp !== undefined) dbUpdateObj.hunterXp = dbUpdates.hunterXp;
    if (dbUpdates.hunterXpToNextLevel !== undefined)
      dbUpdateObj.hunterXpToNextLevel = dbUpdates.hunterXpToNextLevel;
    if (dbUpdates.hunterHp !== undefined) dbUpdateObj.hunterHp = dbUpdates.hunterHp;
    if (dbUpdates.hunterMana !== undefined) dbUpdateObj.hunterMana = dbUpdates.hunterMana;
  }

  // 1. Update database
  await db.update(gameStates).set(dbUpdateObj).where(eq(gameStates.id, gameState.id));

  // 2. Invalidate cache
  await queryClient.invalidateQueries(['gameState', userId]);

  // 3. Build stateDTO with overrides
  const finalOverrides: TransformOverrides = {
    ...overrides,
    lastUpdate: now.getTime(),
  };

  const stateDTO: GameStateDTO = transformToGameStateDTO(
    gameState,
    resources,
    resourceCaps,
    finalOverrides
  );

  // 4. Insert transaction log
  await db.insert(transactions).values({
    id: randomUUID(),
    userId,
    clientTxId,
    type: transaction.type,
    payload: transaction.payload,
    stateAfter: stateDTO,
  });

  return stateDTO;
}
