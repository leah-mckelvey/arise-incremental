import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import type { Server } from "http";
import { createApp } from "../server/app";
import { db } from "../server/db/client";
import { gameStates, transactions, users } from "../server/db/schema";
import { eq } from "drizzle-orm";
import { gameStore } from "./store/gameStore";
import { useBuildingsStore } from "./store/buildingsStore";
import { useHunterStore } from "./store/hunterStore";
import { useResearchStore } from "./store/researchStore";
import { useArtifactsStore } from "./store/artifactsStore";
import * as gameApi from "./api/gameApi";
import { initialBuildings } from "../server/data/initialBuildings";
import { initialResearch } from "../server/data/initialResearch";
import { initialDungeons } from "../server/data/initialDungeons";
import type { TransactionResponse } from "../shared/types";

const E2E_TEST_USER_ID = "test-user-1";
const E2E_TEST_PORT = 3002;
const E2E_API_BASE = `http://localhost:${E2E_TEST_PORT}`;
let server: Server;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resetFrontendStores = () => {
  cleanup();
  localStorage.clear();
  gameStore.setState({
    version: 1,
    resources: {
      essence: 0,
      crystals: 0,
      gold: 0,
      souls: 0,
      attraction: 0,
      gems: 0,
      knowledge: 0,
    },
    resourceCaps: {
      essence: 1000,
      crystals: 1000,
      gold: 1000,
      souls: 500,
      attraction: 100,
      gems: 100,
      knowledge: 1000,
    },
    lastUpdate: Date.now(),
    lastServerSync: 0,
    pendingMutations: 0,
  });
  useBuildingsStore.getState().reset();
  useHunterStore.getState().reset();
  useResearchStore.getState().reset();
  useArtifactsStore.getState().reset();
};

const cleanDatabase = async () => {
  await db
    .delete(transactions)
    .where(eq(transactions.userId, E2E_TEST_USER_ID));
  await db.delete(gameStates).where(eq(gameStates.userId, E2E_TEST_USER_ID));
  await db.delete(users).where(eq(users.id, E2E_TEST_USER_ID));
};

const createTestUserAndState = async (
  overrides: {
    essence?: number;
    crystals?: number;
    gold?: number;
    hunterStatPoints?: number;
  } = {},
) => {
  await db.insert(users).values({
    id: E2E_TEST_USER_ID,
    email: "e2e-test@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(gameStates).values({
    id: crypto.randomUUID(),
    userId: E2E_TEST_USER_ID,
    version: 1,
    essence: overrides.essence ?? 0,
    crystals: overrides.crystals ?? 0,
    gold: overrides.gold ?? 0,
    souls: 0,
    attraction: 0,
    gems: 0,
    knowledge: 0,
    essenceCap: 1000,
    crystalsCap: 1000,
    goldCap: 1000,
    soulsCap: 500,
    attractionCap: 100,
    gemsCap: 100,
    knowledgeCap: 1000,
    hunterLevel: 1,
    hunterXp: 0,
    hunterXpToNextLevel: 100,
    hunterRank: "E",
    hunterStatPoints: overrides.hunterStatPoints ?? 0,
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
    artifacts: {},
    dungeons: initialDungeons,
    activeDungeons: [],
    allies: [],
    shadows: [],
    research: initialResearch,
    lastUpdate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};

const clearBackendCache = async () => {
  await fetch(`${E2E_API_BASE}/api/test/clear-cache`, { method: "POST" });
};

describe("End-to-End Tests", () => {
  beforeAll(async () => {
    gameApi.setApiBaseUrl(E2E_API_BASE);
    const app = createApp();
    server = app.listen(E2E_TEST_PORT);
    await wait(500);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(async () => {
    await cleanDatabase();
    await clearBackendCache();
    resetFrontendStores();
  });

  it("should load initial game state", async () => {
    await createTestUserAndState();
    const response = await gameApi.getGameState();
    expect(response.state.resources.essence).toBe(0);
    expect(response.state.hunter.level).toBe(1);
  });

  it("should gather essence", async () => {
    await createTestUserAndState();
    const response = await gameApi.gatherResource("essence");
    expect(response.state.resources.essence).toBe(1);
  });

  it("should purchase building", async () => {
    await createTestUserAndState({ essence: 100 });
    const response = await gameApi.purchaseBuilding("essenceExtractor");
    expect(response.state.resources.essence).toBe(90);
    expect(response.state.buildings.essenceExtractor.count).toBe(1);
  });

  describe("Stress Tests - Button Spamming & Race Conditions", () => {
    it("should handle rapid sequential gather clicks", async () => {
      await createTestUserAndState();

      // Spam gather 20 times sequentially, capture last response
      let lastResponse;
      for (let i = 0; i < 20; i++) {
        lastResponse = await gameApi.gatherResource("essence");
      }

      // Use the response from the last mutation (authoritative state)
      expect(lastResponse!.state.resources.essence).toBe(20);
    });

    it("should handle concurrent gather requests without losing any", async () => {
      await createTestUserAndState();

      // Fire 10 concurrent gather requests
      const promises = Array.from({ length: 10 }, () =>
        gameApi.gatherResource("essence"),
      );
      const results = await Promise.all(promises);

      // The last completed response should show all gathers applied
      // Since these are concurrent, find the one with highest essence
      const maxEssence = Math.max(
        ...results.map((r) => r.state.resources.essence),
      );
      expect(maxEssence).toBe(10);
    });

    it("should handle concurrent building purchases correctly", async () => {
      // Start with enough for 5 buildings
      await createTestUserAndState({ essence: 500 });

      // Fire 5 concurrent purchase requests
      const promises = Array.from({ length: 5 }, () =>
        gameApi.purchaseBuilding("essenceExtractor"),
      );
      const results = await Promise.allSettled(promises);

      // All should succeed since we have enough resources
      const successes = results.filter((r) => r.status === "fulfilled");
      expect(successes.length).toBe(5);

      // Get the building count from the successful responses
      const successValues = successes.map(
        (r) => (r as PromiseFulfilledResult<TransactionResponse>).value,
      );
      const maxBuildingCount = Math.max(
        ...successValues.map((r) => r.state.buildings.essenceExtractor.count),
      );
      expect(maxBuildingCount).toBe(5);
    });

    it("should reject purchases when resources run out mid-spam", async () => {
      // Start with enough for ~2 buildings (10 + 11.5 = 21.5, third costs ~13.2)
      await createTestUserAndState({ essence: 25 });

      // Try to buy 5 buildings rapidly
      const promises = Array.from({ length: 5 }, () =>
        gameApi.purchaseBuilding("essenceExtractor"),
      );
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successes = results.filter((r) => r.status === "fulfilled");
      const failures = results.filter((r) => r.status === "rejected");

      // At least 2 should succeed (we have 25 essence, first costs 10, second ~11.5)
      expect(successes.length).toBeGreaterThanOrEqual(2);
      // At least some should fail (we can't afford 5)
      expect(failures.length).toBeGreaterThan(0);

      // Verify building count from successful responses
      const successValues = successes.map(
        (r) => (r as PromiseFulfilledResult<TransactionResponse>).value,
      );
      const maxBuildingCount = Math.max(
        ...successValues.map((r) => r.state.buildings.essenceExtractor.count),
      );
      expect(maxBuildingCount).toBe(successes.length);

      // Verify resources never went negative in any response
      successValues.forEach((r) => {
        expect(r.state.resources.essence).toBeGreaterThanOrEqual(0);
      });
    });

    it("should handle mixed concurrent operations", async () => {
      await createTestUserAndState({ essence: 100, gold: 100 });

      // Mix of gather and purchase operations
      const operations = [
        gameApi.gatherResource("essence"),
        gameApi.gatherResource("essence"),
        gameApi.purchaseBuilding("essenceExtractor"),
        gameApi.gatherResource("essence"),
        gameApi.purchaseBuilding("essenceExtractor"),
        gameApi.gatherResource("essence"),
      ];

      const results = await Promise.all(operations);

      // Last response should have final state
      // All ops should succeed, buildings should be 2
      const buildingResponses = results.filter(
        (r) => r.state.buildings?.essenceExtractor,
      );
      const maxBuildings = Math.max(
        ...buildingResponses.map(
          (r) => r.state.buildings.essenceExtractor.count,
        ),
      );
      expect(maxBuildings).toBe(2);

      // Verify resources stayed non-negative in all responses
      results.forEach((r) => {
        if (r.state.resources) {
          expect(r.state.resources.essence).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it("should handle stat allocation spam with limited points", async () => {
      // Give player 3 stat points
      await createTestUserAndState({ hunterStatPoints: 3 });

      // Try to allocate 5 times
      const promises = Array.from({ length: 5 }, () =>
        gameApi.allocateStat("strength"),
      );
      const results = await Promise.allSettled(promises);

      // Only 3 should succeed
      const successes = results.filter((r) => r.status === "fulfilled");
      expect(successes.length).toBe(3);

      // Verify final state from successful responses
      const successValues = successes.map(
        (r) => (r as PromiseFulfilledResult<TransactionResponse>).value,
      );
      const lastSuccess = successValues[successValues.length - 1];
      expect(lastSuccess.state.hunter.statPoints).toBe(0);
      expect(lastSuccess.state.hunter.stats.strength).toBe(13); // 10 base + 3
    });

    it("should maintain consistency under heavy load", async () => {
      await createTestUserAndState({ essence: 1000 });

      // 50 concurrent operations (25 gathers + 25 building purchases)
      const gatherPromises = Array.from({ length: 25 }, () =>
        gameApi.gatherResource("essence"),
      );
      const buildingPromises = Array.from({ length: 25 }, () =>
        gameApi.purchaseBuilding("essenceExtractor"),
      );

      const [, buildingResults] = await Promise.all([
        Promise.allSettled(gatherPromises),
        Promise.allSettled(buildingPromises),
      ]);

      // Successful building purchases
      const buildingSuccesses = buildingResults.filter(
        (r) => r.status === "fulfilled",
      );

      // At least some buildings should have been purchased
      expect(buildingSuccesses.length).toBeGreaterThan(0);

      // Get max building count from successful responses
      const successValues = buildingSuccesses.map(
        (r) => (r as PromiseFulfilledResult<TransactionResponse>).value,
      );
      const maxBuildingCount = Math.max(
        ...successValues.map((r) => r.state.buildings.essenceExtractor.count),
      );
      expect(maxBuildingCount).toBe(buildingSuccesses.length);
      expect(maxBuildingCount).toBeLessThanOrEqual(25);

      // All successful responses should show non-negative resources
      successValues.forEach((r) => {
        expect(r.state.resources.essence).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
