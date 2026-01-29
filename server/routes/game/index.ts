import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';

// Import sub-routers
import { stateRouter } from './state.js';
import { resourcesRouter } from './resources.js';
import { buildingsRouter } from './buildings.js';
import { hunterRouter } from './hunter.js';
import { researchRouter } from './research.js';
import { dungeonsRouter } from './dungeons.js';
import { alliesRouter } from './allies.js';
import { shadowsRouter } from './shadows.js';
import { adminRouter } from './admin.js';

// Create main game router
export const gameRouter = Router();

// All game routes require authentication
gameRouter.use(authMiddleware);

// Mount sub-routers
// State endpoint is at the root (GET /api/game/state -> GET /)
gameRouter.use(stateRouter);
// All other endpoints are also at root since they have full paths
gameRouter.use(resourcesRouter);
gameRouter.use(buildingsRouter);
gameRouter.use(hunterRouter);
gameRouter.use(researchRouter);
gameRouter.use(dungeonsRouter);
gameRouter.use(alliesRouter);
gameRouter.use(shadowsRouter);
gameRouter.use(adminRouter);

// Re-export utility functions for testing
export { setDatabase, verifyDbInstance, debugReadGameState, getDbName } from './utils/index.js';

export default gameRouter;
