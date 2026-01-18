import { useState } from 'react';
import { useBuildingsQuery, useResourcesQuery, useResearchQuery, useHunterQuery } from '../queries/gameQueries';
import { getBuildingCost, canAffordBuilding, purchaseBuilding, purchaseBuildingBulk, getEffectiveHunterStats } from '../store/gameStore';
import type { Resources, Building } from '../store/gameStore';
import { calculateBulkBuildingCost, calculateMaxBuildingPurchases, calculateBuildingEfficiency, calculateBuildingSynergy, calculateGlobalProductionMultiplier } from '../lib/calculations/resourceCalculations';
import { Box, Heading, Button, Text, Stack } from '@ts-query/ui-react';
import { OwnedBadge } from './OwnedBadge';

export const BuildingList = () => {
  const { data: buildings } = useBuildingsQuery();
  const { data: resources } = useResourcesQuery();
  const { data: research } = useResearchQuery();
  const { data: hunter } = useHunterQuery();
  const [bulkAmount, setBulkAmount] = useState<1 | 5 | 10 | 100 | 'max'>(1);

  if (!buildings || !resources || !research || !hunter) return null;

  const effectiveStats = getEffectiveHunterStats();
  const globalMultiplier = calculateGlobalProductionMultiplier(research, resources, hunter.level);

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
    if (cost.knowledge > 0) parts.push(`📚 ${formatNumber(cost.knowledge)}`);
    return parts.join(' ');
  };

  const renderProduction = (building: Building) => {
    const parts = [];

    // Calculate actual production with all bonuses
    const efficiency = calculateBuildingEfficiency(building.id, research);
    const synergy = calculateBuildingSynergy(building.id, buildings, research);

    // Resource production
    if (building.produces && building.perSecond && building.count > 0) {
      Object.entries(building.produces).forEach(([resource, baseAmount]) => {
        if (baseAmount) {
          let production = baseAmount * building.perSecond * building.count;

          // Apply all bonuses
          production *= efficiency;
          production *= synergy;
          production *= globalMultiplier;

          // Apply hunter stat bonuses
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
            const avgStat = (effectiveStats.strength + effectiveStats.agility + effectiveStats.intelligence + effectiveStats.vitality + effectiveStats.sense) / 5;
            production *= (1 + avgStat / 200);
          }

          const icon = resource === 'essence' ? '🔮' : resource === 'crystals' ? '💎' : resource === 'gold' ? '💰' : resource === 'souls' ? '👻' : resource === 'attraction' ? '⭐' : resource === 'knowledge' ? '📚' : '💠';
          parts.push(`${icon} +${production.toFixed(2)}/s`);
        }
      });
    }

    // XP production
    if (building.xpPerSecond && building.count > 0) {
      const totalXpPerSecond = building.xpPerSecond * building.count;
      parts.push(`⭐ +${totalXpPerSecond.toFixed(2)}/s XP`);
    }

    // Cap increases
    if (building.increasesCaps) {
      if (building.increasesCaps.essence) parts.push(`🔮 Cap +${building.increasesCaps.essence}`);
      if (building.increasesCaps.crystals) parts.push(`💎 Cap +${building.increasesCaps.crystals}`);
      if (building.increasesCaps.gold) parts.push(`💰 Cap +${building.increasesCaps.gold}`);
      if (building.increasesCaps.souls) parts.push(`👻 Cap +${building.increasesCaps.souls}`);
      if (building.increasesCaps.attraction) parts.push(`⭐ Cap +${building.increasesCaps.attraction}`);
      if (building.increasesCaps.gems) parts.push(`💠 Cap +${building.increasesCaps.gems}`);
      if (building.increasesCaps.knowledge) parts.push(`📚 Cap +${building.increasesCaps.knowledge}`);
    }

    return parts.length > 0 ? parts.join(', ') : null;
  };

  const handlePurchase = (building: Building) => {
    if (bulkAmount === 1) {
      purchaseBuilding(building.id);
    } else if (bulkAmount === 'max') {
      const maxQty = calculateMaxBuildingPurchases(building, resources);
      if (maxQty > 0) {
        purchaseBuildingBulk(building.id, maxQty);
      }
    } else {
      purchaseBuildingBulk(building.id, bulkAmount);
    }
  };

  const getBulkCost = (building: Building): Resources => {
    if (bulkAmount === 1) {
      return getBuildingCost(building);
    } else if (bulkAmount === 'max') {
      const maxQty = calculateMaxBuildingPurchases(building, resources);
      return calculateBulkBuildingCost(building, maxQty);
    } else {
      return calculateBulkBuildingCost(building, bulkAmount);
    }
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
      <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <Heading level={3} style={{ color: 'var(--accent-teal)' }}>
          🏗️ Buildings
        </Heading>
        <Box style={{ display: 'flex', gap: '8px' }}>
          {([1, 5, 10, 100, 'max'] as const).map((amount) => (
            <Button
              key={amount}
              onClick={() => setBulkAmount(amount)}
              size="sm"
              style={{
                background: bulkAmount === amount ? 'var(--accent-teal)' : 'var(--bg-tertiary)',
                color: bulkAmount === amount ? '#000' : 'var(--text-secondary)',
                border: `1px solid ${bulkAmount === amount ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                fontWeight: 'bold',
                minWidth: '50px',
              }}
            >
              {amount === 'max' ? 'MAX' : `x${amount}`}
            </Button>
          ))}
        </Box>
      </Box>
      <Stack gap={2.5}>
        {Object.values(buildings)
          .filter((building) => isBuildingUnlocked(building.id))
          .map((building) => {
            const cost = getBulkCost(building);
            const canAfford = canAffordBuilding(resources, cost);
            const quantity = bulkAmount === 'max' ? calculateMaxBuildingPurchases(building, resources) : bulkAmount;

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
                  onClick={() => handlePurchase(building)}
                  disabled={!canAfford || quantity === 0}
                  size="sm"
                  style={{
                    background: canAfford ? 'var(--accent-teal)' : 'var(--bg-tertiary)',
                    color: canAfford ? '#000' : 'var(--text-dim)',
                    border: canAfford ? '1px solid var(--accent-teal)' : '1px solid var(--border-color)',
                    fontWeight: 'bold',
                  }}
                >
                  {bulkAmount === 1 ? 'Build' : `Build x${quantity}`}
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
