import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGameStore } from '../store/gameStore';
import type { Resources, Building } from '../store/gameStore';
import { useEffect, useMemo } from 'react';

// Query keys
export const queryKeys = {
  resources: ['resources'] as const,
  buildings: ['buildings'] as const,
  building: (id: string) => ['building', id] as const,
  resourceRate: (resource: keyof Resources) => ['resourceRate', resource] as const,
};

// Public query to get current resources
export const useResourcesQuery = () => {
  const queryClient = useQueryClient();
  const resources = useGameStore((state) => state.resources);

  // Invalidate query when Zustand state changes
  useEffect(() => {
    queryClient.setQueryData(queryKeys.resources, resources);
  }, [resources, queryClient]);

  return useQuery({
    queryKey: queryKeys.resources,
    queryFn: () => resources,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// Public query to get all buildings
export const useBuildingsQuery = () => {
  const queryClient = useQueryClient();
  const buildings = useGameStore((state) => state.buildings);

  useEffect(() => {
    queryClient.setQueryData(queryKeys.buildings, buildings);
  }, [buildings, queryClient]);

  return useQuery({
    queryKey: queryKeys.buildings,
    queryFn: () => buildings,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// Public query to get a specific building
export const useBuildingQuery = (buildingId: string) => {
  const queryClient = useQueryClient();
  const building = useGameStore((state) => state.buildings[buildingId]);

  useEffect(() => {
    queryClient.setQueryData(queryKeys.building(buildingId), building);
  }, [building, buildingId, queryClient]);

  return useQuery({
    queryKey: queryKeys.building(buildingId),
    queryFn: () => building,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// Public query to calculate resource production rate
export const useResourceRateQuery = (resource: keyof Resources) => {
  const queryClient = useQueryClient();
  const buildings = useGameStore((state) => state.buildings);

  const rate = Object.values(buildings).reduce((acc, building: Building) => {
    if (building.produces && building.produces[resource] && building.perSecond) {
      return acc + building.produces[resource]! * building.count * building.perSecond;
    }
    return acc;
  }, 0);

  useEffect(() => {
    queryClient.setQueryData(queryKeys.resourceRate(resource), rate);
  }, [rate, resource, queryClient]);

  return useQuery({
    queryKey: queryKeys.resourceRate(resource),
    queryFn: () => rate,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// Public query to get all resource production rates
export const useAllResourceRatesQuery = () => {
  const queryClient = useQueryClient();
  const buildings = useGameStore((state) => state.buildings);

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

  useEffect(() => {
    queryClient.setQueryData(['allResourceRates'], rates);
  }, [rates, queryClient]);

  return useQuery({
    queryKey: ['allResourceRates'],
    queryFn: () => rates,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};
