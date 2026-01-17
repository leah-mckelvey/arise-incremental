import { useBuildingsQuery, useResourcesQuery } from '../queries/gameQueries';
import { gameStore, getBuildingCost, canAffordBuilding } from '../store/gameStore';
import type { Resources, Building } from '../store/gameStore';
import { Box, Heading, Button, Text, Stack } from '@ts-query/ui-react';

export const BuildingList = () => {
  const { data: buildings } = useBuildingsQuery();
  const { data: resources } = useResourcesQuery();
  // Get the purchaseBuilding function directly from the store
  const purchaseBuilding = gameStore.getState().purchaseBuilding;

  if (!buildings || !resources) return null;

  const formatNumber = (num: number) => {
    return Math.floor(num).toLocaleString();
  };

  const renderCost = (cost: Resources) => {
    const parts = [];
    if (cost.catnip > 0) parts.push(`🌾 ${formatNumber(cost.catnip)}`);
    if (cost.wood > 0) parts.push(`🪵 ${formatNumber(cost.wood)}`);
    if (cost.minerals > 0) parts.push(`⛰️ ${formatNumber(cost.minerals)}`);
    if (cost.science > 0) parts.push(`🔬 ${formatNumber(cost.science)}`);
    return parts.join(' ');
  };

  const renderProduction = (building: Building) => {
    if (!building.produces || !building.perSecond) return null;
    const parts = [];
    if (building.produces.catnip) parts.push(`🌾 +${building.produces.catnip * building.perSecond}/s`);
    if (building.produces.wood) parts.push(`🪵 +${building.produces.wood * building.perSecond}/s`);
    if (building.produces.minerals) parts.push(`⛰️ +${building.produces.minerals * building.perSecond}/s`);
    if (building.produces.science) parts.push(`🔬 +${building.produces.science * building.perSecond}/s`);
    return parts.length > 0 ? `Produces: ${parts.join(', ')}` : null;
  };

  return (
    <Box
      bg="#f0e8d8"
      p={5}
      rounded="8px"
      style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
    >
      <Heading level={3} style={{ marginBottom: '15px', color: '#5a4a3a' }}>
        Buildings
      </Heading>
      <Stack gap={2.5}>
        {Object.values(buildings).map((building) => {
          const cost = getBuildingCost(building);
          const canAfford = canAffordBuilding(resources, building);

          return (
            <Box
              key={building.id}
              bg="#fff"
              p={3.75}
              rounded="4px"
              style={{ border: canAfford ? '2px solid #4a9d5f' : '2px solid #ccc' }}
            >
              <Box
                mb={2}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Text fontSize="18px" fontWeight="bold">{building.name}</Text>
                  <Text as="span" style={{ marginLeft: '10px', color: '#666' }}>
                    (Owned: {building.count})
                  </Text>
                </Box>
                <Button
                  onClick={() => purchaseBuilding(building.id)}
                  disabled={!canAfford}
                  colorScheme={canAfford ? 'green' : 'gray'}
                  size="sm"
                >
                  Build
                </Button>
              </Box>
              <Box style={{ fontSize: '14px', color: '#666' }}>
                <Text>Cost: {renderCost(cost)}</Text>
                {renderProduction(building) && (
                  <Text style={{ color: '#4a9d5f', marginTop: '4px' }}>
                    {renderProduction(building)}
                  </Text>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};
