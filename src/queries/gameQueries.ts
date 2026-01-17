import { useStore } from '@ts-query/react';
import { gameStore, useBuildingsStore, useResearchStore, useHunterStore } from '../store/gameStore';
import type { Resources, Building } from '../store/gameStore';
import { useMemo } from 'react';

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

    Object.values(buildings).forEach((building: Building) => {
      if (building.produces && building.perSecond) {
        Object.entries(building.produces).forEach(([resource, amount]) => {
          if (amount) {
            result[resource as keyof Resources] +=
              amount * building.count * building.perSecond!;
          }
        });
      }
    });

    return result;
  }, [buildings]);

  return { data: rates };
};

export const useResearchQuery = () => {
  const research = useStore(useResearchStore, (state) => state.research);
  return { data: research };
};
