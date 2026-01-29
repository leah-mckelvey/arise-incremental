/**
 * Action module exports
 * Re-exports all action functions from their respective modules
 */

// Sync actions
export { syncServerState } from './syncActions';

// Building actions
export { purchaseBuilding, purchaseBuildingBulk } from './buildingActions';

// Research actions
export { purchaseResearch } from './researchActions';

// Hunter actions
export {
  getEffectiveHunterStats,
  checkDungeonUnlocks,
  checkNecromancerUnlock,
  handleLevelUp,
  allocateStat,
} from './hunterActions';

// Artifact actions
export {
  craftArtifact,
  craftArtifactBulk,
  equipArtifact,
  unequipArtifact,
  upgradeArtifact,
  upgradeArtifactBulk,
  destroyArtifact,
  destroyArtifactsUnderRank,
} from './artifactActions';

// Dungeon actions
export { startDungeon, cancelDungeon, checkDungeonCompletion } from './dungeonActions';

// Companion actions
export { recruitGenericAlly, extractShadowManual } from './companionActions';
