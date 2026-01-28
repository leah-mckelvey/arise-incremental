import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { db } from "../db/client.js";
import { gameStates, transactions, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { createApp } from "../app.js";
import { initialBuildings } from "../data/initialBuildings.js";
import { initialResearch } from "../data/initialResearch.js";
import { initialDungeons } from "../data/initialDungeons.js";

/**
 * Integration tests for game API endpoints
 * These test the full backend flow: HTTP request → endpoint → database → response
 *
 * IMPORTANT: If tests fail, fix the CODE, not the tests.
 * The spec (INTEGRATION_TEST_SPEC.md) is the source of truth.
 */

const app = createApp();

describe("Game API Integration Tests", () => {
  // Use the same userId that the auth middleware uses
  const TEST_USER_ID = "test-user-1";

  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(transactions).where(eq(transactions.userId, TEST_USER_ID));
    await db.delete(gameStates).where(eq(gameStates.userId, TEST_USER_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));

    // Create test user first (foreign key requirement)
    await db.insert(users).values({
      id: TEST_USER_ID,
      email: "test@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create a fresh game state for testing
    await db.insert(gameStates).values({
      id: crypto.randomUUID(),
      userId: TEST_USER_ID,
      version: 1,
      essence: 100,
      crystals: 100,
      gold: 100,
      souls: 50,
      attraction: 0,
      gems: 0,
      knowledge: 100,
      essenceCap: 1000,
      crystalsCap: 1000,
      goldCap: 1000,
      soulsCap: 500,
      attractionCap: 100,
      gemsCap: 100,
      knowledgeCap: 1000,
      hunterLevel: 5,
      hunterXp: 0,
      hunterXpToNextLevel: 100,
      hunterRank: "E",
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
  });

  afterEach(async () => {
    // Clean up test data (cascade will handle gameStates and transactions)
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
  });

  describe("1. POST /api/game/gather-resource", () => {
    it("1.1 should successfully gather essence", async () => {
      const response = await request(app)
        .post("/api/game/gather-resource")
        .send({
          resource: "essence",
          clientTxId: `test-gather-essence-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.state).toBeDefined();
      expect(response.body.state.resources.essence).toBeGreaterThan(100);
      expect(response.body.state.hunter.xp).toBeGreaterThan(0);
    });

    it("1.2 should successfully gather crystals", async () => {
      const response = await request(app)
        .post("/api/game/gather-resource")
        .send({
          resource: "crystals",
          clientTxId: `test-gather-crystals-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.state.resources.crystals).toBeGreaterThan(100);
      expect(response.body.state.hunter.xp).toBeGreaterThan(0);
    });

    it("1.3 should successfully gather gold", async () => {
      const response = await request(app)
        .post("/api/game/gather-resource")
        .send({
          resource: "gold",
          clientTxId: `test-gather-gold-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.state.resources.gold).toBeGreaterThan(100);
      expect(response.body.state.hunter.xp).toBeGreaterThan(0);
    });

    it("1.4 should cap resources at resourceCaps", async () => {
      // Set essence to near cap
      await db
        .update(gameStates)
        .set({ essence: 990 })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/gather-resource")
        .send({
          resource: "essence",
          clientTxId: `test-gather-cap-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.state.resources.essence).toBeLessThanOrEqual(1000);
    });

    it("1.5 should handle duplicate transaction ID", async () => {
      const clientTxId = `test-duplicate-${Date.now()}`;

      // First request
      const response1 = await request(app)
        .post("/api/game/gather-resource")
        .send({ resource: "essence", clientTxId });

      // Second request with same clientTxId
      const response2 = await request(app)
        .post("/api/game/gather-resource")
        .send({ resource: "essence", clientTxId });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.state.resources.essence).toBe(
        response2.body.state.resources.essence,
      );
    });

    it("1.6 should reject request with missing fields", async () => {
      const response = await request(app)
        .post("/api/game/gather-resource")
        .send({ resource: "essence" }); // Missing clientTxId

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("2. POST /api/game/purchase-building", () => {
    it("2.1 should successfully purchase building with sufficient resources", async () => {
      const response = await request(app)
        .post("/api/game/purchase-building")
        .send({
          buildingId: "essenceVault",
          clientTxId: `test-purchase-building-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.state).toBeDefined();
      expect(response.body.state.resources.essence).toBeLessThan(100);
      expect(response.body.state.buildings.essenceVault.count).toBeGreaterThan(
        0,
      );
    });

    it("2.2 should fail purchase with insufficient resources (single resource)", async () => {
      // Set essence to low value
      await db
        .update(gameStates)
        .set({ essence: 10 })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/purchase-building")
        .send({
          buildingId: "essenceVault",
          clientTxId: `test-insufficient-single-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("essence");
      expect(response.body.missing).toBeDefined();
      expect(response.body.missing.essence).toBeGreaterThan(0);
      expect(response.body.state).toBeDefined();
      expect(response.body.state.resources.essence).toBe(10);
    });

    it("2.3 should fail purchase with insufficient resources (multiple resources)", async () => {
      // Set both essence and gold to low values
      await db
        .update(gameStates)
        .set({ essence: 10, gold: 5 })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/purchase-building")
        .send({
          buildingId: "essenceVault",
          clientTxId: `test-insufficient-multiple-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.missing).toBeDefined();
      expect(response.body.state).toBeDefined();
    });

    it("2.4 should apply passive income before purchase validation", async () => {
      // Set essence to low value but with buildings that generate essence
      const buildingsWithExtractor = {
        ...initialBuildings,
        essenceExtractor: { ...initialBuildings.essenceExtractor, count: 1 },
      };

      await db
        .update(gameStates)
        .set({
          essence: 30,
          buildings: buildingsWithExtractor,
          lastUpdate: new Date(Date.now() - 5000), // 5 seconds ago
        })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/purchase-building")
        .send({
          buildingId: "essenceVault",
          clientTxId: `test-passive-income-${Date.now()}`,
        });

      // Should succeed if passive income is applied (30 + 30*5 = 180, enough for 50 cost)
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("2.5 should fail purchase even after passive income if still insufficient", async () => {
      // Set essence to low value with minimal passive income
      const buildingsWithExtractor = {
        ...initialBuildings,
        essenceExtractor: { ...initialBuildings.essenceExtractor, count: 1 },
      };

      await db
        .update(gameStates)
        .set({
          essence: 30,
          gold: 10, // Not enough gold either
          buildings: buildingsWithExtractor,
          lastUpdate: new Date(Date.now() - 500), // 0.5 seconds ago
        })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/purchase-building")
        .send({
          buildingId: "crystalMine", // Costs 50 essence + 50 gold
          clientTxId: `test-passive-insufficient-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.state).toBeDefined();
      // State should include passive income (30 + 30*0.5 = 45 essence)
      expect(response.body.state.resources.essence).toBeGreaterThan(30);
      expect(response.body.state.resources.essence).toBeLessThan(50);
    });

    it("2.6 should handle duplicate transaction ID", async () => {
      const clientTxId = `test-duplicate-purchase-${Date.now()}`;

      const response1 = await request(app)
        .post("/api/game/purchase-building")
        .send({ buildingId: "essenceVault", clientTxId });

      const response2 = await request(app)
        .post("/api/game/purchase-building")
        .send({ buildingId: "essenceVault", clientTxId });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.state.buildings.essenceVault.count).toBe(
        response2.body.state.buildings.essenceVault.count,
      );
    });

    it("2.7 should reject invalid building ID", async () => {
      const response = await request(app)
        .post("/api/game/purchase-building")
        .send({
          buildingId: "nonexistent",
          clientTxId: `test-invalid-building-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("3. POST /api/game/purchase-bulk-building", () => {
    it("3.1 should successfully purchase multiple buildings", async () => {
      // Buy libraries which cost less and don't require high essence cap
      // 5 libraries cost: 25+28+31+35+39 = ~158 essence, 25+28+31+35+39 = ~158 gold
      await db
        .update(gameStates)
        .set({
          essence: 100, // Base cap is 100, enough for first few libraries
          gold: 100,
        })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/purchase-bulk-building")
        .send({
          buildingId: "library",
          quantity: 3, // Buy 3 instead of 5 to stay within base caps
          clientTxId: `test-bulk-purchase-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(
        response.body.state.buildings.library.count,
      ).toBeGreaterThanOrEqual(3);
    });

    it("3.2 should fail bulk purchase with insufficient resources", async () => {
      const response = await request(app)
        .post("/api/game/purchase-bulk-building")
        .send({
          buildingId: "essenceVault",
          quantity: 10,
          clientTxId: `test-bulk-insufficient-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.missing).toBeDefined();
      expect(response.body.state).toBeDefined();
    });

    it("3.3 should reject quantity = 0", async () => {
      const response = await request(app)
        .post("/api/game/purchase-bulk-building")
        .send({
          buildingId: "essenceVault",
          quantity: 0,
          clientTxId: `test-bulk-zero-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("3.4 should reject negative quantity", async () => {
      const response = await request(app)
        .post("/api/game/purchase-bulk-building")
        .send({
          buildingId: "essenceVault",
          quantity: -5,
          clientTxId: `test-bulk-negative-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("4. POST /api/game/purchase-research", () => {
    it("4.1 should successfully purchase research", async () => {
      const response = await request(app)
        .post("/api/game/purchase-research")
        .send({
          researchId: "basicEfficiency",
          clientTxId: `test-research-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.state.research.basicEfficiency.researched).toBe(
        true,
      );
      expect(response.body.state.resources.knowledge).toBeLessThan(100);
    });

    it("4.2 should fail research with insufficient knowledge", async () => {
      await db
        .update(gameStates)
        .set({ knowledge: 10 })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/purchase-research")
        .send({
          researchId: "basicEfficiency",
          clientTxId: `test-research-insufficient-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.missing).toBeDefined();
      expect(response.body.missing.knowledge).toBeGreaterThan(0);
    });

    it("4.3 should fail if research already purchased", async () => {
      // First purchase
      await request(app)
        .post("/api/game/purchase-research")
        .send({
          researchId: "basicEfficiency",
          clientTxId: `test-research-first-${Date.now()}`,
        });

      // Second purchase attempt
      const response = await request(app)
        .post("/api/game/purchase-research")
        .send({
          researchId: "basicEfficiency",
          clientTxId: `test-research-duplicate-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already");
    });

    it("4.4 should fail if prerequisites not met", async () => {
      const response = await request(app)
        .post("/api/game/purchase-research")
        .send({
          researchId: "advancedEfficiency",
          clientTxId: `test-research-prereq-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("4.5 should succeed if prerequisites are met", async () => {
      // First purchase prerequisite
      await request(app)
        .post("/api/game/purchase-research")
        .send({
          researchId: "basicEfficiency",
          clientTxId: `test-research-prereq-first-${Date.now()}`,
        });

      // Then purchase dependent research
      const response = await request(app)
        .post("/api/game/purchase-research")
        .send({
          researchId: "advancedEfficiency",
          clientTxId: `test-research-prereq-second-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("4.6 should reject invalid research ID", async () => {
      const response = await request(app)
        .post("/api/game/purchase-research")
        .send({
          researchId: "nonexistent",
          clientTxId: `test-research-invalid-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("5. POST /api/game/recruit-ally", () => {
    it("5.1 should successfully recruit ally", async () => {
      // Use buildings that provide high attraction cap
      const buildingsWithBeacons = {
        ...initialBuildings,
        attractionBeacon: { ...initialBuildings.attractionBeacon, count: 150 }, // +1500 attraction cap
      };

      await db
        .update(gameStates)
        .set({
          attraction: 1500,
          buildings: buildingsWithBeacons,
        })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/recruit-ally")
        .send({
          name: "TestAlly",
          rank: "C",
          clientTxId: `test-recruit-ally-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.state.allies.length).toBeGreaterThan(0);
      expect(response.body.state.resources.attraction).toBeLessThan(1500);
    });

    it("5.2 should fail recruitment with insufficient attraction", async () => {
      const response = await request(app)
        .post("/api/game/recruit-ally")
        .send({
          name: "TestAlly",
          rank: "C",
          clientTxId: `test-recruit-insufficient-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.missing).toBeDefined();
      expect(response.body.missing.attraction).toBeGreaterThan(0);
    });

    it("5.3 should handle invalid rank", async () => {
      await db
        .update(gameStates)
        .set({ attraction: 2000 })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/recruit-ally")
        .send({
          name: "TestAlly",
          rank: "Z",
          clientTxId: `test-recruit-invalid-rank-${Date.now()}`,
        });

      // Should either reject or use default cost
      expect([200, 400]).toContain(response.status);
    });

    it("5.4 should allow multiple allies with same name", async () => {
      // Use buildings that provide high attraction cap
      const buildingsWithBeacons = {
        ...initialBuildings,
        attractionBeacon: { ...initialBuildings.attractionBeacon, count: 300 }, // +3000 attraction cap
      };

      await db
        .update(gameStates)
        .set({
          attraction: 3000,
          buildings: buildingsWithBeacons,
        })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response1 = await request(app)
        .post("/api/game/recruit-ally")
        .send({
          name: "TestAlly",
          rank: "C",
          clientTxId: `test-recruit-same-name-1-${Date.now()}`,
        });

      const response2 = await request(app)
        .post("/api/game/recruit-ally")
        .send({
          name: "TestAlly",
          rank: "C",
          clientTxId: `test-recruit-same-name-2-${Date.now()}`,
        });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response2.body.state.allies.length).toBeGreaterThan(
        response1.body.state.allies.length,
      );
    });
  });

  describe("6. POST /api/game/extract-shadow", () => {
    it("6.1 should successfully extract shadow", async () => {
      // Use buildings that provide high souls cap
      const buildingsWithChambers = {
        ...initialBuildings,
        soulChamber: { ...initialBuildings.soulChamber, count: 200 }, // +2000 souls cap
      };

      await db
        .update(gameStates)
        .set({
          souls: 2000,
          buildings: buildingsWithChambers,
        })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/extract-shadow")
        .send({
          name: "TestShadow",
          dungeonId: "doubleDungeon",
          clientTxId: `test-extract-shadow-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.state.shadows.length).toBeGreaterThan(0);
      expect(response.body.state.resources.souls).toBeLessThan(2000);
    });

    it("6.2 should fail extraction with insufficient souls", async () => {
      const response = await request(app)
        .post("/api/game/extract-shadow")
        .send({
          name: "TestShadow",
          dungeonId: "doubleDungeon",
          clientTxId: `test-extract-insufficient-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.missing).toBeDefined();
      expect(response.body.missing.souls).toBeGreaterThan(0);
    });

    it("6.3 should reject invalid dungeon ID", async () => {
      await db
        .update(gameStates)
        .set({ souls: 2000 })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/extract-shadow")
        .send({
          name: "TestShadow",
          dungeonId: "nonexistent",
          clientTxId: `test-extract-invalid-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("7. Race Conditions & Concurrency", () => {
    it("7.1 should handle concurrent purchases on same resource", async () => {
      await db
        .update(gameStates)
        .set({ essence: 100 })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const clientTxId1 = `test-concurrent-1-${Date.now()}`;
      const clientTxId2 = `test-concurrent-2-${Date.now()}`;

      const [response1, response2] = await Promise.all([
        request(app)
          .post("/api/game/purchase-building")
          .send({ buildingId: "essenceVault", clientTxId: clientTxId1 }),
        request(app)
          .post("/api/game/purchase-building")
          .send({ buildingId: "essenceVault", clientTxId: clientTxId2 }),
      ]);

      // One should succeed, one should fail (or both succeed if passive income provides enough)
      const statuses = [response1.status, response2.status];
      expect(statuses).toContain(200);

      // Verify database consistency - no negative resources
      const finalState = await db.query.gameStates.findFirst({
        where: eq(gameStates.userId, TEST_USER_ID),
      });
      expect(finalState!.essence).toBeGreaterThanOrEqual(0);
    });

    it("7.2 should handle concurrent purchases on different resources", async () => {
      await db
        .update(gameStates)
        .set({ essence: 100, gold: 100 })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const clientTxId1 = `test-concurrent-diff-1-${Date.now()}`;
      const clientTxId2 = `test-concurrent-diff-2-${Date.now()}`;

      const [response1, response2] = await Promise.all([
        request(app)
          .post("/api/game/gather-resource")
          .send({ resource: "essence", clientTxId: clientTxId1 }),
        request(app)
          .post("/api/game/gather-resource")
          .send({ resource: "gold", clientTxId: clientTxId2 }),
      ]);

      // Both should succeed since they use different resources
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it("7.3 should handle duplicate clientTxId in concurrent requests", async () => {
      const clientTxId = `test-concurrent-duplicate-${Date.now()}`;

      const [response1, response2] = await Promise.all([
        request(app)
          .post("/api/game/gather-resource")
          .send({ resource: "essence", clientTxId }),
        request(app)
          .post("/api/game/gather-resource")
          .send({ resource: "essence", clientTxId }),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      // Both should return same state
      expect(response1.body.state.resources.essence).toBe(
        response2.body.state.resources.essence,
      );

      // Verify only one transaction in database
      const txs = await db.query.transactions.findMany({
        where: eq(transactions.clientTxId, clientTxId),
      });
      expect(txs.length).toBe(1);
    });
  });

  describe("8. Error Response Format", () => {
    it("8.1 should include current state in all error responses", async () => {
      await db
        .update(gameStates)
        .set({ essence: 10 })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/purchase-building")
        .send({
          buildingId: "essenceVault",
          clientTxId: `test-error-format-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.missing).toBeDefined();
      expect(response.body.state).toBeDefined();
      expect(response.body.state.resources).toBeDefined();
      expect(response.body.state.resourceCaps).toBeDefined();
    });

    it("8.2 should provide specific error messages", async () => {
      await db
        .update(gameStates)
        .set({ essence: 10 })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/purchase-building")
        .send({
          buildingId: "essenceVault",
          clientTxId: `test-specific-error-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      // Should NOT be generic
      expect(response.body.error).not.toBe("Cannot afford building");
      expect(response.body.error).not.toBe("Insufficient resources");
      // Should contain specific resource names
      expect(response.body.error.toLowerCase()).toContain("essence");
    });
  });

  describe("9. Database Consistency", () => {
    it("9.1 should rollback transaction on error", async () => {
      await db
        .update(gameStates)
        .set({ essence: 10, gold: 10 })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const beforeState = await db.query.gameStates.findFirst({
        where: eq(gameStates.userId, TEST_USER_ID),
      });

      const response = await request(app)
        .post("/api/game/purchase-building")
        .send({
          buildingId: "essenceVault",
          clientTxId: `test-rollback-${Date.now()}`,
        });

      const afterState = await db.query.gameStates.findFirst({
        where: eq(gameStates.userId, TEST_USER_ID),
      });

      expect(response.status).toBe(400);
      // Database should be unchanged (except lastUpdate)
      expect(afterState!.essence).toBe(beforeState!.essence);
      expect(afterState!.gold).toBe(beforeState!.gold);
    });

    it("9.2 should log successful transactions", async () => {
      const clientTxId = `test-transaction-log-${Date.now()}`;

      const response = await request(app)
        .post("/api/game/gather-resource")
        .send({ resource: "essence", clientTxId });

      expect(response.status).toBe(200);

      // Verify transaction was logged
      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.clientTxId, clientTxId),
      });

      expect(tx).toBeDefined();
      expect(tx!.userId).toBe(TEST_USER_ID);
      expect(tx!.type).toBe("gather-resource");
    });
  });

  describe("10. Response Structure Validation", () => {
    it("10.1 should return complete GameStateDTO on success", async () => {
      const response = await request(app)
        .post("/api/game/gather-resource")
        .send({
          resource: "essence",
          clientTxId: `test-response-structure-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.state).toBeDefined();

      const state = response.body.state;
      // Verify all required fields
      expect(state.resources).toBeDefined();
      expect(state.resources.essence).toBeDefined();
      expect(state.resources.crystals).toBeDefined();
      expect(state.resources.gold).toBeDefined();
      expect(state.resources.souls).toBeDefined();
      expect(state.resources.attraction).toBeDefined();
      expect(state.resources.gems).toBeDefined();
      expect(state.resources.knowledge).toBeDefined();

      expect(state.resourceCaps).toBeDefined();
      expect(state.hunter).toBeDefined();
      expect(state.buildings).toBeDefined();
      expect(state.research).toBeDefined();
      expect(state.lastUpdate).toBeDefined();
    });

    it("10.2 should return complete GameStateDTO on error", async () => {
      await db
        .update(gameStates)
        .set({ essence: 10 })
        .where(eq(gameStates.userId, TEST_USER_ID));

      const response = await request(app)
        .post("/api/game/purchase-building")
        .send({
          buildingId: "essenceVault",
          clientTxId: `test-error-response-structure-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.state).toBeDefined();

      const state = response.body.state;
      // Same structure as success response
      expect(state.resources).toBeDefined();
      expect(state.resourceCaps).toBeDefined();
      expect(state.hunter).toBeDefined();
      expect(state.buildings).toBeDefined();
      expect(state.research).toBeDefined();
    });
  });
});
