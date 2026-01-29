/**
 * Hunter stat and level-up actions
 * Handles stat allocation, level-up effects, and effective stat calculations
 */

import { gameStore } from '../gameStore';
import { useBuildingsStore } from '../buildingsStore';
import { useResearchStore } from '../researchStore';
import { useHunterStore } from '../hunterStore';
import { useArtifactsStore } from '../artifactsStore';
import { useDungeonsStore } from '../dungeonsStore';
import { useShadowsStore } from '../shadowsStore';
import { useNotificationsStore } from '../notificationsStore';
import type { HunterStats } from '../types';
import { calculateResourceCaps } from '../../lib/calculations/resourceCalculations';
import {
  calculateEquippedStatBonuses,
  applyArtifactBonuses,
} from '../../lib/calculations/artifactCalculations';
import { baseResourceCaps } from '../../data/initialHunter';
import * as gameApi from '../../api/gameApi';
import { syncServerState } from './syncActions';

/**
 * Get effective hunter stats (base stats + artifact bonuses)
 */
export const getEffectiveHunterStats = (): HunterStats => {
  const hunter = useHunterStore.getState().hunter;
  const equipped = useArtifactsStore.getState().equipped;
  const artifactBonuses = calculateEquippedStatBonuses(equipped);
  return applyArtifactBonuses(hunter.stats, artifactBonuses);
};

/**
 * Unlock dungeons based on hunter level
 */
export const checkDungeonUnlocks = (hunterLevel: number) => {
  const dungeons = useDungeonsStore.getState().dungeons;
  dungeons.forEach((dungeon) => {
    if (!dungeon.unlocked && hunterLevel >= dungeon.requiredLevel) {
      useDungeonsStore.getState().unlockDungeon(dungeon.id);
    }
  });
};

/**
 * Check and unlock necromancer at level 40
 */
export const checkNecromancerUnlock = (hunterLevel: number) => {
  if (hunterLevel >= 40 && !useShadowsStore.getState().necromancerUnlocked) {
    useShadowsStore.getState().unlockNecromancer();
  }
};

/**
 * Centralized level-up handler - call this from all level-up paths
 */
export const handleLevelUp = (newLevel: number) => {
  const buildings = useBuildingsStore.getState().buildings;
  const research = useResearchStore.getState().research;
  const updatedEffectiveStats = getEffectiveHunterStats();

  // Recalculate resource caps with new level
  gameStore.setState({
    resourceCaps: calculateResourceCaps(
      baseResourceCaps,
      buildings,
      research,
      newLevel,
      updatedEffectiveStats
    ),
  });

  // Check for dungeon unlocks
  checkDungeonUnlocks(newLevel);

  // Check for necromancer unlock
  checkNecromancerUnlock(newLevel);
};

export const allocateStat = async (stat: keyof HunterStats) => {
  // Store previous state for rollback
  const previousHunter = useHunterStore.getState().hunter;
  const previousResourceCaps = gameStore.getState().resourceCaps;

  // Optimistic update
  useHunterStore.getState().allocateStat(stat);

  // Check if the allocation actually happened (hunterStore validates stat points)
  const hunter = useHunterStore.getState().hunter;
  if (hunter === previousHunter) {
    // No change - validation failed (no stat points available)
    return;
  }

  // Recalculate caps after stat allocation
  const buildings = useBuildingsStore.getState().buildings;
  const research = useResearchStore.getState().research;
  const effectiveStats = getEffectiveHunterStats();

  gameStore.setState({
    resourceCaps: calculateResourceCaps(
      baseResourceCaps,
      buildings,
      research,
      hunter.level,
      effectiveStats
    ),
  });

  // Track pending mutation
  gameStore.setState((s) => ({ pendingMutations: s.pendingMutations + 1 }));

  try {
    // Background API call
    const response = await gameApi.allocateStat(stat);
    // Success - sync server state
    syncServerState(response.state);
  } catch (error) {
    // Rollback on error - restore ALL previous state
    useHunterStore.setState({ hunter: previousHunter });
    gameStore.setState({ resourceCaps: previousResourceCaps });
    console.error('Failed to allocate stat:', error);
    useNotificationsStore
      .getState()
      .addNotification(
        'error',
        'Stat Allocation Failed',
        'Failed to allocate stat point. Your stats have been restored.',
        undefined,
        5000
      );
  } finally {
    gameStore.setState((s) => ({ pendingMutations: s.pendingMutations - 1 }));
  }
};
