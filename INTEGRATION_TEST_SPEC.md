# Integration Test Specification

## Purpose
This document defines the expected behavior of all backend mutation endpoints. These are the requirements that the code MUST satisfy. If tests fail, we fix the code, not the tests.

## Test Environment Setup

### Prerequisites
- Clean database state before each test
- Known user ID for all tests
- Predictable timestamps for passive income calculations

### Test Data
- Initial state: 100 essence, 100 crystals, 100 gold, 50 souls
- Initial caps: 1000 essence, 1000 crystals, 1000 gold, 500 souls
- Hunter level: 5
- No buildings owned initially
- All research unresearched initially

---

## 1. POST /api/game/gather-resource

### 1.1 Successful Gather - Essence
**Given**: User has 100 essence, hunter has 10 SENSE
**When**: POST /api/game/gather-resource with resource="essence"
**Then**:
- Response status: 200
- Response body: `{ success: true, state: GameStateDTO }`
- `state.resources.essence` = 100 + calculated gather amount (based on SENSE)
- `state.hunter.xp` = previous XP + calculated XP gain
- Database updated with new values
- Transaction logged with correct clientTxId

### 1.2 Successful Gather - Crystals
**Given**: User has 100 crystals, hunter has 10 INTELLIGENCE
**When**: POST /api/game/gather-resource with resource="crystals"
**Then**:
- Response status: 200
- `state.resources.crystals` = 100 + calculated gather amount (based on INTELLIGENCE)
- `state.hunter.xp` increased

### 1.3 Successful Gather - Gold
**Given**: User has 100 gold, hunter has 10 AGILITY
**When**: POST /api/game/gather-resource with resource="gold"
**Then**:
- Response status: 200
- `state.resources.gold` = 100 + calculated gather amount (based on AGILITY)
- `state.hunter.xp` increased

### 1.4 Gather with Resource Cap
**Given**: User has 990 essence, cap is 1000, gather amount is 20
**When**: POST /api/game/gather-resource with resource="essence"
**Then**:
- Response status: 200
- `state.resources.essence` = 1000 (capped, not 1010)

### 1.5 Duplicate Transaction ID
**Given**: Transaction with clientTxId="tx-123" already exists
**When**: POST /api/game/gather-resource with clientTxId="tx-123"
**Then**:
- Response status: 200
- Response body: `{ success: true, state: <previous transaction's stateAfter> }`
- No new database changes
- No new transaction logged

### 1.6 Missing Required Fields
**Given**: Valid user
**When**: POST /api/game/gather-resource with missing `resource` or `clientTxId`
**Then**:
- Response status: 400
- Response body: `{ error: "Missing required fields" }`

---

## 2. POST /api/game/purchase-building

### 2.1 Successful Purchase - Sufficient Resources
**Given**: 
- User has 100 essence, 100 gold
- Building "essenceVault" costs 50 essence, 25 gold
- Building count: 0
**When**: POST /api/game/purchase-building with buildingId="essenceVault"
**Then**:
- Response status: 200
- Response body: `{ success: true, state: GameStateDTO }`
- `state.resources.essence` = 50 (100 - 50)
- `state.resources.gold` = 75 (100 - 25)
- `state.buildings.essenceVault.count` = 1
- `state.resourceCaps.essence` increased (building provides +100 cap)
- Database updated
- Transaction logged

### 2.2 Failed Purchase - Insufficient Resources (Single Resource)
**Given**:
- User has 30 essence, 100 gold
- Building costs 50 essence, 25 gold
**When**: POST /api/game/purchase-building with buildingId="essenceVault"
**Then**:
- Response status: 400
- Response body: `{ success: false, error: "Need 20 essence more", missing: { essence: 20 }, state: GameStateDTO }`
- `state.resources.essence` = 30 (unchanged)
- `state.resources.gold` = 100 (unchanged)
- `state.buildings.essenceVault.count` = 0 (unchanged)
- Database NOT updated
- No transaction logged

### 2.3 Failed Purchase - Insufficient Resources (Multiple Resources)
**Given**:
- User has 30 essence, 10 gold
- Building costs 50 essence, 25 gold
**When**: POST /api/game/purchase-building
**Then**:
- Response status: 400
- Response body: `{ success: false, error: "Need 20 essence and 15 gold more", missing: { essence: 20, gold: 15 }, state: GameStateDTO }`
- Resources unchanged
- Database NOT updated

### 2.4 Purchase with Passive Income Applied
**Given**:
- User has 30 essence at lastUpdate = T0
- User has 1 "essenceExtractor" building (produces 3 essence per 0.1 sec = 30 essence/sec)
- Current time = T0 + 5 seconds
- Building costs 50 essence
**When**: POST /api/game/purchase-building
**Then**:
- Response status: 200
- Passive income applied: 30 + (30 * 5) = 180 essence
- After purchase: 180 - 50 = 130 essence
- `state.resources.essence` = 130

### 2.5 Failed Purchase After Passive Income
**Given**:
- User has 30 essence at lastUpdate = T0
- User has 1 "essenceExtractor" (produces 30 essence/sec)
- Current time = T0 + 0.5 seconds
- Building costs 50 essence
**When**: POST /api/game/purchase-building
**Then**:
- Response status: 400
- Passive income applied: 30 + (30 * 0.5) = 45 essence
- Still insufficient: need 5 more
- Response body: `{ success: false, error: "Need 5 essence more", missing: { essence: 5 }, state: GameStateDTO }`
- `state.resources.essence` = 45 (with passive income applied)

### 2.6 Duplicate Transaction ID
**Given**: Transaction with clientTxId="tx-456" already exists
**When**: POST /api/game/purchase-building with clientTxId="tx-456"
**Then**:
- Response status: 200
- Response body: `{ success: true, state: <previous transaction's stateAfter> }`
- No new database changes

### 2.7 Invalid Building ID
**Given**: Valid user
**When**: POST /api/game/purchase-building with buildingId="nonexistent"
**Then**:
- Response status: 400
- Response body: `{ error: "Invalid building ID" }`

---

## 3. POST /api/game/purchase-bulk-building

### 3.1 Successful Bulk Purchase
**Given**:
- User has 500 essence, 250 gold
- Building costs 50 essence, 25 gold (base cost)
- Quantity: 5
- Total cost: 250 essence, 125 gold (assuming linear scaling)
**When**: POST /api/game/purchase-bulk-building with quantity=5
**Then**:
- Response status: 200
- `state.resources.essence` = 250 (500 - 250)
- `state.resources.gold` = 125 (250 - 125)
- `state.buildings.essenceVault.count` = 5
- Resource caps updated correctly

### 3.2 Failed Bulk Purchase - Insufficient Resources
**Given**:
- User has 100 essence, 100 gold
- Building costs 50 essence, 25 gold (base)
- Quantity: 5
- Total cost: 250 essence, 125 gold
**When**: POST /api/game/purchase-bulk-building with quantity=5
**Then**:
- Response status: 400
- Response body: `{ success: false, error: "Need 150 essence and 25 gold more", missing: { essence: 150, gold: 25 }, state: GameStateDTO }`
- Resources unchanged
- Building count unchanged

### 3.3 Bulk Purchase with Quantity = 0
**Given**: Valid user
**When**: POST /api/game/purchase-bulk-building with quantity=0
**Then**:
- Response status: 400
- Response body: `{ error: "Invalid quantity" }`

### 3.4 Bulk Purchase with Negative Quantity
**Given**: Valid user
**When**: POST /api/game/purchase-bulk-building with quantity=-5
**Then**:
- Response status: 400
- Response body: `{ error: "Invalid quantity" }`

---

## 4. POST /api/game/purchase-research

### 4.1 Successful Research Purchase
**Given**:
- User has 100 knowledge
- Research "basicEfficiency" costs 50 knowledge
- Research is not yet researched
- No prerequisites
**When**: POST /api/game/purchase-research with researchId="basicEfficiency"
**Then**:
- Response status: 200
- `state.resources.knowledge` = 50 (100 - 50)
- `state.research.basicEfficiency.researched` = true
- Resource caps updated (if research provides bonuses)
- Database updated
- Transaction logged

### 4.2 Failed Research - Insufficient Knowledge
**Given**:
- User has 30 knowledge
- Research costs 50 knowledge
**When**: POST /api/game/purchase-research
**Then**:
- Response status: 400
- Response body: `{ success: false, error: "Need 20 knowledge more", missing: { knowledge: 20 }, state: GameStateDTO }`
- `state.resources.knowledge` = 30 (unchanged)
- `state.research.basicEfficiency.researched` = false

### 4.3 Failed Research - Already Researched
**Given**:
- User has 100 knowledge
- Research "basicEfficiency" is already researched
**When**: POST /api/game/purchase-research with researchId="basicEfficiency"
**Then**:
- Response status: 400
- Response body: `{ error: "Research already purchased" }`

### 4.4 Failed Research - Prerequisites Not Met
**Given**:
- User has 100 knowledge
- Research "advancedEfficiency" requires "basicEfficiency"
- "basicEfficiency" is NOT researched
**When**: POST /api/game/purchase-research with researchId="advancedEfficiency"
**Then**:
- Response status: 400
- Response body: `{ error: "Prerequisites not met" }`

### 4.5 Successful Research - Prerequisites Met
**Given**:
- User has 100 knowledge
- Research "advancedEfficiency" requires "basicEfficiency"
- "basicEfficiency" IS researched
- "advancedEfficiency" costs 50 knowledge
**When**: POST /api/game/purchase-research with researchId="advancedEfficiency"
**Then**:
- Response status: 200
- `state.research.advancedEfficiency.researched` = true
- `state.resources.knowledge` = 50

### 4.6 Invalid Research ID
**Given**: Valid user
**When**: POST /api/game/purchase-research with researchId="nonexistent"
**Then**:
- Response status: 400
- Response body: `{ error: "Invalid research ID" }`

---

## 5. POST /api/game/recruit-ally

### 5.1 Successful Ally Recruitment
**Given**:
- User has 500 attraction
- Rank "C" costs 1000 attraction
- User has 1500 attraction
**When**: POST /api/game/recruit-ally with name="TestAlly", rank="C"
**Then**:
- Response status: 200
- `state.resources.attraction` = 500 (1500 - 1000)
- `state.allies` contains new ally with name="TestAlly", rank="C", level=1
- Database updated
- Transaction logged

### 5.2 Failed Recruitment - Insufficient Attraction
**Given**:
- User has 500 attraction
- Rank "C" costs 1000 attraction
**When**: POST /api/game/recruit-ally with name="TestAlly", rank="C"
**Then**:
- Response status: 400
- Response body: `{ success: false, error: "Need 500 attraction more", missing: { attraction: 500 }, state: GameStateDTO }`
- `state.resources.attraction` = 500 (unchanged)
- `state.allies` unchanged (no new ally)

### 5.3 Recruitment with Invalid Rank
**Given**: Valid user
**When**: POST /api/game/recruit-ally with name="TestAlly", rank="Z"
**Then**:
- Response status: 400
- Response body: `{ error: "Invalid rank" }` OR uses default cost

### 5.4 Multiple Allies with Same Name
**Given**:
- User has 3000 attraction
- Ally "TestAlly" already exists
**When**: POST /api/game/recruit-ally with name="TestAlly", rank="C"
**Then**:
- Response status: 200
- New ally created with same name but different ID
- `state.allies` contains 2 allies named "TestAlly"

---

## 6. POST /api/game/extract-shadow

### 6.1 Successful Shadow Extraction
**Given**:
- User has 2000 souls
- Shadow extraction costs 1000 souls
- Dungeon "doubleDungeon" exists
**When**: POST /api/game/extract-shadow with name="TestShadow", dungeonId="doubleDungeon"
**Then**:
- Response status: 200
- `state.resources.souls` = 1000 (2000 - 1000)
- `state.shadows` contains new shadow with name="TestShadow", originDungeonId="doubleDungeon", level=1
- Database updated
- Transaction logged

### 6.2 Failed Extraction - Insufficient Souls
**Given**:
- User has 500 souls
- Shadow extraction costs 1000 souls
**When**: POST /api/game/extract-shadow
**Then**:
- Response status: 400
- Response body: `{ success: false, error: "Need 500 souls more", missing: { souls: 500 }, state: GameStateDTO }`
- `state.resources.souls` = 500 (unchanged)
- `state.shadows` unchanged

### 6.3 Invalid Dungeon ID
**Given**: Valid user with sufficient souls
**When**: POST /api/game/extract-shadow with dungeonId="nonexistent"
**Then**:
- Response status: 400
- Response body: `{ error: "Invalid dungeon ID" }`

---

## 7. Race Conditions & Concurrency

### 7.1 Concurrent Purchases - Same Resource
**Given**:
- User has 100 essence
- Two requests sent simultaneously:
  - Request A: Purchase building costing 60 essence
  - Request B: Purchase building costing 60 essence
**When**: Both requests processed concurrently
**Then**:
- ONE request succeeds (200), ONE request fails (400)
- Final `state.resources.essence` = 40 (100 - 60)
- Only ONE building purchased
- Database consistent (no negative resources)

### 7.2 Concurrent Purchases - Different Resources
**Given**:
- User has 100 essence, 100 gold
- Two requests sent simultaneously:
  - Request A: Purchase building costing 60 essence
  - Request B: Purchase building costing 60 gold
**When**: Both requests processed concurrently
**Then**:
- BOTH requests succeed (200)
- `state.resources.essence` = 40
- `state.resources.gold` = 40
- Both buildings purchased

### 7.3 Duplicate ClientTxId - Concurrent Requests
**Given**: Two identical requests with same clientTxId sent simultaneously
**When**: Both requests processed concurrently
**Then**:
- ONE request processes transaction
- OTHER request returns cached result
- No duplicate transaction in database
- Both responses identical

---

## 8. Error Response Format

### 8.1 All Error Responses Must Include Current State
**Given**: ANY failed transaction due to insufficient resources
**When**: Error response returned
**Then**:
- Response body MUST include: `{ success: false, error: string, missing: Partial<Resources>, state: GameStateDTO }`
- `state` field contains CURRENT server state (with passive income applied)
- Frontend can sync with server state even on error

### 8.2 Error Messages Must Be Specific
**Given**: Failed transaction due to insufficient resources
**When**: Error response returned
**Then**:
- Error message format: "Need X resource1 and Y resource2 more"
- NOT generic: "Cannot afford building"
- NOT generic: "Insufficient resources"

---

## 9. Database Consistency

### 9.1 Transaction Rollback on Error
**Given**: Purchase fails due to insufficient resources
**When**: Error occurs during transaction
**Then**:
- Database state UNCHANGED
- No partial updates
- Resources not deducted
- Building counts not incremented

### 9.2 Transaction Logging
**Given**: Successful transaction
**When**: Transaction completes
**Then**:
- Transaction record created in `transactions` table
- Record includes: id, userId, clientTxId, type, payload, stateAfter
- `stateAfter` is complete GameStateDTO

---

## 10. Response Structure Validation

### 10.1 Success Response Structure
**Given**: Successful transaction
**When**: Response returned
**Then**:
- Response body: `{ success: true, state: GameStateDTO }`
- `state` is COMPLETE GameStateDTO with ALL fields:
  - `resources` (nested object with all 7 resources)
  - `resourceCaps` (nested object with all 7 caps)
  - `hunter` (nested object with level, xp, stats, etc.)
  - `buildings`, `research`, `artifacts`, `dungeons`, `activeDungeons`, `allies`, `shadows`
  - `lastUpdate` (timestamp)

### 10.2 Error Response Structure
**Given**: Failed transaction
**When**: Response returned
**Then**:
- Response body: `{ success: false, error: string, missing?: Partial<Resources>, state: GameStateDTO }`
- `state` is COMPLETE GameStateDTO (same as success)

---

## Summary

**Total Test Cases**: ~40 edge cases across 10 categories

**Critical Requirements**:
1. ✅ Passive income ALWAYS applied before validation
2. ✅ Error responses include current state for sync
3. ✅ Error messages are specific and helpful
4. ✅ Database consistency maintained (no partial updates)
5. ✅ Duplicate clientTxId handled correctly
6. ✅ Race conditions handled safely
7. ✅ Response structure is consistent and complete

**Next Step**: Write integration tests that codify these requirements.


