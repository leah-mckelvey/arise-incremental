import { useQuery } from '@tanstack/react-query';
import { useGameStore } from '../store/gameStore';
import type { Resources, Building } from '../store/gameStore';

// Query keys
export const queryKeys = {
  resources: ['resources'] as const,
  buildings: ['buildings'] as const,
  building: (id: string) => ['building', id] as const,
  resourceRate: (resource: keyof Resources) => ['resourceRate', resource] as const,
};

// Public query to get current resources
export const useResourcesQuery = () => {
  const resources = useGameStore((state) => state.resources);

  return useQuery({
    queryKey: queryKeys.resources,
    queryFn: () => resources,
    staleTime: 0, // Always fresh
    refetchInterval: 100, // Refetch every 100ms for smooth updates
  });
};

// Public query to get all buildings
export const useBuildingsQuery = () => {
  const buildings = useGameStore((state) => state.buildings);

  return useQuery({
    queryKey: queryKeys.buildings,
    queryFn: () => buildings,
    staleTime: 0,
    refetchInterval: 100,
  });
};

// Public query to get a specific building
export const useBuildingQuery = (buildingId: string) => {
  const building = useGameStore((state) => state.buildings[buildingId]);

  return useQuery({
    queryKey: queryKeys.building(buildingId),
    queryFn: () => building,
    staleTime: 0,
    refetchInterval: 100,
  });
};

// Public query to calculate resource production rate
export const useResourceRateQuery = (resource: keyof Resources) => {
  const buildings = useGameStore((state) => state.buildings);

  return useQuery({
    queryKey: queryKeys.resourceRate(resource),
    queryFn: () => {
      let rate = 0;
      Object.values(buildings).forEach((building: Building) => {
        if (building.produces && building.produces[resource] && building.perSecond) {
          rate += building.produces[resource]! * building.count * building.perSecond;
        }
      });
      return rate;
    },
    staleTime: 0,
    refetchInterval: 100,
  });
};

// Public query to get all resource production rates
export const useAllResourceRatesQuery = () => {
  const buildings = useGameStore((state) => state.buildings);

  return useQuery({
    queryKey: ['allResourceRates'],
    queryFn: () => {
      const rates: Record<keyof Resources, number> = {
        catnip: 0,
        wood: 0,
        minerals: 0,
        science: 0,
      };

      Object.values(buildings).forEach((building: Building) => {
        if (building.produces && building.perSecond) {
          Object.entries(building.produces).forEach(([resource, amount]) => {
            if (amount) {
              rates[resource as keyof Resources] +=
                amount * building.count * building.perSecond!;
            }
          });
        }
      });

      return rates;
    },
    staleTime: 0,
    refetchInterval: 100,
  });
};
