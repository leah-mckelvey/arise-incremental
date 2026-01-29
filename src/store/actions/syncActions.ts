/**
 * Server state synchronization actions
 * Handles syncing local state with server responses after mutations
 */

import { gameStore } from '../gameStore';
import { useBuildingsStore } from '../buildingsStore';
import { useResearchStore } from '../researchStore';
import { useHunterStore } from '../hunterStore';
import { useArtifactsStore } from '../artifactsStore';
import { useDungeonsStore } from '../dungeonsStore';
import { useAlliesStore } from '../alliesStore';
import { useShadowsStore } from '../shadowsStore';
import type { GameStateDTO } from '../../../shared/types';

/**
 * Helper to sync server state after a successful mutation
 * Handles partial updates - only syncs fields that are present in serverState
 */
export const syncServerState = (serverState: Partial<GameStateDTO>) => {
  console.log('🔄 syncServerState called with:', {
    hasResources: !!serverState.resources,
    hasResourceCaps: !!serverState.resourceCaps,
    essenceCap: serverState.resourceCaps?.essence,
    hasBuildings: !!serverState.buildings,
  });

  // Update gameStore if resources or resourceCaps are present
  if (serverState.resources || serverState.resourceCaps || serverState.lastUpdate) {
    gameStore.setState({
      ...(serverState.resources && { resources: serverState.resources }),
      ...(serverState.resourceCaps && {
        resourceCaps: serverState.resourceCaps,
      }),
      ...(serverState.lastUpdate && { lastUpdate: serverState.lastUpdate }),
      lastServerSync: Date.now(),
    });
  }

  // Only update stores if the data is present
  if (serverState.hunter) {
    useHunterStore.setState({ hunter: serverState.hunter });
  }
  if (serverState.buildings) {
    useBuildingsStore.setState({ buildings: serverState.buildings });
  }
  if (serverState.research) {
    useResearchStore.setState({ research: serverState.research });
  }
  if (serverState.artifacts) {
    useArtifactsStore.setState({
      equipped: serverState.artifacts.equipped,
      inventory: serverState.artifacts.inventory,
      blacksmithLevel: serverState.artifacts.blacksmithLevel,
      blacksmithXp: serverState.artifacts.blacksmithXp,
    });
  }
  if (serverState.dungeons || serverState.activeDungeons) {
    useDungeonsStore.setState({
      ...(serverState.dungeons && { dungeons: serverState.dungeons }),
      ...(serverState.activeDungeons && {
        activeDungeons: serverState.activeDungeons,
      }),
    });
  }
  if (serverState.allies) {
    useAlliesStore.setState({ allies: serverState.allies });
  }
  if (serverState.shadows) {
    useShadowsStore.setState({ shadows: serverState.shadows });
  }
};
