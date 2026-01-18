import { useStore } from '@ts-query/react';
import { gameStore, useBuildingsStore, useResearchStore, useHunterStore, useArtifactsStore, getEffectiveHunterStats } from '../store/gameStore';
import type { Resources, Building } from '../store/gameStore';
import { useMemo } from 'react';
import {
  calculateGlobalProductionMultiplier,
  calculateBuildingEfficiency,
  calculateBuildingSynergy
} from '../lib/calculations/resourceCalculations';

// Simplified hooks that directly use the substores
export const useHunterQuery = () => {
  const hunter = useStore(useHunterStore, (state) => state.hunter);
  return { data: hunter };
};

export const useResourcesQuery = () => {
  const resources = useStore(gameStore, (state) => state.resources);
  return { data: resources };
};

export const useResourceCapsQuery = () => {
  const resourceCaps = useStore(gameStore, (state) => state.resourceCaps);
  return { data: resourceCaps };
};

export const useBuildingsQuery = () => {
  const buildings = useStore(useBuildingsStore, (state) => state.buildings);
  return { data: buildings };
};

export const useBuildingQuery = (buildingId: string) => {
  const building = useStore(useBuildingsStore, (state) => state.buildings[buildingId]);
  return { data: building };
};

export const useResourceRateQuery = (resource: keyof Resources) => {
  const buildings = useStore(useBuildingsStore, (state) => state.buildings);

  const rate = useMemo(() => {
    return Object.values(buildings).reduce((acc, building: Building) => {
      if (building.produces && building.produces[resource] && building.perSecond) {
        return acc + building.produces[resource]! * building.count * building.perSecond;
      }
      return acc;
    }, 0);
  }, [buildings, resource]);

  return { data: rate };
};

export const useAllResourceRatesQuery = () => {
  const buildings = useStore(useBuildingsStore, (state) => state.buildings);
  const research = useStore(useResearchStore, (state) => state.research);
  const resources = useStore(gameStore, (state) => state.resources);
  const hunter = useStore(useHunterStore, (state) => state.hunter);
  // Subscribe to artifacts to re-calculate when artifacts change
  const equipped = useStore(useArtifactsStore, (state) => state.equipped);

  const rates = useMemo(() => {
    const result: Record<keyof Resources, number> = {
      essence: 0,
      crystals: 0,
      gold: 0,
      souls: 0,
      attraction: 0,
      gems: 0,
      knowledge: 0,
    };

    // Calculate global multiplier
    const globalMultiplier = calculateGlobalProductionMultiplier(research, resources, hunter.level);

    // Get effective stats (base stats + artifact bonuses)
    const effectiveStats = getEffectiveHunterStats();

    Object.values(buildings).forEach((building: Building) => {
      if (building.produces && building.perSecond) {
        Object.entries(building.produces).forEach(([resource, amount]) => {
          if (amount) {
            let production = amount * building.count * building.perSecond!;

            // Apply building efficiency bonuses from research
            production *= calculateBuildingEfficiency(building.id, research);

            // Apply synergy bonuses
            production *= calculateBuildingSynergy(building.id, buildings, research);

            // Apply global multiplier
            production *= globalMultiplier;

            // Apply hunter stat bonuses (Sung Jinwoo as force multiplier)
            // Each stat point gives +0.5% to its associated resource production
            // Use effective stats (base + artifacts) to match tick calculation
            if (resource === 'essence') {
              production *= (1 + effectiveStats.strength / 200);
            } else if (resource === 'crystals') {
              production *= (1 + effectiveStats.sense / 200);
            } else if (resource === 'gold') {
              production *= (1 + effectiveStats.agility / 200);
            } else if (resource === 'souls') {
              production *= (1 + effectiveStats.vitality / 200);
            } else if (resource === 'knowledge') {
              production *= (1 + effectiveStats.intelligence / 200);
            } else {
              // Attraction and gems scale with average of all stats
              const avgStat = (effectiveStats.strength + effectiveStats.agility + effectiveStats.intelligence + effectiveStats.vitality + effectiveStats.sense) / 5;
              production *= (1 + avgStat / 200);
            }

            result[resource as keyof Resources] += production;
          }
        });
      }
    });

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, research, resources, hunter, equipped]);
  // Note: equipped is needed because getEffectiveHunterStats() reads from artifacts store

  return { data: rates };
};

export const useResearchQuery = () => {
  const research = useStore(useResearchStore, (state) => state.research);
  return { data: research };
};

export const useXpRateQuery = () => {
  const buildings = useStore(useBuildingsStore, (state) => state.buildings);

  const xpRate = useMemo(() => {
    return Object.values(buildings).reduce((acc, building: Building) => {
      if (building.xpPerSecond && building.count > 0) {
        return acc + building.xpPerSecond * building.count;
      }
      return acc;
    }, 0);
  }, [buildings]);

  return { data: xpRate };
};
