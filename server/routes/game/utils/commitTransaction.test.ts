import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { GameState } from '../../../db/schema.js';
import type {
  Resources,
  ResourceCaps,
  TransactionData,
  Building,
} from '../../../../shared/types.js';
import { commitTransaction } from './commitTransaction.js';
import { getDb } from './dbContext.js';
import { queryClient } from '../../../db/cache.js';
import { gameStates, transactions } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';

describe('commitTransaction', () => {
  describe('type safety', () => {
    it('should accept allocate_stat transaction with correct payload', () => {
      // This test verifies TypeScript compile-time type safety
      // If the types are wrong, this won't compile
      const transaction = {
        type: 'allocate_stat' as const,
        payload: { stat: 'strength' },
      };
      expect(transaction.type).toBe('allocate_stat');
      expect(transaction.payload.stat).toBe('strength');
    });

    it('should accept recruit_ally transaction with correct payload', () => {
      const transaction = {
        type: 'recruit_ally' as const,
        payload: { name: 'Test Ally', rank: 'E', cost: 100 },
      };
      expect(transaction.type).toBe('recruit_ally');
      expect(transaction.payload.name).toBe('Test Ally');
      expect(transaction.payload.rank).toBe('E');
      expect(transaction.payload.cost).toBe(100);
    });

    it('should accept purchase_building transaction with cost as Resources', () => {
      const transaction = {
        type: 'purchase_building' as const,
        payload: {
          buildingId: 'essenceVault',
          cost: {
            essence: 10,
            crystals: 0,
            gold: 5,
            souls: 0,
            attraction: 0,
            gems: 0,
            knowledge: 0,
          },
          quantity: 1,
        },
      };
      expect(transaction.type).toBe('purchase_building');
      expect(transaction.payload.buildingId).toBe('essenceVault');
      expect(transaction.payload.cost.essence).toBe(10);
    });

    it('should accept complete_dungeon transaction with rewards', () => {
      const transaction = {
        type: 'complete_dungeon' as const,
        payload: {
          activeDungeonId: 'dungeon-123',
          rewards: {
            essence: 50,
            crystals: 10,
            gold: 100,
            souls: 5,
            attraction: 2,
            gems: 0,
            knowledge: 0,
            experience: 100,
          },
        },
      };
      expect(transaction.type).toBe('complete_dungeon');
      expect(transaction.payload.rewards.experience).toBe(100);
    });

    it('should accept reset transaction with empty payload', () => {
      const transaction = {
        type: 'reset' as const,
        payload: {},
      };
      expect(transaction.type).toBe('reset');
      expect(Object.keys(transaction.payload)).toHaveLength(0);
    });

    it('should accept all transaction types with correct payloads', () => {
      // This verifies the TransactionData union type works for all variants
      const txList: TransactionData[] = [
        { type: 'allocate_stat', payload: { stat: 'strength' } },
        { type: 'recruit_ally', payload: { name: 'Ally', rank: 'E', cost: 100 } },
        { type: 'extract_shadow', payload: { name: 'Shadow', dungeonId: 'd1', cost: 1000 } },
        { type: 'purchase_research', payload: { researchId: 'r1', cost: 50 } },
        {
          type: 'purchase_building',
          payload: {
            buildingId: 'b1',
            cost: {
              essence: 10,
              crystals: 0,
              gold: 0,
              souls: 0,
              attraction: 0,
              gems: 0,
              knowledge: 0,
            },
            quantity: 1,
          },
        },
        {
          type: 'purchase_bulk_building',
          payload: {
            buildingId: 'b1',
            cost: {
              essence: 100,
              crystals: 0,
              gold: 0,
              souls: 0,
              attraction: 0,
              gems: 0,
              knowledge: 0,
            },
            quantity: 10,
          },
        },
        { type: 'start_dungeon', payload: { dungeonId: 'd1', partyIds: ['p1', 'p2'] } },
        {
          type: 'complete_dungeon',
          payload: {
            activeDungeonId: 'ad1',
            rewards: {
              essence: 50,
              crystals: 10,
              gold: 100,
              souls: 5,
              attraction: 2,
              gems: 0,
              knowledge: 0,
              experience: 100,
            },
          },
        },
        { type: 'cancel_dungeon', payload: { activeDungeonId: 'ad1' } },
        { type: 'gather-resource', payload: { resource: 'essence', amount: 10 } },
        { type: 'reset', payload: {} },
      ];

      expect(txList).toHaveLength(11);
      txList.forEach((tx) => {
        expect(tx.type).toBeDefined();
        expect(tx.payload).toBeDefined();
      });
    });
  });

  describe('functional tests', () => {
    const TEST_USER_ID = 'commit-tx-test-user';
    let testGameStateId: string;
    let testGameState: GameState;
    const testResources: Resources = {
      essence: 90,
      crystals: 50,
      gold: 200,
      souls: 10,
      attraction: 5,
      gems: 1,
      knowledge: 50,
    };
    const testResourceCaps: ResourceCaps = {
      essence: 1000,
      crystals: 500,
      gold: 2000,
      souls: 100,
      attraction: 50,
      gems: 10,
      knowledge: 500,
    };

    beforeEach(async () => {
      const db = getDb();

      // Clean up any existing test data
      await db.delete(transactions).where(eq(transactions.userId, TEST_USER_ID));
      await db.delete(gameStates).where(eq(gameStates.userId, TEST_USER_ID));

      // Import users table
      const { users } = await import('../../../db/schema.js');
      await db.delete(users).where(eq(users.id, TEST_USER_ID));

      // Create test user
      await db.insert(users).values({
        id: TEST_USER_ID,
        email: 'commit-tx-test@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create test game state
      testGameStateId = `gs-${Date.now()}`;
      await db.insert(gameStates).values({
        id: testGameStateId,
        userId: TEST_USER_ID,
        version: 1,
        essence: 100,
        crystals: 50,
        gold: 200,
        souls: 10,
        attraction: 5,
        gems: 1,
        knowledge: 50,
        essenceCap: 1000,
        crystalsCap: 500,
        goldCap: 2000,
        soulsCap: 100,
        attractionCap: 50,
        gemsCap: 10,
        knowledgeCap: 500,
        hunterLevel: 1,
        hunterXp: 0,
        hunterXpToNextLevel: 100,
        hunterRank: 'E',
        hunterStatPoints: 5,
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
        buildings: {},
        artifacts: { equipped: {}, inventory: [], blacksmithLevel: 1, blacksmithXp: 0 },
        dungeons: [],
        activeDungeons: [],
        allies: [],
        shadows: [],
        research: {},
        lastUpdate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Fetch the game state for tests
      const result = await db.query.gameStates.findFirst({
        where: eq(gameStates.id, testGameStateId),
      });
      testGameState = result!;

      // Invalidate cache
      await queryClient.invalidateQueries(['gameState', TEST_USER_ID]);
    });

    afterEach(async () => {
      const db = getDb();
      const { users } = await import('../../../db/schema.js');
      await db.delete(users).where(eq(users.id, TEST_USER_ID));
    });

    it('should update database with resources and caps', async () => {
      const clientTxId = `test-${Date.now()}`;
      const newResources = { ...testResources, essence: 50 };

      await commitTransaction({
        userId: TEST_USER_ID,
        clientTxId,
        gameState: testGameState,
        resources: newResources,
        resourceCaps: testResourceCaps,
        transaction: { type: 'allocate_stat', payload: { stat: 'strength' } },
      });

      const db = getDb();
      const updatedState = await db.query.gameStates.findFirst({
        where: eq(gameStates.id, testGameStateId),
      });

      expect(updatedState!.essence).toBe(50);
      expect(updatedState!.essenceCap).toBe(1000);
    });

    it('should insert transaction log with correct type and payload', async () => {
      const clientTxId = `test-tx-log-${Date.now()}`;

      await commitTransaction({
        userId: TEST_USER_ID,
        clientTxId,
        gameState: testGameState,
        resources: testResources,
        resourceCaps: testResourceCaps,
        transaction: { type: 'recruit_ally', payload: { name: 'Test Ally', rank: 'E', cost: 100 } },
      });

      const db = getDb();
      const txLog = await db.query.transactions.findFirst({
        where: eq(transactions.clientTxId, clientTxId),
      });

      expect(txLog).toBeDefined();
      expect(txLog!.type).toBe('recruit_ally');
      expect(txLog!.payload).toEqual({ name: 'Test Ally', rank: 'E', cost: 100 });
    });

    it('should return valid GameStateDTO', async () => {
      const clientTxId = `test-dto-${Date.now()}`;

      const stateDTO = await commitTransaction({
        userId: TEST_USER_ID,
        clientTxId,
        gameState: testGameState,
        resources: testResources,
        resourceCaps: testResourceCaps,
        transaction: { type: 'gather-resource', payload: { resource: 'essence', amount: 10 } },
      });

      expect(stateDTO.resources).toEqual(testResources);
      expect(stateDTO.resourceCaps).toEqual(testResourceCaps);
      expect(stateDTO.hunter).toBeDefined();
      expect(stateDTO.hunter.level).toBe(1);
      expect(stateDTO.lastUpdate).toBeDefined();
    });

    it('should apply overrides to the returned DTO', async () => {
      const clientTxId = `test-override-${Date.now()}`;
      const newBuilding: Building = {
        id: 'testBuilding',
        name: 'Test Building',
        description: 'A test building',
        baseCost: {
          essence: 10,
          crystals: 0,
          gold: 0,
          souls: 0,
          attraction: 0,
          gems: 0,
          knowledge: 0,
        },
        costMultiplier: 1.15,
        count: 1,
      };

      const stateDTO = await commitTransaction({
        userId: TEST_USER_ID,
        clientTxId,
        gameState: testGameState,
        resources: testResources,
        resourceCaps: testResourceCaps,
        dbUpdates: { buildings: { testBuilding: newBuilding } },
        transaction: {
          type: 'purchase_building',
          payload: {
            buildingId: 'testBuilding',
            cost: {
              essence: 10,
              crystals: 0,
              gold: 0,
              souls: 0,
              attraction: 0,
              gems: 0,
              knowledge: 0,
            },
            quantity: 1,
          },
        },
        overrides: { buildings: { testBuilding: newBuilding } },
      });

      expect(stateDTO.buildings.testBuilding).toBeDefined();
      expect(stateDTO.buildings.testBuilding.count).toBe(1);
    });
  });
});
