import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db as defaultDb, type Database } from '../db/client.js';
import { users, gameStates, transactions, type GameState } from '../db/schema.js';

// Module-level db instance - can be overridden for testing via setDatabase()
let db: Database = defaultDb;
let dbName = 'defaultDb';

// Store a reference to verify identity
let injectedDbRef: Database | null = null;

/**
 * Set the database instance to use for all routes.
 * Call this BEFORE using the router (e.g., in test setup).
 */
export function setDatabase(database: Database): void {
  db = database;
  injectedDbRef = database;
  dbName = 'injectedDb';
  console.log('[setDatabase] Database instance set to:', dbName);
}

/**
 * Check if the current db is the injected one
 */
export function verifyDbInstance(testDb: Database): boolean {
  return db === testDb && db === injectedDbRef;
}

/**
 * Debug function: read game state directly using the injected db
 */
export async function debugReadGameState(userId: string): Promise<unknown> {
  const result = await db.get(sql`SELECT id, essence FROM game_states WHERE user_id = ${userId}`);
  console.log('[debugReadGameState] Direct read using db:', dbName, 'result:', result);
  return result;
}

/**
 * Get the current database name (for debugging)
 */
export function getDbName(): string {
  return dbName;
}
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { queryClient, CACHE_TTL } from '../db/cache.js';
import {
  addResources,
  subtractResources,
  canAffordCost,
  getMissingResources,
  formatMissingResourcesMessage,
  applyResourceCaps,
  calculateBuildingCost,
  calculateBulkBuildingCost,
  calculateOfflineGains,
  processXpGain,
  allocateStat,
  applyPassiveIncome,
  calculateResourceCaps,
  calculateGatherXp,
  BASE_RESOURCE_CAPS,
} from '../lib/gameLogic.js';
import { createTransactionLogger } from '../lib/debugLogger.js';
import { initialBuildings } from '../data/initialBuildings.js';
import { initialDungeons } from '../data/initialDungeons.js';
import { initialResearch } from '../data/initialResearch.js';
import type {
  GameStateResponse,
  TransactionResponse,
  GatherResourceRequest,
  PurchaseBuildingRequest,
  PurchaseBulkBuildingRequest,
  AllocateStatRequest,
  PurchaseResearchRequest,
  StartDungeonRequest,
  CompleteDungeonRequest,
  GameStateDTO,
  Resources,
  ResourceCaps,
  Building,
  Research,
  Dungeon,
  ActiveDungeon,
  HunterStats,
} from '../../shared/types.js';

export const gameRouter = Router();

// All game routes require authentication
gameRouter.use(authMiddleware);

/**
 * Helper to safely get lastUpdate timestamp
 * Returns current time if lastUpdate is null/undefined
 */
function getLastUpdateTime(lastUpdate: Date | null | undefined): number {
  if (!lastUpdate) return Date.now();
  return new Date(lastUpdate).getTime();
}

/**
 * Helper to transform database row to GameStateDTO
 * Used for consistent response formatting, especially in error responses
 */
function transformToGameStateDTO(
  gameState: GameState,
  resources: Resources,
  resourceCaps: ResourceCaps
): GameStateDTO {
  return {
    version: gameState.version,
    resources: {
      essence: resources.essence,
      crystals: resources.crystals,
      gold: resources.gold,
      souls: resources.souls,
      attraction: resources.attraction,
      gems: resources.gems,
      knowledge: resources.knowledge,
    },
    resourceCaps: {
      essence: resourceCaps.essence,
      crystals: resourceCaps.crystals,
      gold: resourceCaps.gold,
      souls: resourceCaps.souls,
      attraction: resourceCaps.attraction,
      gems: resourceCaps.gems,
      knowledge: resourceCaps.knowledge,
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
    lastUpdate: new Date(gameState.lastUpdate).getTime(),
  };
}

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
        console.log(
          '[BACKEND STEP 1] About to query database for userId:',
          userId,
          'using db:',
          dbName
        );

        let gameState = await db.query.gameStates.findFirst({
          where: eq(gameStates.userId, userId),
        });

        console.log('[BACKEND STEP 2] Drizzle query result:', {
          userId,
          found: !!gameState,
          essence: gameState?.essence,
          id: gameState?.id,
        });

        if (!gameState) {
          console.log('[BACKEND] No game state found, CREATING NEW ONE with essence=0');
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
              dungeons: initialDungeons,
              activeDungeons: [],
              allies: [],
              shadows: [],
              research: initialResearch,
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

    // Migration: If dungeons is empty, populate with initialDungeons
    const currentDungeons = gameState.dungeons as unknown as Dungeon[];
    if (!currentDungeons || currentDungeons.length === 0) {
      await db
        .update(gameStates)
        .set({
          dungeons: initialDungeons,
          updatedAt: new Date(),
        })
        .where(eq(gameStates.id, gameState.id));

      // Update the gameState object for the response
      gameState.dungeons = initialDungeons as unknown as typeof gameState.dungeons;

      // Invalidate cache so next fetch gets the updated dungeons
      await queryClient.invalidateQueries(['gameState', userId]);
    }

    // Migration: If research is empty, populate with initialResearch
    const research = gameState.research as unknown as Record<string, Research>;
    if (!research || Object.keys(research).length === 0) {
      await db
        .update(gameStates)
        .set({
          research: initialResearch,
          updatedAt: new Date(),
        })
        .where(eq(gameStates.id, gameState.id));

      // Update the gameState object for the response
      gameState.research = initialResearch as unknown as typeof gameState.research;

      // Invalidate cache so next fetch gets the updated research
      await queryClient.invalidateQueries(['gameState', userId]);
    }

    // Migration: Merge in any missing building definitions (e.g., newly added buildings)
    const existingBuildings = gameState.buildings as unknown as Record<string, Building> | null;
    const mergedBuildings: Record<string, Building> = {
      ...(existingBuildings ?? {}),
    };
    let buildingsDidChange = false;
    for (const [buildingId, initialBuilding] of Object.entries(initialBuildings)) {
      if (!mergedBuildings[buildingId]) {
        mergedBuildings[buildingId] = initialBuilding;
        buildingsDidChange = true;
      }
    }

    if (buildingsDidChange) {
      await db
        .update(gameStates)
        .set({
          buildings: mergedBuildings,
          updatedAt: new Date(),
        })
        .where(eq(gameStates.id, gameState.id));

      gameState.buildings = mergedBuildings as unknown as typeof gameState.buildings;

      await queryClient.invalidateQueries(['gameState', userId]);
    }

    // Migration: Merge in missing research definitions + any newly-added `unlocks` metadata
    const existingResearch = gameState.research as unknown as Record<string, Research> | null;
    const mergedResearch: Record<string, Research> = {
      ...(existingResearch ?? {}),
    };
    let researchDidChange = false;
    for (const [researchId, initialItem] of Object.entries(initialResearch)) {
      const currentItem = mergedResearch[researchId];
      if (!currentItem) {
        mergedResearch[researchId] = initialItem;
        researchDidChange = true;
        continue;
      }

      if (initialItem.unlocks && currentItem.unlocks === undefined) {
        mergedResearch[researchId] = {
          ...currentItem,
          unlocks: initialItem.unlocks,
        };
        researchDidChange = true;
      }
    }

    if (researchDidChange) {
      await db
        .update(gameStates)
        .set({
          research: mergedResearch,
          updatedAt: new Date(),
        })
        .where(eq(gameStates.id, gameState.id));

      gameState.research = mergedResearch as unknown as typeof gameState.research;

      await queryClient.invalidateQueries(['gameState', userId]);
    }

    // Cleanup: Remove expired dungeons from activeDungeons
    const activeDungeons = gameState.activeDungeons as unknown as ActiveDungeon[];
    if (activeDungeons && activeDungeons.length > 0) {
      const currentTime = Date.now();
      const expiredDungeons = activeDungeons.filter((ad) => currentTime >= ad.endTime);

      if (expiredDungeons.length > 0) {
        const cleanedActiveDungeons = activeDungeons.filter((ad) => currentTime < ad.endTime);

        console.log(`🧹 Cleaning up ${expiredDungeons.length} expired dungeon(s)`);
        expiredDungeons.forEach((ad) => {
          console.log(
            `  - ${ad.dungeonId} (expired ${((currentTime - ad.endTime) / 1000).toFixed(1)}s ago)`
          );
        });

        await db
          .update(gameStates)
          .set({
            activeDungeons: cleanedActiveDungeons,
            updatedAt: new Date(),
          })
          .where(eq(gameStates.id, gameState.id));

        // Update the gameState object for the response
        gameState.activeDungeons =
          cleanedActiveDungeons as unknown as typeof gameState.activeDungeons;

        // Invalidate cache so next fetch gets the cleaned state
        await queryClient.invalidateQueries(['gameState', userId]);
      }
    }

    // Auto-unlock dungeons based on hunter level
    const dungeons = gameState.dungeons as unknown as Dungeon[];
    if (dungeons && dungeons.length > 0) {
      const hunterLevel = gameState.hunterLevel;
      const dungeonsToUnlock: Dungeon[] = [];

      dungeons.forEach((dungeon) => {
        if (!dungeon.unlocked && hunterLevel >= dungeon.requiredLevel) {
          dungeon.unlocked = true;
          dungeonsToUnlock.push(dungeon);
        }
      });

      if (dungeonsToUnlock.length > 0) {
        console.log(
          `🔓 Auto-unlocking ${dungeonsToUnlock.length} dungeon(s) for level ${hunterLevel}`
        );
        dungeonsToUnlock.forEach((d) => {
          console.log(`  - ${d.name} (required level: ${d.requiredLevel})`);
        });

        await db
          .update(gameStates)
          .set({
            dungeons: dungeons,
            updatedAt: new Date(),
          })
          .where(eq(gameStates.id, gameState.id));

        // Update the gameState object for the response
        gameState.dungeons = dungeons as unknown as typeof gameState.dungeons;

        // Invalidate cache so next fetch gets the updated dungeons
        await queryClient.invalidateQueries(['gameState', userId]);
      }
    }

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

    // Create debug logger
    const logger = createTransactionLogger('/gather-resource', userId, clientTxId);

    // Validation
    if (!resource || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (
      !['essence', 'crystals', 'gold', 'souls', 'attraction', 'gems', 'knowledge'].includes(
        resource
      )
    ) {
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

    // Apply passive income first
    const rawResources: Resources = {
      essence: gameState.essence,
      crystals: gameState.crystals,
      gold: gameState.gold,
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
    };

    const rawResourceCaps = {
      essence: gameState.essenceCap,
      crystals: gameState.crystalsCap,
      gold: gameState.goldCap,
      souls: gameState.soulsCap,
    };

    // Log initial state
    logger.start(rawResources, rawResourceCaps);

    const buildings = gameState.buildings as Record<string, Building>;
    const research = gameState.research as Record<string, Research>;
    const hunterStats: HunterStats = {
      strength: gameState.hunterStrength,
      agility: gameState.hunterAgility,
      intelligence: gameState.hunterIntelligence,
      vitality: gameState.hunterVitality,
      sense: gameState.hunterSense,
      authority: gameState.hunterAuthority,
    };

    logger.beforePassive(rawResources);

    const currentResources = applyPassiveIncome(
      rawResources,
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats,
      getLastUpdateTime(gameState.lastUpdate),
      Date.now()
    );

    // Apply resource gain (with cap check)
    // Calculate dynamic caps to account for buildings/research/hunter stats
    const dynamicCaps = calculateResourceCaps(
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats
    );

    logger.afterPassive(currentResources, dynamicCaps);

    const resourceKey = resource as keyof Resources;
    const currentValue = currentResources[resourceKey];
    const cap = dynamicCaps[resourceKey];
    const newValue = Math.min(currentValue + amount, cap);

    // Update all resources (with passive income) + the gathered resource
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

    // Fetch updated full state to return
    const updatedState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!updatedState) {
      return res.status(500).json({ error: 'Failed to fetch updated state' });
    }

    // Transform database row to GameStateDTO using helper
    const stateDTO: GameStateDTO = transformToGameStateDTO(updatedState, newResources, dynamicCaps);

    // Log success
    logger.success(newResources, dynamicCaps);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
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

/**
 * POST /api/game/purchase-building
 * Purchase a single building with anti-cheat validation
 */
gameRouter.post('/purchase-building', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { buildingId, clientTxId } = req.body as PurchaseBuildingRequest;

    // Create debug logger
    const logger = createTransactionLogger('/purchase-building', userId, clientTxId);

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

    const rawResources: Resources = {
      essence: gameState.essence,
      crystals: gameState.crystals,
      gold: gameState.gold,
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
    };

    const rawResourceCaps = {
      essence: gameState.essenceCap,
      crystals: gameState.crystalsCap,
      gold: gameState.goldCap,
      souls: gameState.soulsCap,
    };

    // Log initial state
    logger.start(rawResources, rawResourceCaps);

    // Apply passive income since lastUpdate (critical for incremental games!)
    const research = gameState.research as Record<string, Research>;
    const hunterStats: HunterStats = {
      strength: gameState.hunterStrength,
      agility: gameState.hunterAgility,
      intelligence: gameState.hunterIntelligence,
      vitality: gameState.hunterVitality,
      sense: gameState.hunterSense,
      authority: gameState.hunterAuthority,
    };

    logger.beforePassive(rawResources);

    const currentResources = applyPassiveIncome(
      rawResources,
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats,
      getLastUpdateTime(gameState.lastUpdate),
      Date.now()
    );

    const currentResourceCaps = calculateResourceCaps(
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats
    );

    logger.afterPassive(currentResources, currentResourceCaps);

    // Anti-cheat: Verify player can afford (with passive income applied)
    logger.validation(
      `Purchase ${buildingId}`,
      cost as unknown as Partial<Record<string, number>>,
      currentResources
    );

    if (!canAffordCost(currentResources, cost)) {
      const missing = getMissingResources(currentResources, cost);
      const message = formatMissingResourcesMessage(missing);

      logger.error(message, currentResources);

      // Return error with current state for frontend sync
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

    // Apply transaction
    const newResources = subtractResources(currentResources, cost);
    const newBuildings = {
      ...buildings,
      [buildingId]: {
        ...building,
        count: building.count + 1,
      },
    };

    // Recalculate resource caps with the new building count
    const newResourceCaps = calculateResourceCaps(
      BASE_RESOURCE_CAPS,
      newBuildings,
      research,
      gameState.hunterLevel,
      hunterStats
    );

    console.log('🏗️ PURCHASE BUILDING:', buildingId);
    console.log('  Building count:', building.count, '->', newBuildings[buildingId].count);
    console.log('  Old essence cap:', gameState.essenceCap);
    console.log('  New essence cap:', newResourceCaps.essence);
    console.log('  Building increasesCaps:', building.increasesCaps);

    // Update database (with current timestamp for lastUpdate)
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
        essenceCap: newResourceCaps.essence,
        crystalsCap: newResourceCaps.crystals,
        goldCap: newResourceCaps.gold,
        soulsCap: newResourceCaps.souls,
        attractionCap: newResourceCaps.attraction,
        gemsCap: newResourceCaps.gems,
        knowledgeCap: newResourceCaps.knowledge,
        buildings: newBuildings,
        lastUpdate: now,
        updatedAt: now,
      })
      .where(eq(gameStates.id, gameState.id));

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Fetch updated full state to return
    const updatedState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!updatedState) {
      return res.status(500).json({ error: 'Failed to fetch updated state' });
    }

    // Transform database row to GameStateDTO using helper
    const stateDTO: GameStateDTO = transformToGameStateDTO(
      updatedState,
      newResources,
      newResourceCaps
    );

    // Log success
    logger.success(newResources, newResourceCaps);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      clientTxId,
      type: 'purchase_building',
      payload: { buildingId, cost, quantity: 1 },
      stateAfter: stateDTO,
    });

    const response: TransactionResponse = {
      success: true,
      state: stateDTO,
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

    // Create debug logger
    const logger = createTransactionLogger('/purchase-bulk-building', userId, clientTxId);

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

    const rawResources: Resources = {
      essence: gameState.essence,
      crystals: gameState.crystals,
      gold: gameState.gold,
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
    };

    const rawResourceCaps = {
      essence: gameState.essenceCap,
      crystals: gameState.crystalsCap,
      gold: gameState.goldCap,
      souls: gameState.soulsCap,
    };

    // Log initial state
    logger.start(rawResources, rawResourceCaps);

    // Apply passive income since lastUpdate
    const research = gameState.research as Record<string, Research>;
    const hunterStats: HunterStats = {
      strength: gameState.hunterStrength,
      agility: gameState.hunterAgility,
      intelligence: gameState.hunterIntelligence,
      vitality: gameState.hunterVitality,
      sense: gameState.hunterSense,
      authority: gameState.hunterAuthority,
    };

    logger.beforePassive(rawResources);

    const currentResources = applyPassiveIncome(
      rawResources,
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats,
      getLastUpdateTime(gameState.lastUpdate),
      Date.now()
    );

    const currentResourceCaps = calculateResourceCaps(
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats
    );

    logger.afterPassive(currentResources, currentResourceCaps);

    // Anti-cheat: Verify player can afford (with passive income applied)
    logger.validation(
      `Purchase ${quantity}x ${buildingId}`,
      cost as unknown as Partial<Record<string, number>>,
      currentResources
    );

    if (!canAffordCost(currentResources, cost)) {
      const missing = getMissingResources(currentResources, cost);
      const message = formatMissingResourcesMessage(missing);

      logger.error(message, currentResources);

      // Return error with current state for frontend sync
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

    // Apply transaction
    const newResources = subtractResources(currentResources, cost);
    const newBuildings = {
      ...buildings,
      [buildingId]: {
        ...building,
        count: building.count + quantity,
      },
    };

    // Recalculate resource caps with the new building count
    const newResourceCaps = calculateResourceCaps(
      BASE_RESOURCE_CAPS,
      newBuildings,
      research,
      gameState.hunterLevel,
      hunterStats
    );

    // Update database (with current timestamp for lastUpdate)
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
        essenceCap: newResourceCaps.essence,
        crystalsCap: newResourceCaps.crystals,
        goldCap: newResourceCaps.gold,
        soulsCap: newResourceCaps.souls,
        attractionCap: newResourceCaps.attraction,
        gemsCap: newResourceCaps.gems,
        knowledgeCap: newResourceCaps.knowledge,
        buildings: newBuildings,
        lastUpdate: now,
        updatedAt: now,
      })
      .where(eq(gameStates.id, gameState.id));

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Fetch updated full state to return
    const updatedState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!updatedState) {
      return res.status(500).json({ error: 'Failed to fetch updated state' });
    }

    // Transform database row to GameStateDTO using helper
    const stateDTO: GameStateDTO = transformToGameStateDTO(
      updatedState,
      newResources,
      newResourceCaps
    );

    // Log success
    logger.success(newResources, newResourceCaps);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      clientTxId,
      type: 'purchase_bulk_building',
      payload: { buildingId, cost, quantity },
      stateAfter: stateDTO,
    });

    const response: TransactionResponse = {
      success: true,
      state: stateDTO,
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

    // Apply passive income (even though this mutation doesn't consume resources)
    const rawResources: Resources = {
      essence: gameState.essence,
      crystals: gameState.crystals,
      gold: gameState.gold,
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
    };

    const buildings = gameState.buildings as Record<string, Building>;
    const research = gameState.research as Record<string, Research>;
    const hunterStats: HunterStats = {
      strength: gameState.hunterStrength,
      agility: gameState.hunterAgility,
      intelligence: gameState.hunterIntelligence,
      vitality: gameState.hunterVitality,
      sense: gameState.hunterSense,
      authority: gameState.hunterAuthority,
    };
    const currentResources = applyPassiveIncome(
      rawResources,
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats,
      getLastUpdateTime(gameState.lastUpdate),
      Date.now()
    );

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

/**
 * POST /api/game/purchase-research
 * Purchase a research upgrade with knowledge
 */
gameRouter.post('/purchase-research', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { researchId, clientTxId } = req.body as PurchaseResearchRequest;

    // Create debug logger
    const logger = createTransactionLogger('/purchase-research', userId, clientTxId);

    if (!researchId || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
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

    const research = gameState.research as Record<string, Research>;
    const researchItem = research[researchId];

    if (!researchItem) {
      return res.status(400).json({ success: false, error: 'Invalid research ID' });
    }

    if (researchItem.researched) {
      return res.status(400).json({ success: false, error: 'Research already purchased' });
    }

    // Check prerequisites
    if (researchItem.requires) {
      const hasPrereqs = researchItem.requires.every(
        (reqId: string) => research[reqId]?.researched
      );
      if (!hasPrereqs) {
        return res.status(400).json({ success: false, error: 'Prerequisites not met' });
      }
    }

    // Apply passive income first
    const rawResources: Resources = {
      essence: gameState.essence,
      crystals: gameState.crystals,
      gold: gameState.gold,
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
    };

    const rawResourceCaps = {
      essence: gameState.essenceCap,
      crystals: gameState.crystalsCap,
      gold: gameState.goldCap,
      souls: gameState.soulsCap,
    };

    // Log initial state
    logger.start(rawResources, rawResourceCaps);

    const buildings = gameState.buildings as Record<string, Building>;
    const hunterStats: HunterStats = {
      strength: gameState.hunterStrength,
      agility: gameState.hunterAgility,
      intelligence: gameState.hunterIntelligence,
      vitality: gameState.hunterVitality,
      sense: gameState.hunterSense,
      authority: gameState.hunterAuthority,
    };

    logger.beforePassive(rawResources);

    const currentResources = applyPassiveIncome(
      rawResources,
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats,
      getLastUpdateTime(gameState.lastUpdate),
      Date.now()
    );

    const currentResourceCaps = calculateResourceCaps(
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats
    );

    logger.afterPassive(currentResources, currentResourceCaps);

    // Check affordability (research costs knowledge)
    const cost = researchItem.cost;
    const partialCost = { knowledge: cost };

    logger.validation(
      `Purchase research ${researchId}`,
      partialCost as unknown as Partial<Record<string, number>>,
      currentResources
    );

    if (currentResources.knowledge < cost) {
      const missing = { knowledge: cost - currentResources.knowledge };
      const message = `Need ${Math.ceil(missing.knowledge)} knowledge more`;

      logger.error(message, currentResources);

      // Return error with current state for frontend sync
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

    // Update research and deduct knowledge
    const newResearch = {
      ...research,
      [researchId]: {
        ...researchItem,
        researched: true,
      },
    };

    const newResources = {
      ...currentResources,
      knowledge: currentResources.knowledge - cost,
    };

    // Recalculate resource caps with new research
    const newResourceCaps = calculateResourceCaps(
      BASE_RESOURCE_CAPS,
      buildings,
      newResearch,
      gameState.hunterLevel,
      hunterStats
    );

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
        essenceCap: newResourceCaps.essence,
        crystalsCap: newResourceCaps.crystals,
        goldCap: newResourceCaps.gold,
        soulsCap: newResourceCaps.souls,
        attractionCap: newResourceCaps.attraction,
        gemsCap: newResourceCaps.gems,
        knowledgeCap: newResourceCaps.knowledge,
        research: newResearch,
        lastUpdate: now,
        updatedAt: now,
      })
      .where(eq(gameStates.id, gameState.id));

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Fetch updated full state to return
    const updatedState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!updatedState) {
      return res.status(500).json({ error: 'Failed to fetch updated state' });
    }

    // Transform database row to GameStateDTO using helper
    const stateDTO: GameStateDTO = transformToGameStateDTO(
      updatedState,
      newResources,
      newResourceCaps
    );

    // Log success
    logger.success(newResources, newResourceCaps);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      clientTxId,
      type: 'purchase_research',
      payload: { researchId, cost },
      stateAfter: stateDTO,
    });

    const response: TransactionResponse = {
      success: true,
      state: stateDTO,
    };

    res.json(response);
  } catch (error) {
    console.error('Error purchasing research:', error);
    res.status(500).json({ error: 'Failed to purchase research' });
  }
});

/**
 * POST /api/game/start-dungeon
 * Start a dungeon run with a party
 */
gameRouter.post('/start-dungeon', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { dungeonId, partyIds, clientTxId } = req.body as StartDungeonRequest;

    if (!dungeonId || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
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

    // Apply passive income (even though this mutation doesn't consume resources)
    const rawResources: Resources = {
      essence: gameState.essence,
      crystals: gameState.crystals,
      gold: gameState.gold,
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
    };

    const buildings = gameState.buildings as Record<string, Building>;
    const research = gameState.research as Record<string, Research>;
    const hunterStats: HunterStats = {
      strength: gameState.hunterStrength,
      agility: gameState.hunterAgility,
      intelligence: gameState.hunterIntelligence,
      vitality: gameState.hunterVitality,
      sense: gameState.hunterSense,
      authority: gameState.hunterAuthority,
    };
    const currentResources = applyPassiveIncome(
      rawResources,
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats,
      getLastUpdateTime(gameState.lastUpdate),
      Date.now()
    );

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

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      clientTxId,
      type: 'start_dungeon',
      payload: { dungeonId, partyIds },
      stateAfter: {
        resources: currentResources,
        activeDungeons: newActiveDungeons,
      } as unknown as GameStateDTO,
    });

    const response: TransactionResponse = {
      success: true,
      state: {
        resources: currentResources,
        activeDungeons: newActiveDungeons,
      } as unknown as GameStateDTO,
    };

    res.json(response);
  } catch (error) {
    console.error('Error starting dungeon:', error);
    res.status(500).json({ error: 'Failed to start dungeon' });
  }
});

/**
 * POST /api/game/complete-dungeon
 * Complete a dungeon and claim rewards
 */
gameRouter.post('/complete-dungeon', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { activeDungeonId, clientTxId } = req.body as CompleteDungeonRequest;

    if (!activeDungeonId || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
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

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
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

    const response: TransactionResponse = {
      success: true,
      state: {
        resources: cappedResources,
        hunter: newHunter,
        activeDungeons: newActiveDungeons,
      } as unknown as GameStateDTO,
    };

    res.json(response);
  } catch (error) {
    console.error('Error completing dungeon:', error);
    res.status(500).json({ error: 'Failed to complete dungeon' });
  }
});

/**
 * POST /api/game/cancel-dungeon
 * Cancel an active dungeon run
 */
gameRouter.post('/cancel-dungeon', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { activeDungeonId, clientTxId } =
      req.body as import('../../shared/types.js').CancelDungeonRequest;

    if (!activeDungeonId || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
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

    const activeDungeons = gameState.activeDungeons as ActiveDungeon[];
    const activeDungeon = activeDungeons.find((ad: ActiveDungeon) => ad.id === activeDungeonId);

    if (!activeDungeon) {
      return res.status(400).json({ error: 'Active dungeon not found' });
    }

    // Remove the active dungeon
    const newActiveDungeons = activeDungeons.filter(
      (ad: ActiveDungeon) => ad.id !== activeDungeonId
    );

    // Apply passive income
    const rawResources: Resources = {
      essence: gameState.essence,
      crystals: gameState.crystals,
      gold: gameState.gold,
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
    };

    const buildings = gameState.buildings as Record<string, Building>;
    const research = gameState.research as Record<string, Research>;
    const hunterStats: HunterStats = {
      strength: gameState.hunterStrength,
      agility: gameState.hunterAgility,
      intelligence: gameState.hunterIntelligence,
      vitality: gameState.hunterVitality,
      sense: gameState.hunterSense,
      authority: gameState.hunterAuthority,
    };
    const currentResources = applyPassiveIncome(
      rawResources,
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats,
      getLastUpdateTime(gameState.lastUpdate),
      Date.now()
    );

    // Save to database
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

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      clientTxId,
      type: 'cancel_dungeon',
      payload: { activeDungeonId },
      stateAfter: {
        resources: currentResources,
        activeDungeons: newActiveDungeons,
      } as unknown as GameStateDTO,
    });

    const response: import('../../shared/types.js').TransactionResponse = {
      success: true,
      state: {
        resources: currentResources,
        activeDungeons: newActiveDungeons,
      } as unknown as GameStateDTO,
    };

    res.json(response);
  } catch (error) {
    console.error('Error canceling dungeon:', error);
    res.status(500).json({ error: 'Failed to cancel dungeon' });
  }
});

/**
 * POST /api/game/recruit-ally
 * Recruit a new ally with attraction
 */
gameRouter.post('/recruit-ally', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { name, rank, clientTxId } =
      req.body as import('../../shared/types.js').RecruitAllyRequest;

    // Create debug logger
    const logger = createTransactionLogger('/recruit-ally', userId, clientTxId);

    if (!name || !rank || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
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

    // Calculate cost based on rank
    const rankCosts: Record<string, number> = {
      E: 100,
      D: 300,
      C: 1000,
      B: 3000,
      A: 10000,
      S: 30000,
    };

    const cost = rankCosts[rank] || 100;

    // Apply passive income first
    const rawResources: Resources = {
      essence: gameState.essence,
      crystals: gameState.crystals,
      gold: gameState.gold,
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
    };

    const rawResourceCaps = {
      essence: gameState.essenceCap,
      crystals: gameState.crystalsCap,
      gold: gameState.goldCap,
      souls: gameState.soulsCap,
    };

    // Log initial state
    logger.start(rawResources, rawResourceCaps);

    const buildings = gameState.buildings as Record<string, Building>;
    const research = gameState.research as Record<string, Research>;
    const hunterStats: HunterStats = {
      strength: gameState.hunterStrength,
      agility: gameState.hunterAgility,
      intelligence: gameState.hunterIntelligence,
      vitality: gameState.hunterVitality,
      sense: gameState.hunterSense,
      authority: gameState.hunterAuthority,
    };

    logger.beforePassive(rawResources);

    const currentResources = applyPassiveIncome(
      rawResources,
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats,
      getLastUpdateTime(gameState.lastUpdate),
      Date.now()
    );

    const currentResourceCaps = calculateResourceCaps(
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats
    );

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

      // Return error with current state for frontend sync
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

    const allies = gameState.allies as import('../../shared/types.js').Ally[];
    const newAlly: import('../../shared/types.js').Ally = {
      id: `ally-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type: 'ally',
      originDungeonId: 'recruitment', // Recruited allies don't come from dungeons
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
    };

    const newAllies = [...allies, newAlly];
    const newResources = {
      ...currentResources,
      attraction: currentResources.attraction - cost,
    };

    const nowDate = new Date();
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
        essenceCap: currentResourceCaps.essence,
        crystalsCap: currentResourceCaps.crystals,
        goldCap: currentResourceCaps.gold,
        soulsCap: currentResourceCaps.souls,
        attractionCap: currentResourceCaps.attraction,
        gemsCap: currentResourceCaps.gems,
        knowledgeCap: currentResourceCaps.knowledge,
        allies: newAllies,
        lastUpdate: nowDate,
        updatedAt: nowDate,
      })
      .where(eq(gameStates.id, gameState.id));

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Fetch updated full state to return
    const updatedState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!updatedState) {
      return res.status(500).json({ error: 'Failed to fetch updated state' });
    }

    // Transform database row to GameStateDTO using helper
    const stateDTO: GameStateDTO = transformToGameStateDTO(
      updatedState,
      newResources,
      currentResourceCaps
    );

    // Log success
    logger.success(newResources, currentResourceCaps);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      clientTxId,
      type: 'recruit_ally',
      payload: { name, rank, cost },
      stateAfter: stateDTO,
    });

    const response: TransactionResponse = {
      success: true,
      state: stateDTO,
    };

    res.json(response);
  } catch (error) {
    console.error('Error recruiting ally:', error);
    res.status(500).json({ error: 'Failed to recruit ally' });
  }
});

/**
 * POST /api/game/extract-shadow
 * Extract a shadow from a defeated enemy
 */
gameRouter.post('/extract-shadow', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { name, dungeonId, clientTxId } =
      req.body as import('../../shared/types.js').ExtractShadowRequest;

    // Create debug logger
    const logger = createTransactionLogger('/extract-shadow', userId, clientTxId);

    if (!name || !dungeonId || !clientTxId) {
      return res.status(400).json({ error: 'Missing required fields' });
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

    const dungeons = gameState.dungeons as Dungeon[];
    const dungeon = dungeons.find((d) => d.id === dungeonId);

    if (!dungeon) {
      return res.status(400).json({ success: false, error: 'Invalid dungeon ID' });
    }

    // Cost is based on dungeon rank
    const cost = 1000; // Simplified cost

    // Apply passive income first
    const rawResources: Resources = {
      essence: gameState.essence,
      crystals: gameState.crystals,
      gold: gameState.gold,
      souls: gameState.souls,
      attraction: gameState.attraction,
      gems: gameState.gems,
      knowledge: gameState.knowledge,
    };

    const rawResourceCaps = {
      essence: gameState.essenceCap,
      crystals: gameState.crystalsCap,
      gold: gameState.goldCap,
      souls: gameState.soulsCap,
    };

    // Log initial state
    logger.start(rawResources, rawResourceCaps);

    const buildings = gameState.buildings as Record<string, Building>;
    const research = gameState.research as Record<string, Research>;
    const hunterStats: HunterStats = {
      strength: gameState.hunterStrength,
      agility: gameState.hunterAgility,
      intelligence: gameState.hunterIntelligence,
      vitality: gameState.hunterVitality,
      sense: gameState.hunterSense,
      authority: gameState.hunterAuthority,
    };

    logger.beforePassive(rawResources);

    const currentResources = applyPassiveIncome(
      rawResources,
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats,
      getLastUpdateTime(gameState.lastUpdate),
      Date.now()
    );

    const currentResourceCaps = calculateResourceCaps(
      BASE_RESOURCE_CAPS,
      buildings,
      research,
      gameState.hunterLevel,
      hunterStats
    );

    logger.afterPassive(currentResources, currentResourceCaps);

    const partialCost = { souls: cost };
    logger.validation(
      `Extract shadow ${name} from ${dungeonId}`,
      partialCost as unknown as Partial<Record<string, number>>,
      currentResources
    );

    if (currentResources.souls < cost) {
      const missing = { souls: cost - currentResources.souls };
      const message = `Need ${Math.ceil(missing.souls)} souls more`;

      logger.error(message, currentResources);

      // Return error with current state for frontend sync
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

    const shadows = gameState.shadows as import('../../shared/types.js').Shadow[];
    const newShadow: import('../../shared/types.js').Shadow = {
      id: `shadow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type: 'shadow',
      originDungeonId: dungeonId,
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
    };

    const newShadows = [...shadows, newShadow];
    const newResources = {
      ...currentResources,
      souls: currentResources.souls - cost,
    };

    const nowDate = new Date();
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
        essenceCap: currentResourceCaps.essence,
        crystalsCap: currentResourceCaps.crystals,
        goldCap: currentResourceCaps.gold,
        soulsCap: currentResourceCaps.souls,
        attractionCap: currentResourceCaps.attraction,
        gemsCap: currentResourceCaps.gems,
        knowledgeCap: currentResourceCaps.knowledge,
        shadows: newShadows,
        lastUpdate: nowDate,
        updatedAt: nowDate,
      })
      .where(eq(gameStates.id, gameState.id));

    // Invalidate cache
    await queryClient.invalidateQueries(['gameState', userId]);

    // Fetch updated full state to return
    const updatedState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!updatedState) {
      return res.status(500).json({ error: 'Failed to fetch updated state' });
    }

    // Transform database row to GameStateDTO using helper
    const stateDTO: GameStateDTO = transformToGameStateDTO(
      updatedState,
      newResources,
      currentResourceCaps
    );

    // Log success
    logger.success(newResources, currentResourceCaps);

    // Log transaction
    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      clientTxId,
      type: 'extract_shadow',
      payload: { name, dungeonId, cost },
      stateAfter: stateDTO,
    });

    const response: TransactionResponse = {
      success: true,
      state: stateDTO,
    };

    res.json(response);
  } catch (error) {
    console.error('Error extracting shadow:', error);
    res.status(500).json({ error: 'Failed to extract shadow' });
  }
});

export default gameRouter;
