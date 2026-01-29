/**
 * Artifact crafting, equipping, and upgrade actions
 * Handles all artifact-related mutations with resource updates
 */

import { gameStore } from '../gameStore';
import { useBuildingsStore } from '../buildingsStore';
import { useResearchStore } from '../researchStore';
import { useHunterStore } from '../hunterStore';
import { useArtifactsStore } from '../artifactsStore';
import type { Artifact, ArtifactRank, ArtifactSlot } from '../types';
import { calculateResourceCaps } from '../../lib/calculations/resourceCalculations';
import { deductCost } from '../../lib/calculations/buildingCalculations';
import { baseResourceCaps } from '../../data/initialHunter';
import { getEffectiveHunterStats } from './hunterActions';

export const craftArtifact = (rank: ArtifactRank, slot: ArtifactSlot) => {
  const resources = gameStore.getState().resources;

  useArtifactsStore.getState().craftArtifact(rank, slot, resources, (cost) => {
    const currentResources = gameStore.getState().resources;
    const newResources = deductCost(currentResources, cost);
    gameStore.setState({ resources: newResources });

    // Grant blacksmith XP based on rank
    const xpGains: Record<ArtifactRank, number> = {
      E: 10,
      D: 25,
      C: 50,
      B: 100,
      A: 200,
      S: 400,
    };
    useArtifactsStore.getState().addBlacksmithXp(xpGains[rank]);
  });
};

export const craftArtifactBulk = (rank: ArtifactRank, slot: ArtifactSlot, quantity: number) => {
  for (let i = 0; i < quantity; i++) {
    craftArtifact(rank, slot);
  }
};

export const equipArtifact = (artifact: Artifact) => {
  useArtifactsStore.getState().equipArtifact(artifact);

  // Recalculate caps after equipping (artifact stats affect caps)
  const buildings = useBuildingsStore.getState().buildings;
  const research = useResearchStore.getState().research;
  const hunter = useHunterStore.getState().hunter;
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
};

export const unequipArtifact = (slot: ArtifactSlot) => {
  useArtifactsStore.getState().unequipArtifact(slot);

  // Recalculate caps after unequipping
  const buildings = useBuildingsStore.getState().buildings;
  const research = useResearchStore.getState().research;
  const hunter = useHunterStore.getState().hunter;
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
};

export const upgradeArtifact = (artifactId: string, upgradeId: string) => {
  const resources = gameStore.getState().resources;

  useArtifactsStore
    .getState()
    .upgradeArtifact(artifactId, upgradeId, resources, (cost, blacksmithXpGain) => {
      const currentResources = gameStore.getState().resources;
      const newResources = deductCost(currentResources, cost);
      gameStore.setState({ resources: newResources });

      // Grant blacksmith XP for upgrading
      useArtifactsStore.getState().addBlacksmithXp(blacksmithXpGain);
    });
};

export const upgradeArtifactBulk = (artifactId: string, upgradeId: string, quantity: number) => {
  for (let i = 0; i < quantity; i++) {
    upgradeArtifact(artifactId, upgradeId);
  }
};

export const destroyArtifact = (artifactId: string) => {
  useArtifactsStore.getState().destroyArtifact(artifactId, (essenceGain) => {
    const currentResources = gameStore.getState().resources;
    const currentCaps = gameStore.getState().resourceCaps;
    gameStore.setState({
      resources: {
        ...currentResources,
        essence: Math.min(currentCaps.essence, currentResources.essence + essenceGain),
      },
    });
  });
};

export const destroyArtifactsUnderRank = (maxRank: ArtifactRank) => {
  useArtifactsStore.getState().destroyArtifactsUnderRank(maxRank, (essenceGain, count) => {
    const currentResources = gameStore.getState().resources;
    const currentCaps = gameStore.getState().resourceCaps;
    gameStore.setState({
      resources: {
        ...currentResources,
        essence: Math.min(currentCaps.essence, currentResources.essence + essenceGain),
      },
    });
    console.log(`✅ Destroyed ${count} artifacts for ${essenceGain} essence`);
  });
};
