# State Synchronization Testing Plan

## Problem Statement
Frontend and backend are falling out of sync when transactions fail due to insufficient resources. The error messaging is unclear, and the frontend doesn't properly reflect the backend's source of truth.

## Hypotheses

### 1. Optimistic Updates Not Rolling Back
**Hypothesis**: Frontend applies optimistic updates, backend rejects, but frontend doesn't roll back.
**Test**: Attempt purchase with insufficient resources, check if frontend state matches backend.

### 2. Race Conditions
**Hypothesis**: Multiple rapid clicks cause overlapping requests with out-of-order responses.
**Test**: Rapidly click purchase button 5+ times, verify final state matches backend.

### 3. Partial State Sync
**Hypothesis**: `syncServerState` doesn't update all stores on error responses.
**Test**: Check if error responses include full state and if all stores update.

### 4. Client Transaction ID Issues
**Hypothesis**: Failed transactions aren't properly tracked/cleaned up.
**Test**: Send duplicate clientTxId, verify deduplication works.

### 5. Passive Income Timing
**Hypothesis**: Backend applies passive income before validation, frontend doesn't account for this.
**Test**: Wait for passive income to accumulate, attempt purchase, verify calculations.

## Testing Strategy

### Phase 1: Instrumentation (Current)
- ✅ Created `server/lib/debugLogger.ts` - Backend transaction logging
- ✅ Created `src/lib/debugLogger.ts` - Frontend transaction logging
- ✅ Created `server/routes/game.integration.test.ts` - Integration test skeleton

### Phase 2: Enable Debug Logging
**Backend**: Set `DEBUG_TRANSACTIONS=true` in `.env`
**Frontend**: Run in browser console: `localStorage.setItem('DEBUG_TRANSACTIONS', 'true')`

### Phase 3: Manual Testing Scenarios

#### Scenario 1: Insufficient Resources
1. Set resources to exactly 90 gold (Essence Vault costs 100)
2. Click "Purchase Essence Vault"
3. **Expected**: Clear error message, no state change
4. **Check**: Frontend resources === Backend resources

#### Scenario 2: Race Condition
1. Set resources to exactly 100 gold
2. Rapidly click "Purchase Essence Vault" 5 times
3. **Expected**: Only 1 purchase succeeds, others rejected
4. **Check**: Frontend shows 1 vault, 0 gold

#### Scenario 3: Passive Income Edge Case
1. Set resources to 95 gold, passive income = 10 gold/sec
2. Wait 1 second (should have 105 gold on backend)
3. Click "Purchase Essence Vault" (costs 100)
4. **Expected**: Purchase succeeds (backend has 105)
5. **Check**: Frontend syncs to show 5 gold remaining

#### Scenario 4: Multiple Resource Types
1. Set essence=40, crystals=40 (Essence Vault needs 50 crystals)
2. Click "Purchase Essence Vault"
3. **Expected**: Error message specifies "Not enough crystals"
4. **Check**: Frontend state unchanged

### Phase 4: Integration Tests
Write tests for:
- [ ] Successful purchase flow
- [ ] Insufficient resources rejection
- [ ] Error response format
- [ ] Database rollback on failure
- [ ] Concurrent request handling
- [ ] ClientTxId deduplication
- [ ] Passive income integration

### Phase 5: E2E Tests (Future)
Use Playwright/Cypress to test:
- [ ] Full user flow: login → gather → purchase → verify UI
- [ ] Error message display
- [ ] State persistence across page reload
- [ ] Network failure recovery

## Debug Commands

### Enable Logging
```bash
# Backend
echo "DEBUG_TRANSACTIONS=true" >> .env

# Frontend (in browser console)
localStorage.setItem('DEBUG_TRANSACTIONS', 'true')
```

### View Logs
```javascript
// Frontend (in browser console)
import { getFrontendLogs } from './src/lib/debugLogger';
console.table(getFrontendLogs());
```

### Clear Logs
```javascript
// Frontend
localStorage.removeItem('DEBUG_TRANSACTIONS')
```

## Success Criteria
- [ ] All error messages clearly state the reason (e.g., "Not enough gold")
- [ ] Frontend state always matches backend after any transaction
- [ ] No race conditions cause duplicate purchases
- [ ] Integration tests cover all transaction paths
- [ ] Debug logging helps identify desync issues quickly

