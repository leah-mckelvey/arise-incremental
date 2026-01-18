import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, gameStates, transactions } from '../db/schema.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { queryClient, CACHE_TTL } from '../db/cache.js';
import {
  addResources,
  subtractResources,
  canAffordCost,
  applyResourceCaps,
  calculateBuildingCost,
  calculateBulkBuildingCost,
  calculateOfflineGains,
  processXpGain,
  allocateStat,
} from '../lib/gameLogic.js';
import { initialBuildings } from '../data/initialBuildings.js';
import type {
  GameStateResponse,
  TransactionResponse,
  GatherResourceRequest,
  PurchaseBuildingRequest,
  PurchaseBulkBuildingRequest,
  AllocateStatRequest,
  GameStateDTO,
  Resources,
  Building,
} from '../../shared/types.js';

export const gameRouter = Router();

// All game routes require authentication
gameRouter.use(authMiddleware);

/**
 * GET /api/game/state
 * Load current game state with offline gains calculation
 * Uses ts-query pattern with L1/L2/L3 caching
 */
gameRouter.get('/state', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Use queryClient.getQuery for cached reads
    const gameStateQuery = queryClient.getQuery({
      queryKey: ['gameState', userId],
      queryFn: async () => {
        // L3: Database query
        // Ensure user exists
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });

        if (!user) {
          // Create new user
          await db.insert(users).values({
            id: userId,
            email: req.user?.email,
          });
        }

        // Get or create game state
        let gameState = await db.query.gameStates.findFirst({
          where: eq(gameStates.userId, userId),
        });

        if (!gameState) {
          // Create initial game state with Solo Leveling defaults
          const now = new Date();
          const [newState] = await db
            .insert(gameStates)
            .values({
              id: crypto.randomUUID(),
              userId,
              version: 1,
              // Resources start at 0
              essence: 0,
              crystals: 0,
              gold: 0,
              souls: 0,
              attraction: 0,
              gems: 0,
              knowledge: 0,
              // Resource caps from initial hunter
              essenceCap: 100,
              crystalsCap: 50,
              goldCap: 1000,
              soulsCap: 10,
              attractionCap: 10,
              gemsCap: 100,
              knowledgeCap: 50,
              // Hunter starts at level 1
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
              // Empty collections
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
            })
            .returning();

          gameState = newState;
        }

        return gameState;
      },
      staleTime: CACHE_TTL.GAME_STATE,
      sharedCacheTtl: CACHE_TTL.GAME_STATE,
    });

    const gameState = await gameStateQuery.fetch();

    // Calculate offline gains
    const now = Date.now();
    const lastUpdateMs = new Date(gameState.lastUpdate).getTime();

    const stateDTO: GameStateDTO = {
      version: gameState.version,
      resources: {
        essence: gameState.essence,
        crystals: gameState.crystals,
        gold: gameState.gold,
        souls: gameState.souls,
        attraction: gameState.attraction,
        gems: gameState.gems,
        knowledge: gameState.knowledge,
      },
      resourceCaps: {
        essence: gameState.essenceCap,
        crystals: gameState.crystalsCap,
        gold: gameState.goldCap,
        souls: gameState.soulsCap,
        attraction: gameState.attractionCap,
        gems: gameState.gemsCap,
        knowledge: gameState.knowledgeCap,
      },
      hunter: {
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
      },
      buildings: gameState.buildings as Record<string, Building>,
      artifacts: gameState.artifacts as unknown as GameStateDTO['artifacts'],
      dungeons: gameState.dungeons as unknown as GameStateDTO['dungeons'],
      activeDungeons: gameState.activeDungeons as unknown as GameStateDTO['activeDungeons'],
      allies: gameState.allies as unknown as GameStateDTO['allies'],
      shadows: gameState.shadows as unknown as GameStateDTO['shadows'],
      research: gameState.research as unknown as GameStateDTO['research'],
      lastUpdate: lastUpdateMs,
    };

    const offlineGainsData = calculateOfflineGains(stateDTO, lastUpdateMs, now);

    // Apply offline gains
    let newResources = addResources(stateDTO.resources, offlineGainsData.resourceGains);
    newResources = applyResourceCaps(newResources, stateDTO.resourceCaps);

    const { hunter: newHunter } = processXpGain(stateDTO.hunter, offlineGainsData.xpGained);

    // Update database with new resources, XP, and timestamp
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
        hunterLevel: newHunter.level,
        hunterXp: newHunter.xp,
        hunterXpToNextLevel: newHunter.xpToNextLevel,
        hunterRank: newHunter.rank,
        hunterStatPoints: newHunter.statPoints,
        hunterHp: newHunter.hp,
        hunterMaxHp: newHunter.maxHp,
        hunterMana: newHunter.mana,
        hunterMaxMana: newHunter.maxMana,
        hunterStrength: newHunter.stats.strength,
        hunterAgility: newHunter.stats.agility,
        hunterIntelligence: newHunter.stats.intelligence,
        hunterVitality: newHunter.stats.vitality,
        hunterSense: newHunter.stats.sense,
        hunterAuthority: newHunter.stats.authority,
        lastUpdate: new Date(now),
        updatedAt: new Date(),
      })
      .where(eq(gameStates.id, gameState.id));

    // Invalidate cache after mutation
    await queryClient.invalidateQueries(['gameState', userId]);

    const response: GameStateResponse = {
      state: {
        ...stateDTO,
        resources: newResources,
        hunter: newHunter,
        lastUpdate: now,
      },
      offlineGains:
        offlineGainsData.timeAway > 1000
          ? {
              timeAway: offlineGainsData.timeAway,
              resourceGains: offlineGainsData.resourceGains,
              xpGained: offlineGainsData.xpGained,
              capped: offlineGainsData.capped,
            }
          : undefined,
    };

    res.json(response);
  } catch (error) {
    console.error('Error loading game state:', error);
    res.status(500).json({ error: 'Failed to load game state' });
  }
});

/**
 * POST /api/game/gather-resource
 * Manually gather a resource (clicking buttons)
 */
gameRouter.post('/gather-resource', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { resource, clientTxId } = req.body as GatherResourceRequest;

    // Validation
    if (!resource || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['essence', 'crystals', 'gold', 'souls', 'attraction', 'gems', 'knowledge'].includes(resource)) {
      return res.status(400).json({ error: 'Invalid resource type' });
    }

    // Anti-cheat: always gather exactly 1
    const amount = 1;

    // Check for duplicate transaction (idempotency)
    const existingTx = await db.query.transactions.findFirst({
      where: eq(transactions.clientTxId, clientTxId),
    });

    if (existingTx) {
      // Transaction already processed, return success
      return res.json({ success: true, state: existingTx.stateAfter });
    }

    // Get current game state
    const gameState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameState) {
      return res.status(404).json({ error: 'Game state not found' });
    }

    // Apply resource gain (with cap check)
    const resourceKey = resource as keyof Resources;
    const capKey = `${resource}Cap` as keyof typeof gameState;
    const currentValue = gameState[resourceKey] as number;
    const cap = gameState[capKey] as number;
    const newValue = Math.min(currentValue + amount, cap);

    await db
      .update(gameStates)
      .set({
        [resourceKey]: newValue,
        updatedAt: new Date(),
      })
      .where(eq(gameStates.id, gameState.id));

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Build new state for response (simplified - only include changed resource)
    const newResources: Resources = {
      essence: gameState.essence,
      crystals: gameState.crystals,
      gold: gameState.gold,
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
      [resourceKey]: newValue,
    };

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      clientTxId,
      type: 'gather',
      payload: { resource, amount },
      stateAfter: { resources: newResources } as unknown as GameStateDTO,
    });

    const response: TransactionResponse = {
      success: true,
      state: { resources: newResources } as unknown as GameStateDTO, // Frontend will merge this
    };

    res.json(response);
  } catch (error) {
    console.error('Error gathering resource:', error);
    res.status(500).json({ error: 'Failed to gather resource' });
  }
});

/**
 * POST /api/game/purchase-building
 * Purchase a single building with anti-cheat validation
 */
gameRouter.post('/purchase-building', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { buildingId, clientTxId } = req.body as PurchaseBuildingRequest;

    // Validation
    if (!buildingId || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check for duplicate transaction (idempotency)
    const existingTx = await db.query.transactions.findFirst({
      where: eq(transactions.clientTxId, clientTxId),
    });

    if (existingTx) {
      // Transaction already processed, return success
      return res.json({ success: true, state: existingTx.stateAfter });
    }

    // Get current game state
    const gameState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameState) {
      return res.status(404).json({ error: 'Game state not found' });
    }

    const buildings = gameState.buildings as Record<string, Building>;
    const building = buildings[buildingId];

    if (!building) {
      return res.status(400).json({ error: 'Invalid building ID' });
    }

    // Calculate cost
    const cost = calculateBuildingCost(building);

    const currentResources: Resources = {
      essence: gameState.essence,
      crystals: gameState.crystals,
      gold: gameState.gold,
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
    };

    // Anti-cheat: Verify player can afford
    if (!canAffordCost(currentResources, cost)) {
      return res.status(400).json({ error: 'Cannot afford building' });
    }

    // Apply transaction
    const newResources = subtractResources(currentResources, cost);
    const newBuildings = {
      ...buildings,
      [buildingId]: {
        ...building,
        count: building.count + 1,
      },
    };

    // Update database
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
        buildings: newBuildings,
        updatedAt: new Date(),
      })
      .where(eq(gameStates.id, gameState.id));

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      clientTxId,
      type: 'purchase_building',
      payload: { buildingId, cost, quantity: 1 },
      stateAfter: { resources: newResources, buildings: newBuildings } as unknown as GameStateDTO,
    });

    const response: TransactionResponse = {
      success: true,
      state: { resources: newResources, buildings: newBuildings } as unknown as GameStateDTO,
    };

    res.json(response);
  } catch (error) {
    console.error('Error purchasing building:', error);
    res.status(500).json({ error: 'Failed to purchase building' });
  }
});

/**
 * POST /api/game/purchase-bulk-building
 * Purchase multiple buildings at once with anti-cheat validation
 */
gameRouter.post('/purchase-bulk-building', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { buildingId, quantity, clientTxId } = req.body as PurchaseBulkBuildingRequest;

    // Validation
    if (!buildingId || !quantity || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (quantity < 1 || quantity > 100) {
      return res.status(400).json({ error: 'Invalid quantity (must be 1-100)' });
    }

    // Check for duplicate transaction (idempotency)
    const existingTx = await db.query.transactions.findFirst({
      where: eq(transactions.clientTxId, clientTxId),
    });

    if (existingTx) {
      return res.json({ success: true, state: existingTx.stateAfter });
    }

    // Get current game state
    const gameState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameState) {
      return res.status(404).json({ error: 'Game state not found' });
    }

    const buildings = gameState.buildings as Record<string, Building>;
    const building = buildings[buildingId];

    if (!building) {
      return res.status(400).json({ error: 'Invalid building ID' });
    }

    // Calculate bulk cost
    const cost = calculateBulkBuildingCost(building, quantity);

    const currentResources: Resources = {
      essence: gameState.essence,
      crystals: gameState.crystals,
      gold: gameState.gold,
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
    };

    // Anti-cheat: Verify player can afford
    if (!canAffordCost(currentResources, cost)) {
      return res.status(400).json({ error: 'Cannot afford buildings' });
    }

    // Apply transaction
    const newResources = subtractResources(currentResources, cost);
    const newBuildings = {
      ...buildings,
      [buildingId]: {
        ...building,
        count: building.count + quantity,
      },
    };

    // Update database
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
        buildings: newBuildings,
        updatedAt: new Date(),
      })
      .where(eq(gameStates.id, gameState.id));

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      clientTxId,
      type: 'purchase_bulk_building',
      payload: { buildingId, cost, quantity },
      stateAfter: { resources: newResources, buildings: newBuildings } as unknown as GameStateDTO,
    });

    const response: TransactionResponse = {
      success: true,
      state: { resources: newResources, buildings: newBuildings } as unknown as GameStateDTO,
    };

    res.json(response);
  } catch (error) {
    console.error('Error purchasing bulk buildings:', error);
    res.status(500).json({ error: 'Failed to purchase buildings' });
  }
});

/**
 * POST /api/game/allocate-stat
 * Allocate a stat point to a hunter stat
 */
gameRouter.post('/allocate-stat', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { stat, clientTxId } = req.body as AllocateStatRequest;

    // Validation
    if (!stat || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['strength', 'agility', 'intelligence', 'vitality', 'sense', 'authority'].includes(stat)) {
      return res.status(400).json({ error: 'Invalid stat' });
    }

    // Check for duplicate transaction
    const existingTx = await db.query.transactions.findFirst({
      where: eq(transactions.clientTxId, clientTxId),
    });

    if (existingTx) {
      return res.json({ success: true, state: existingTx.stateAfter });
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

    // Update database
    await db
      .update(gameStates)
      .set({
        hunterStatPoints: newHunter.statPoints,
        hunterMaxHp: newHunter.maxHp,
        hunterMaxMana: newHunter.maxMana,
        hunterStrength: newHunter.stats.strength,
        hunterAgility: newHunter.stats.agility,
        hunterIntelligence: newHunter.stats.intelligence,
        hunterVitality: newHunter.stats.vitality,
        hunterSense: newHunter.stats.sense,
        hunterAuthority: newHunter.stats.authority,
        updatedAt: new Date(),
      })
      .where(eq(gameStates.id, gameState.id));

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      clientTxId,
      type: 'allocate_stat',
      payload: { stat },
      stateAfter: { hunter: newHunter } as unknown as GameStateDTO,
    });

    const response: TransactionResponse = {
      success: true,
      state: { hunter: newHunter } as unknown as GameStateDTO,
    };

    res.json(response);
  } catch (error) {
    console.error('Error allocating stat:', error);
    res.status(500).json({ error: 'Failed to allocate stat' });
  }
});

/**
 * POST /api/game/reset
 * Reset game state to initial values
 */
gameRouter.post('/reset', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { clientTxId } = req.body;

    if (!clientTxId) {
      return res.status(400).json({ error: 'Missing clientTxId' });
    }

    // Check for duplicate transaction
    const existingTx = await db.query.transactions.findFirst({
      where: eq(transactions.clientTxId, clientTxId),
    });

    if (existingTx) {
      return res.json({ success: true, state: existingTx.stateAfter });
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

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      clientTxId,
      type: 'reset',
      payload: {},
      stateAfter: {} as unknown as GameStateDTO,
    });

    const response: TransactionResponse = {
      success: true,
      state: {} as unknown as GameStateDTO, // Frontend will reload full state
    };

    res.json(response);
  } catch (error) {
    console.error('Error resetting game:', error);
    res.status(500).json({ error: 'Failed to reset game' });
  }
});

