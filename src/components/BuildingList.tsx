import { useBuildingsQuery, useResourcesQuery, useResearchQuery } from '../queries/gameQueries';
import { getBuildingCost, canAffordBuilding, purchaseBuilding } from '../store/gameStore';
import type { Resources, Building } from '../store/gameStore';
import { Box, Heading, Button, Text, Stack } from '@ts-query/ui-react';
import { OwnedBadge } from './OwnedBadge';

export const BuildingList = () => {
  const { data: buildings } = useBuildingsQuery();
  const { data: resources } = useResourcesQuery();
  const { data: research } = useResearchQuery();

  if (!buildings || !resources || !research) return null;

  // Check if a building is unlocked
  const isBuildingUnlocked = (buildingId: string): boolean => {
    // Find research that unlocks this building
    const unlockingResearch = Object.values(research).find(
      (tech) => tech.unlocks?.includes(buildingId)
    );

    // If no research unlocks it, it's available by default
    if (!unlockingResearch) return true;

    // Otherwise, check if the research is completed
    return unlockingResearch.researched;
  };

  const formatNumber = (num: number) => {
    return Math.floor(num).toLocaleString();
  };

  const renderCost = (cost: Resources) => {
    const parts = [];
    if (cost.essence > 0) parts.push(`🔮 ${formatNumber(cost.essence)}`);
    if (cost.crystals > 0) parts.push(`💎 ${formatNumber(cost.crystals)}`);
    if (cost.gold > 0) parts.push(`💰 ${formatNumber(cost.gold)}`);
    if (cost.souls > 0) parts.push(`👻 ${formatNumber(cost.souls)}`);
    if (cost.attraction > 0) parts.push(`⭐ ${formatNumber(cost.attraction)}`);
    if (cost.gems > 0) parts.push(`💠 ${formatNumber(cost.gems)}`);
    return parts.join(' ');
  };

  const renderProduction = (building: Building) => {
    const parts = [];

    // Resource production
    if (building.produces && building.perSecond) {
      if (building.produces.essence) parts.push(`🔮 +${building.produces.essence * building.perSecond}/s`);
      if (building.produces.crystals) parts.push(`💎 +${building.produces.crystals * building.perSecond}/s`);
      if (building.produces.gold) parts.push(`💰 +${building.produces.gold * building.perSecond}/s`);
      if (building.produces.souls) parts.push(`👻 +${building.produces.souls * building.perSecond}/s`);
      if (building.produces.attraction) parts.push(`⭐ +${building.produces.attraction * building.perSecond}/s`);
      if (building.produces.gems) parts.push(`💠 +${building.produces.gems * building.perSecond}/s`);
    }

    // XP production
    if (building.xpPerSecond) {
      parts.push(`⭐ +${building.xpPerSecond} XP/s`);
    }

    // Cap increases
    if (building.increasesCaps) {
      if (building.increasesCaps.essence) parts.push(`🔮 Cap +${building.increasesCaps.essence}`);
      if (building.increasesCaps.crystals) parts.push(`💎 Cap +${building.increasesCaps.crystals}`);
      if (building.increasesCaps.gold) parts.push(`💰 Cap +${building.increasesCaps.gold}`);
      if (building.increasesCaps.souls) parts.push(`👻 Cap +${building.increasesCaps.souls}`);
      if (building.increasesCaps.attraction) parts.push(`⭐ Cap +${building.increasesCaps.attraction}`);
      if (building.increasesCaps.gems) parts.push(`💠 Cap +${building.increasesCaps.gems}`);
    }

    return parts.length > 0 ? parts.join(', ') : null;
  };

  return (
    <Box
      bg="var(--bg-secondary)"
      p={5}
      rounded="8px"
      style={{
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 217, 255, 0.1)',
        border: '1px solid var(--border-color)',
      }}
    >
      <Heading level={3} style={{ marginBottom: '15px', color: 'var(--accent-teal)' }}>
        🏗️ Buildings
      </Heading>
      <Stack gap={2.5}>
        {Object.values(buildings)
          .filter((building) => isBuildingUnlocked(building.id))
          .map((building) => {
            const cost = getBuildingCost(building);
            const canAfford = canAffordBuilding(resources, cost);

            return (
            <Box
              key={building.id}
              bg="var(--bg-tertiary)"
              p={3.75}
              rounded="4px"
              style={{
                border: canAfford
                  ? '2px solid var(--accent-teal)'
                  : '2px solid var(--border-color)',
                boxShadow: canAfford
                  ? '0 0 15px var(--border-glow)'
                  : 'none',
              }}
            >
              <Box
                mb={2}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Text
                    fontSize="18px"
                    fontWeight="bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {building.name}
                  </Text>
                  <OwnedBadge count={building.count} />
                </Box>
                <Button
                  onClick={() => purchaseBuilding(building.id)}
                  disabled={!canAfford}
                  size="sm"
                  style={{
                    background: canAfford ? 'var(--accent-teal)' : 'var(--bg-tertiary)',
                    color: canAfford ? '#000' : 'var(--text-dim)',
                    border: canAfford ? '1px solid var(--accent-teal)' : '1px solid var(--border-color)',
                    fontWeight: 'bold',
                  }}
                >
                  Build
                </Button>
              </Box>
              <Box style={{ fontSize: '14px' }}>
                {building.description && (
                  <Text style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontStyle: 'italic' }}>
                    {building.description}
                  </Text>
                )}
                <Text style={{ color: 'var(--text-secondary)' }}>
                  Cost: {renderCost(cost)}
                </Text>
                {renderProduction(building) && (
                  <Text style={{ color: 'var(--accent-teal)', marginTop: '4px' }}>
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
