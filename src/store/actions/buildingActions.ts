/**
 * Building purchase actions
 * Handles purchasing individual and bulk buildings with optimistic updates
 */

import { gameStore } from '../gameStore';
import { useBuildingsStore } from '../buildingsStore';
import { useResearchStore } from '../researchStore';
import { useHunterStore } from '../hunterStore';
import { useNotificationsStore } from '../notificationsStore';
import { calculateResourceCaps } from '../../lib/calculations/resourceCalculations';
import { deductCost } from '../../lib/calculations/buildingCalculations';
import { baseResourceCaps } from '../../data/initialHunter';
import * as gameApi from '../../api/gameApi';
import { syncServerState } from './syncActions';
import { getEffectiveHunterStats } from './hunterActions';

export const purchaseBuilding = async (buildingId: string) => {
  const research = useResearchStore.getState().research;
  const hunter = useHunterStore.getState().hunter;
  const effectiveStats = getEffectiveHunterStats();

  // Store previous state for rollback
  const previousResources = gameStore.getState().resources;
  const previousResourceCaps = gameStore.getState().resourceCaps;
  const previousBuildings = useBuildingsStore.getState().buildings;

  // Optimistic update
  useBuildingsStore.getState().purchaseBuilding(
    buildingId,
    () => gameStore.getState().resources,
    (cost, newBuildings) => {
      const currentResources = gameStore.getState().resources;
      const newResources = deductCost(currentResources, cost);

      gameStore.setState({
        resources: newResources,
        resourceCaps: calculateResourceCaps(
          baseResourceCaps,
          newBuildings,
          research,
          hunter.level,
          effectiveStats
        ),
      });
    }
  );

  // Check if the purchase actually happened (buildingsStore validates resources)
  const currentBuildings = useBuildingsStore.getState().buildings;
  if (currentBuildings === previousBuildings) {
    // No change - validation failed (insufficient resources or invalid building)
    return;
  }

  // Track pending mutation
  gameStore.setState((s) => ({ pendingMutations: s.pendingMutations + 1 }));

  try {
    // Background API call
    const response = await gameApi.purchaseBuilding(buildingId);
    // Success - sync server state
    syncServerState(response.state);
  } catch (error) {
    // Rollback on error - restore ALL previous state
    gameStore.setState({
      resources: previousResources,
      resourceCaps: previousResourceCaps,
    });
    useBuildingsStore.setState({ buildings: previousBuildings });
    console.error('Failed to purchase building:', error);
    useNotificationsStore
      .getState()
      .addNotification(
        'error',
        'Purchase Failed',
        'Failed to purchase building. Your resources have been restored.',
        undefined,
        5000
      );
  } finally {
    gameStore.setState((s) => ({ pendingMutations: s.pendingMutations - 1 }));
  }
};

export const purchaseBuildingBulk = async (buildingId: string, quantity: number) => {
  const research = useResearchStore.getState().research;
  const hunter = useHunterStore.getState().hunter;
  const effectiveStats = getEffectiveHunterStats();

  // Store previous state for rollback
  const previousResources = gameStore.getState().resources;
  const previousResourceCaps = gameStore.getState().resourceCaps;
  const previousBuildings = useBuildingsStore.getState().buildings;

  // Optimistic update
  useBuildingsStore.getState().purchaseBuildingBulk(
    buildingId,
    quantity,
    () => gameStore.getState().resources,
    (cost, newBuildings) => {
      const currentResources = gameStore.getState().resources;
      const newResources = deductCost(currentResources, cost);

      gameStore.setState({
        resources: newResources,
        resourceCaps: calculateResourceCaps(
          baseResourceCaps,
          newBuildings,
          research,
          hunter.level,
          effectiveStats
        ),
      });
    }
  );

  // Track pending mutation
  gameStore.setState((s) => ({ pendingMutations: s.pendingMutations + 1 }));

  try {
    // Background API call
    const response = await gameApi.purchaseBulkBuilding(buildingId, quantity);
    // Success - sync server state
    syncServerState(response.state);
  } catch (error) {
    // Rollback on error - restore ALL previous state
    gameStore.setState({
      resources: previousResources,
      resourceCaps: previousResourceCaps,
    });
    useBuildingsStore.setState({ buildings: previousBuildings });
    console.error('Failed to purchase buildings:', error);
    useNotificationsStore
      .getState()
      .addNotification(
        'error',
        'Bulk Purchase Failed',
        'Failed to purchase buildings. Your resources have been restored.',
        undefined,
        5000
      );
  } finally {
    gameStore.setState((s) => ({ pendingMutations: s.pendingMutations - 1 }));
  }
};
