/**
 * Research purchase actions
 * Handles purchasing research with optimistic updates
 */

import { gameStore, createResources } from '../gameStore';
import { useBuildingsStore } from '../buildingsStore';
import { useResearchStore } from '../researchStore';
import { useHunterStore } from '../hunterStore';
import { useNotificationsStore } from '../notificationsStore';
import { calculateResourceCaps } from '../../lib/calculations/resourceCalculations';
import { baseResourceCaps } from '../../data/initialHunter';
import * as gameApi from '../../api/gameApi';
import { syncServerState } from './syncActions';
import { getEffectiveHunterStats } from './hunterActions';

export const purchaseResearch = async (researchId: string) => {
  const buildings = useBuildingsStore.getState().buildings;
  const hunter = useHunterStore.getState().hunter;
  const effectiveStats = getEffectiveHunterStats();

  // Store previous state for rollback
  const previousResources = gameStore.getState().resources;
  const previousResourceCaps = gameStore.getState().resourceCaps;
  const previousResearch = useResearchStore.getState().research;

  // Optimistic update
  useResearchStore.getState().purchaseResearch(
    researchId,
    () => gameStore.getState().resources.knowledge,
    (cost, newResearch) => {
      const currentResources = gameStore.getState().resources;

      gameStore.setState({
        resources: createResources({
          ...currentResources,
          knowledge: currentResources.knowledge - cost,
        }),
        resourceCaps: calculateResourceCaps(
          baseResourceCaps,
          buildings,
          newResearch,
          hunter.level,
          effectiveStats
        ),
      });
    }
  );

  // Check if the purchase actually happened (researchStore validates prereqs/knowledge)
  const currentResearch = useResearchStore.getState().research;
  if (currentResearch === previousResearch) {
    // No change - validation failed (already researched, missing prereqs, or insufficient knowledge)
    return;
  }

  // Track pending mutation
  gameStore.setState((s) => ({ pendingMutations: s.pendingMutations + 1 }));

  try {
    // Background API call
    const response = await gameApi.purchaseResearch(researchId);
    // Success - sync server state
    syncServerState(response.state);
  } catch (error) {
    // Rollback on error - restore ALL previous state
    gameStore.setState({
      resources: previousResources,
      resourceCaps: previousResourceCaps,
    });
    useResearchStore.setState({ research: previousResearch });
    console.error('Failed to purchase research:', error);
    useNotificationsStore
      .getState()
      .addNotification(
        'error',
        'Research Failed',
        'Failed to purchase research. Your resources have been restored.',
        undefined,
        5000
      );
  } finally {
    gameStore.setState((s) => ({ pendingMutations: s.pendingMutations - 1 }));
  }
};
