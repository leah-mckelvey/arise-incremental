import { useStore } from '@ts-query/react';
import { gameStore } from '../store/gameStore';
import type { Resources, Building } from '../store/gameStore';
import { useMemo } from 'react';

// Simplified hooks that directly use the store
export const useResourcesQuery = () => {
  const resources = useStore(gameStore, (state) => state.resources);
  return { data: resources };
};

export const useBuildingsQuery = () => {
  const buildings = useStore(gameStore, (state) => state.buildings);
  return { data: buildings };
};

export const useBuildingQuery = (buildingId: string) => {
  const building = useStore(gameStore, (state) => state.buildings[buildingId]);
  return { data: building };
};

export const useResourceRateQuery = (resource: keyof Resources) => {
  const buildings = useStore(gameStore, (state) => state.buildings);

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
  const buildings = useStore(gameStore, (state) => state.buildings);

  const rates = useMemo(() => {
    const result: Record<keyof Resources, number> = {
      catnip: 0,
      wood: 0,
      minerals: 0,
      science: 0,
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
