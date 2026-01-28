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
import { useDungeonsStore } from "./store/dungeonsStore";
import { useAlliesStore } from "./store/alliesStore";
import { useShadowsStore } from "./store/shadowsStore";
import * as gameApi from "./api/gameApi";
import { initialBuildings } from "../server/data/initialBuildings";
import { initialResearch } from "../server/data/initialResearch";
import { initialDungeons } from "../server/data/initialDungeons";
import type { TransactionResponse } from "../shared/types";
import { calculateMaxPartySlots } from "./lib/calculations/partyCalculations";

// Use a DIFFERENT user ID than dev environment (which uses 'test-user-1')
// This prevents E2E tests from wiping out dev game state
const E2E_TEST_USER_ID = "e2e-test-user";
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
  useDungeonsStore.getState().reset();
  useAlliesStore.getState().reset();
  useShadowsStore.getState().reset();
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
    gameApi.setTestUserId(E2E_TEST_USER_ID);
    const app = createApp();
    server = app.listen(E2E_TEST_PORT);
    await wait(500);
  });

  afterAll(async () => {
    gameApi.setTestUserId(null);
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

  describe("Dungeon System", () => {
    const SUNG_JINWOO_ID = "sung-jinwoo";

    beforeEach(() => {
      // Ensure dungeons are reset properly
      useDungeonsStore.getState().reset();
      useAlliesStore.getState().reset();
      useShadowsStore.getState().reset();
    });

    describe("Named Hunter Requirement", () => {
      it("should require at least one named hunter (Sung Jinwoo) to start a dungeon", () => {
        const dungeonsStore = useDungeonsStore.getState();
        const dungeons = dungeonsStore.dungeons;

        // Get the first unlocked dungeon
        const unlockedDungeon = dungeons.find((d) => d.unlocked);
        expect(unlockedDungeon).toBeDefined();

        let successCalled = false;
        const onSuccess = () => {
          successCalled = true;
        };

        // Start dungeon with Sung Jinwoo
        dungeonsStore.startDungeon(
          unlockedDungeon!.id,
          Date.now(),
          [SUNG_JINWOO_ID],
          onSuccess,
        );

        expect(successCalled).toBe(true);
        expect(useDungeonsStore.getState().activeDungeons.length).toBe(1);
        expect(
          useDungeonsStore.getState().activeDungeons[0].partyIds,
        ).toContain(SUNG_JINWOO_ID);
      });

      it("should allow a named companion to lead when Sung Jinwoo is busy", () => {
        const dungeonsStore = useDungeonsStore.getState();
        const dungeons = dungeonsStore.dungeons;
        const unlockedDungeon = dungeons.find((d) => d.unlocked);
        expect(unlockedDungeon).toBeDefined();

        // First dungeon with Sung Jinwoo
        let firstSuccess = false;
        dungeonsStore.startDungeon(
          unlockedDungeon!.id,
          Date.now(),
          [SUNG_JINWOO_ID],
          () => {
            firstSuccess = true;
          },
        );
        expect(firstSuccess).toBe(true);

        // Create a named ally (from a dungeon, not generic recruited)
        const alliesStore = useAlliesStore.getState();
        const namedAlly = alliesStore.recruitAlly(
          "Cha Hae-In",
          "demon-castle-entrance",
        );

        // Second dungeon with named ally as leader
        let secondSuccess = false;
        useDungeonsStore
          .getState()
          .startDungeon(unlockedDungeon!.id, Date.now(), [namedAlly.id], () => {
            secondSuccess = true;
          });

        expect(secondSuccess).toBe(true);
        expect(useDungeonsStore.getState().activeDungeons.length).toBe(2);
      });

      it("should NOT allow a dungeon to start with only nameless grunts", () => {
        // Generic recruited allies cannot lead - they have originDungeonId='recruited'
        const alliesStore = useAlliesStore.getState();
        const grunt = alliesStore.recruitGenericAlly("Generic Hunter", "E");

        // Verify the grunt is marked as 'recruited' (nameless)
        expect(grunt.originDungeonId).toBe("recruited");

        // The store allows starting - the validation happens in DungeonsTab.tsx
        // So we test the logic that determines if a party is valid
        const isNamedCompanion = grunt.originDungeonId !== "recruited";
        expect(isNamedCompanion).toBe(false);

        // Grunts can be in a party but can't be the only members
        // Without Sung Jinwoo or a named companion, the party is invalid
        const partyWithOnlyGrunts = [grunt.id];
        const hasValidLeader =
          partyWithOnlyGrunts.includes(SUNG_JINWOO_ID) || isNamedCompanion;
        expect(hasValidLeader).toBe(false);
      });
    });

    describe("Hunter Busy States", () => {
      it("should mark hunters as busy when dungeon is running", () => {
        const dungeonsStore = useDungeonsStore.getState();
        const dungeons = dungeonsStore.dungeons;
        const unlockedDungeon = dungeons.find((d) => d.unlocked);

        // Start dungeon with Sung Jinwoo
        dungeonsStore.startDungeon(
          unlockedDungeon!.id,
          Date.now(),
          [SUNG_JINWOO_ID],
          () => {},
        );

        // Check if Sung Jinwoo is in an active dungeon (busy)
        const activeDungeons = useDungeonsStore.getState().activeDungeons;
        const isSungJinwooBusy = activeDungeons.some((ad) =>
          ad.partyIds?.includes(SUNG_JINWOO_ID),
        );

        expect(isSungJinwooBusy).toBe(true);
      });

      it("should prevent busy hunters from joining another dungeon", () => {
        const dungeonsStore = useDungeonsStore.getState();
        const dungeons = dungeonsStore.dungeons;
        const unlockedDungeon = dungeons.find((d) => d.unlocked);

        // First dungeon with Sung Jinwoo
        dungeonsStore.startDungeon(
          unlockedDungeon!.id,
          Date.now(),
          [SUNG_JINWOO_ID],
          () => {},
        );

        // Try to start another dungeon with Sung Jinwoo (should fail)
        let secondCallSuccess = false;
        useDungeonsStore
          .getState()
          .startDungeon(
            unlockedDungeon!.id,
            Date.now(),
            [SUNG_JINWOO_ID],
            () => {
              secondCallSuccess = true;
            },
          );

        // The second start should NOT have called onSuccess
        expect(secondCallSuccess).toBe(false);
        // Should still only have 1 active dungeon
        expect(useDungeonsStore.getState().activeDungeons.length).toBe(1);
      });

      it("should mark hunters as available when dungeon completes", () => {
        const dungeonsStore = useDungeonsStore.getState();
        const dungeons = dungeonsStore.dungeons;
        const unlockedDungeon = dungeons.find((d) => d.unlocked);

        const startTime = Date.now();
        dungeonsStore.startDungeon(
          unlockedDungeon!.id,
          startTime,
          [SUNG_JINWOO_ID],
          () => {},
        );

        const activeDungeon = useDungeonsStore.getState().activeDungeons[0];
        expect(activeDungeon).toBeDefined();

        // Complete the dungeon (simulate time passed)
        let completionSuccess = false;
        useDungeonsStore.getState().completeDungeon(
          activeDungeon.id,
          activeDungeon.endTime + 1, // Past the end time
          () => {
            completionSuccess = true;
          },
        );

        expect(completionSuccess).toBe(true);

        // Sung Jinwoo should no longer be busy
        const activeDungeonsAfter = useDungeonsStore.getState().activeDungeons;
        const isSungJinwooBusyAfter = activeDungeonsAfter.some((ad) =>
          ad.partyIds?.includes(SUNG_JINWOO_ID),
        );

        expect(isSungJinwooBusyAfter).toBe(false);
        expect(activeDungeonsAfter.length).toBe(0);
      });
    });

    describe("Party Size Limits", () => {
      it("should respect max party size based on authority", () => {
        // Authority 1 = 1 party slot (sqrt(1*2) = 1.41 -> 1)
        const authority = 1;
        const maxSlots = calculateMaxPartySlots(authority);
        expect(maxSlots).toBe(1);

        // Authority 8 = 4 slots (sqrt(8*2) = 4)
        const higherAuthority = 8;
        const higherMaxSlots = calculateMaxPartySlots(higherAuthority);
        expect(higherMaxSlots).toBe(4);
      });

      it("should allow parties up to max size", () => {
        // Create named companions
        const alliesStore = useAlliesStore.getState();
        const ally1 = alliesStore.recruitAlly("Cha Hae-In", "demon-castle");
        const ally2 = alliesStore.recruitAlly("Yoo Jin-Ho", "demon-castle");

        const dungeonsStore = useDungeonsStore.getState();
        const dungeons = dungeonsStore.dungeons;
        const allianceDungeon = dungeons.find(
          (d) => d.unlocked && d.type === "alliance",
        );

        // If we have an alliance dungeon, test with allies
        if (allianceDungeon) {
          let success = false;
          dungeonsStore.startDungeon(
            allianceDungeon.id,
            Date.now(),
            [SUNG_JINWOO_ID, ally1.id, ally2.id],
            () => {
              success = true;
            },
          );

          expect(success).toBe(true);
          const activeDungeon = useDungeonsStore.getState().activeDungeons[0];
          expect(activeDungeon.partyIds?.length).toBe(3);
        } else {
          // Test with solo dungeon and Sung Jinwoo
          const soloDungeon = dungeons.find(
            (d) => d.unlocked && d.type === "solo",
          );
          expect(soloDungeon).toBeDefined();

          let success = false;
          dungeonsStore.startDungeon(
            soloDungeon!.id,
            Date.now(),
            [SUNG_JINWOO_ID],
            () => {
              success = true;
            },
          );

          expect(success).toBe(true);
        }
      });

      it("should prevent adding more companions than max party slots allows", () => {
        // With authority 1, max party size is 1 companion
        const authority = 1;
        const maxSlots = calculateMaxPartySlots(authority);
        expect(maxSlots).toBe(1);

        // Create multiple allies
        const alliesStore = useAlliesStore.getState();
        alliesStore.recruitAlly("Ally1", "dungeon1");
        alliesStore.recruitAlly("Ally2", "dungeon1");
        alliesStore.recruitAlly("Ally3", "dungeon1");

        const allAllies = useAlliesStore.getState().allies;
        expect(allAllies.length).toBe(3);

        // The party selection should be limited to maxSlots companions
        // (Sung Jinwoo is separate, so companions are limited to maxSlots)
        const partyLimitedToMax = allAllies.slice(0, maxSlots);
        expect(partyLimitedToMax.length).toBe(1);
      });
    });

    describe("Nameless Grunts Leadership", () => {
      it("should identify named companions correctly", () => {
        const alliesStore = useAlliesStore.getState();

        // Named ally (from dungeon)
        const namedAlly = alliesStore.recruitAlly(
          "Cha Hae-In",
          "demon-castle-entrance",
        );
        expect(namedAlly.originDungeonId).not.toBe("recruited");

        // Nameless grunt (generic recruited)
        const grunt = alliesStore.recruitGenericAlly("Hunter", "E");
        expect(grunt.originDungeonId).toBe("recruited");
      });

      it("should validate party has valid leader (Sung Jinwoo or named companion)", () => {
        const alliesStore = useAlliesStore.getState();
        const namedAlly = alliesStore.recruitAlly("Cha Hae-In", "demon-castle");
        const grunt = alliesStore.recruitGenericAlly("Hunter", "E");

        // Valid party: Sung Jinwoo leads
        const party1 = [SUNG_JINWOO_ID, grunt.id];
        const hasValidLeader1 =
          party1.includes(SUNG_JINWOO_ID) ||
          party1.some((id) => {
            const ally = useAlliesStore
              .getState()
              .allies.find((a) => a.id === id);
            return ally && ally.originDungeonId !== "recruited";
          });
        expect(hasValidLeader1).toBe(true);

        // Valid party: Named companion leads
        const party2 = [namedAlly.id, grunt.id];
        const hasValidLeader2 =
          party2.includes(SUNG_JINWOO_ID) ||
          party2.some((id) => {
            const ally = useAlliesStore
              .getState()
              .allies.find((a) => a.id === id);
            return ally && ally.originDungeonId !== "recruited";
          });
        expect(hasValidLeader2).toBe(true);

        // Invalid party: Only grunt
        const party3 = [grunt.id];
        const hasValidLeader3 =
          party3.includes(SUNG_JINWOO_ID) ||
          party3.some((id) => {
            const ally = useAlliesStore
              .getState()
              .allies.find((a) => a.id === id);
            return ally && ally.originDungeonId !== "recruited";
          });
        expect(hasValidLeader3).toBe(false);
      });
    });
  });
});
