import { Router } from 'express';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { users, gameStates } from '../../db/schema.js';
import { queryClient, CACHE_TTL } from '../../db/cache.js';
import { type AuthRequest } from '../../middleware/auth.js';
import {
  addResources,
  applyResourceCaps,
  calculateOfflineGains,
  processXpGain,
} from '../../lib/gameLogic.js';
import { initialBuildings } from '../../data/initialBuildings.js';
import { initialDungeons } from '../../data/initialDungeons.js';
import { initialResearch } from '../../data/initialResearch.js';
import type { GameStateResponse, GameStateDTO, Dungeon } from '../../../shared/types.js';
import {
  parseBuildings,
  parseResearch,
  parseDungeons,
  parseActiveDungeons,
  parseAllies,
  parseShadows,
  parseArtifactsState,
} from '../../lib/parseGameState.js';
import { getDb, getDbName } from './utils/index.js';

export const stateRouter = Router();

/**
 * GET /api/game/state
 * Load current game state with offline gains calculation
 * Uses ts-query pattern with L1/L2/L3 caching
 */
stateRouter.get('/state', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const dbName = getDbName();

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
              id: randomUUID(),
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

    let gameState = await gameStateQuery.fetch();

    // Run migrations
    gameState = await runMigrations(db, userId, gameState);

    // Calculate offline gains
    const response = await calculateAndApplyOfflineGains(db, userId, gameState);

    res.json(response);
  } catch (error) {
    console.error('Error loading game state:', error);
    res.status(500).json({ error: 'Failed to load game state' });
  }
});

// Import Database type for function signatures
import type { Database } from '../../db/client.js';
import type { GameState } from '../../db/schema.js';

/**
 * Run all migrations on game state (dungeons, research, buildings)
 */
async function runMigrations(
  db: Database,
  userId: string,
  gameState: GameState
): Promise<GameState> {
  // Migration: If dungeons is empty, populate with initialDungeons
  const currentDungeons = parseDungeons(gameState.dungeons);
  if (currentDungeons.length === 0) {
    await db
      .update(gameStates)
      .set({
        dungeons: initialDungeons,
        updatedAt: new Date(),
      })
      .where(eq(gameStates.id, gameState.id));

    gameState.dungeons = initialDungeons as unknown as typeof gameState.dungeons;
    await queryClient.invalidateQueries(['gameState', userId]);
  }

  // Migration: If research is empty, populate with initialResearch
  const research = parseResearch(gameState.research);
  if (Object.keys(research).length === 0) {
    await db
      .update(gameStates)
      .set({
        research: initialResearch,
        updatedAt: new Date(),
      })
      .where(eq(gameStates.id, gameState.id));

    gameState.research = initialResearch as unknown as typeof gameState.research;
    await queryClient.invalidateQueries(['gameState', userId]);
  }

  // Migration: Merge in any missing building definitions
  const existingBuildings = parseBuildings(gameState.buildings);
  const mergedBuildings = { ...existingBuildings };
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

  // Migration: Merge in missing research definitions + unlocks metadata
  const existingResearch = parseResearch(gameState.research);
  const mergedResearch = { ...existingResearch };
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
  const activeDungeons = parseActiveDungeons(gameState.activeDungeons);
  if (activeDungeons.length > 0) {
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

      gameState.activeDungeons =
        cleanedActiveDungeons as unknown as typeof gameState.activeDungeons;
      await queryClient.invalidateQueries(['gameState', userId]);
    }
  }

  // Auto-unlock dungeons based on hunter level
  const dungeons = parseDungeons(gameState.dungeons);
  if (dungeons.length > 0) {
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

      gameState.dungeons = dungeons as unknown as typeof gameState.dungeons;
      await queryClient.invalidateQueries(['gameState', userId]);
    }
  }

  return gameState;
}

/**
 * Calculate and apply offline gains, then return the response
 */
async function calculateAndApplyOfflineGains(
  db: Database,
  userId: string,
  gameState: GameState
): Promise<GameStateResponse> {
  const now = Date.now();
  const lastUpdateMs = gameState.lastUpdate.getTime();

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
    buildings: parseBuildings(gameState.buildings),
    artifacts: parseArtifactsState(gameState.artifacts),
    dungeons: parseDungeons(gameState.dungeons),
    activeDungeons: parseActiveDungeons(gameState.activeDungeons),
    allies: parseAllies(gameState.allies),
    shadows: parseShadows(gameState.shadows),
    research: parseResearch(gameState.research),
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

  return {
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
}
