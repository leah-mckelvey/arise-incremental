# End-to-End Test Specification

## Overview
End-to-end tests that run against a REAL backend server with a REAL database. No mocks. These tests simulate actual player behavior and verify the entire system works together.

## Test Infrastructure

### Setup
- **Backend**: Real Express server on port 3002 (to avoid conflicts)
- **Database**: Separate SQLite test database (`test.db`)
- **Frontend**: Real React components + real Zustand stores + real API calls
- **User**: Dedicated test user ID (`e2e-test-user`)

### Cleanup
- Delete test database after each test suite
- Clear localStorage between tests
- Reset all stores between tests

## Test Categories

### 1. Basic Player Flow (Happy Path)
**Goal**: Verify a new player can perform basic actions

**1.1 New Player Journey**
- Start with fresh account (no prior state)
- Verify initial resources are 0
- Gather essence (click button)
- Verify essence increases
- Gather enough to buy first building
- Purchase building
- Verify resources deducted
- Verify building count increases
- Wait for passive income
- Verify resources increase over time

**1.2 Level Up Flow**
- Gather resources to gain XP
- Verify XP increases
- Reach level 2 (100 XP)
- Verify stat points granted (3 points)
- Allocate stat point to strength
- Verify strength increases
- Verify stat points decrease

### 2. Button Spamming & Race Conditions
**Goal**: Verify system handles rapid user input correctly

**2.1 Spam Gather Button**
- Click gather essence 20 times rapidly
- Verify only valid transactions processed
- Verify no duplicate transactions (clientTxId deduplication)
- Verify final state matches backend

**2.2 Spam Purchase Button**
- Set resources to exactly 50 essence
- Spam purchase essenceExtractor (costs 10) 10 times
- Verify only 5 purchases succeed (50 / 10 = 5)
- Verify essence = 0
- Verify building count = 5
- Verify no negative resources

**2.3 Concurrent Different Actions**
- Simultaneously: gather essence + mine crystals + collect gold
- Verify all 3 succeed
- Verify state is consistent

**2.4 Purchase During Passive Income**
- Buy building that produces essence
- Wait 2 seconds (passive income accumulates)
- Purchase another building
- Verify passive income was applied before purchase validation

### 3. Offline Gains
**Goal**: Verify offline gains calculation works correctly

**3.1 Short Offline Period (1 minute)**
- Set up: Buy 1 essenceExtractor (produces 0.1 essence/sec)
- Manipulate lastUpdate to 60 seconds ago
- Fetch game state
- Verify offlineGains.timeAway ≈ 60000ms
- Verify offlineGains.resourceGains.essence ≈ 6 (0.1 * 60)
- Verify resources updated correctly

**3.2 Long Offline Period (24 hours - capped)**
- Set up: Buy buildings
- Manipulate lastUpdate to 24 hours ago
- Fetch game state
- Verify offlineGains.capped = true
- Verify gains capped at MAX_OFFLINE_TIME (4 hours)

**3.3 Offline Gains with Resource Caps**
- Set up: essenceCap = 100, building produces 1 essence/sec
- Manipulate lastUpdate to 200 seconds ago
- Fetch game state
- Verify essence capped at 100 (not 200)
- Verify offlineGains.capped = true

### 4. State Persistence & "App Reopen"
**Goal**: Verify state persists correctly across sessions

**4.1 Save and Reload**
- Perform actions: gather, purchase, allocate stats
- Verify localStorage has data
- Unmount all components
- Clear React state
- Remount components
- Verify state restored from localStorage
- Verify state syncs with backend

**4.2 Backend as Source of Truth**
- Perform actions on frontend
- Manually corrupt localStorage (set essence = 9999)
- Reload (fetch from backend)
- Verify backend state overwrites corrupted local state

### 5. Error Handling & Recovery
**Goal**: Verify system handles errors gracefully

**5.1 Insufficient Resources**
- Set essence = 5
- Try to purchase essenceExtractor (costs 10)
- Verify error response
- Verify frontend state unchanged
- Verify backend state unchanged

**5.2 Invalid Building ID**
- Try to purchase "nonexistentBuilding"
- Verify 400 error
- Verify state unchanged

**5.3 Validation Edge Cases**
- Try to allocate stat with 0 stat points
- Verify API not called (client-side validation)
- Try to purchase with exactly enough resources
- Verify success

### 6. Complex Multi-Step Scenarios
**Goal**: Verify complex player workflows

**6.1 Full Progression Loop**
- Gather resources
- Purchase buildings
- Wait for passive income
- Level up from passive XP
- Allocate stats
- Purchase research
- Unlock new buildings
- Verify entire flow works end-to-end

**6.2 Resource Cap Enforcement**
- Fill essence to cap (100)
- Try to gather more
- Verify capped at 100
- Purchase essenceVault (increases cap to 150)
- Gather more
- Verify new cap enforced

## Success Criteria
- ✅ All tests pass with real backend
- ✅ No race conditions cause duplicate transactions
- ✅ Offline gains calculated correctly
- ✅ State persistence works across "sessions"
- ✅ Backend is always source of truth
- ✅ Error handling prevents invalid states
- ✅ System is bulletproof under stress

