import { useState } from 'react';
import { useStore } from '@ts-query/react';
import { useResourcesQuery, useAllResourceRatesQuery, useResourceCapsQuery, useBuildingsQuery, useResearchQuery, useHunterQuery } from '../queries/gameQueries';
import { Box, Heading, Text, Stack } from '@ts-query/ui-react';
import type { Resources } from '../store/gameStore';
import { getEffectiveHunterStats, useArtifactsStore } from '../store/gameStore';
import { calculateBuildingEfficiency, calculateBuildingSynergy, calculateGlobalProductionMultiplier } from '../lib/calculations/resourceCalculations';

export const ResourceDisplay = () => {
  const { data: resources } = useResourcesQuery();
  const { data: caps } = useResourceCapsQuery();
  const { data: rates } = useAllResourceRatesQuery();
  const { data: buildings } = useBuildingsQuery();
  const { data: research } = useResearchQuery();
  const { data: hunter } = useHunterQuery();
  // Subscribe to artifacts store to re-render when artifacts change
  useStore(useArtifactsStore, (state) => state.equipped);
  const [expandedResource, setExpandedResource] = useState<keyof Resources | null>(null);

  if (!resources || !caps || !rates || !buildings || !research || !hunter) return null;

  // effectiveStats will now update when artifacts change because we're subscribed to artifacts store
  const effectiveStats = getEffectiveHunterStats();
  const globalMultiplier = calculateGlobalProductionMultiplier(research, resources, hunter.level);

  const formatNumber = (num: number) => {
    return Math.floor(num).toLocaleString();
  };

  const formatRate = (rate: number) => {
    return rate > 0 ? `+${rate.toFixed(2)}/s` : '';
  };

  // Get color based on how close to cap (like Kittens Game)
  const getCapColor = (current: number, max: number): string => {
    const percentage = (current / max) * 100;
    if (percentage >= 95) return '#ff4444'; // Red when almost full
    if (percentage >= 75) return '#ffaa00'; // Orange when getting full
    return 'var(--text-primary)'; // Normal color
  };

  // Calculate detailed breakdown for a resource
  const getResourceBreakdown = (resourceKey: keyof Resources) => {
    const breakdown: Array<{ source: string; amount: number; details?: string }> = [];

    Object.values(buildings).forEach((building) => {
      if (building.produces && building.produces[resourceKey] && building.count > 0) {
        const baseAmount = building.produces[resourceKey]!;
        const perSecond = building.perSecond || 0;
        let production = baseAmount * perSecond * building.count;

        const efficiency = calculateBuildingEfficiency(building.id, research);
        const synergy = calculateBuildingSynergy(building.id, buildings, research);

        // Apply bonuses
        const beforeBonuses = production;
        production *= efficiency;
        production *= synergy;
        production *= globalMultiplier;

        // Apply hunter stat bonuses
        if (resourceKey === 'essence') {
          production *= (1 + effectiveStats.strength / 200);
        } else if (resourceKey === 'crystals') {
          production *= (1 + effectiveStats.sense / 200);
        } else if (resourceKey === 'gold') {
          production *= (1 + effectiveStats.agility / 200);
        } else if (resourceKey === 'souls') {
          production *= (1 + effectiveStats.vitality / 200);
        } else if (resourceKey === 'knowledge') {
          production *= (1 + effectiveStats.intelligence / 200);
        } else {
          const avgStat = (effectiveStats.strength + effectiveStats.agility + effectiveStats.intelligence + effectiveStats.vitality + effectiveStats.sense) / 5;
          production *= (1 + avgStat / 200);
        }

        const bonusMultiplier = production / beforeBonuses;
        const details = bonusMultiplier > 1.01 ? `(×${bonusMultiplier.toFixed(2)} from bonuses)` : '';

        breakdown.push({
          source: `${building.name} (${building.count})`,
          amount: production,
          details,
        });
      }
    });

    return breakdown;
  };

  const resourceList: Array<{
    key: keyof Resources;
    icon: string;
    name: string;
  }> = [
    { key: 'essence', icon: '🔮', name: 'Essence' },
    { key: 'crystals', icon: '💎', name: 'Crystals' },
    { key: 'gold', icon: '💰', name: 'Gold' },
    { key: 'souls', icon: '👻', name: 'Souls' },
    { key: 'attraction', icon: '⭐', name: 'Attraction' },
    { key: 'gems', icon: '💠', name: 'Gems' },
    { key: 'knowledge', icon: '📚', name: 'Knowledge' },
  ];

  return (
    <Box
      bg="var(--bg-secondary)"
      p={4}
      rounded="8px"
      style={{
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 217, 255, 0.1)',
        border: '1px solid var(--border-color)',
        minWidth: '220px',
        maxWidth: '280px',
      }}
    >
      <Heading level={4} style={{ marginBottom: '12px', color: 'var(--accent-teal)', fontSize: '16px' }}>
        💎 Resources
      </Heading>
      <Stack gap={1.5}>
        {resourceList.map(({ key, icon, name }) => {
          const current = resources[key];
          const max = caps[key];
          const rate = rates[key];
          const color = getCapColor(current, max);

          const isExpanded = expandedResource === key;
          const breakdown = isExpanded ? getResourceBreakdown(key) : [];

          return (
            <Box key={key}>
              <Box
                p={2}
                bg="var(--bg-tertiary)"
                rounded="4px"
                style={{
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.2s ease',
                  cursor: rate > 0 ? 'pointer' : 'default',
                }}
                onClick={() => rate > 0 && setExpandedResource(isExpanded ? null : key)}
              >
                <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <Text fontSize="13px" fontWeight="bold" style={{ color: 'var(--text-secondary)' }}>
                    {icon} {name} {rate > 0 && (isExpanded ? '▼' : '▶')}
                  </Text>
                  {rate > 0 && (
                    <Text fontSize="11px" style={{ color: 'var(--accent-teal)' }}>
                      {formatRate(rate)}
                    </Text>
                  )}
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text
                    fontSize="16px"
                    fontWeight="bold"
                    style={{
                      color,
                      fontFamily: 'monospace',
                      transition: 'color 0.3s ease',
                    }}
                  >
                    {formatNumber(current)}
                  </Text>
                  <Text fontSize="12px" style={{ color: 'var(--text-dim)' }}>
                    / {formatNumber(max)}
                  </Text>
                </Box>
              </Box>

              {/* Breakdown */}
              {isExpanded && breakdown.length > 0 && (
                <Box
                  p={2}
                  bg="var(--bg-primary)"
                  rounded="4px"
                  style={{
                    border: '1px solid var(--border-color)',
                    marginTop: '4px',
                  }}
                >
                  <Text fontSize="11px" fontWeight="bold" style={{ color: 'var(--accent-teal)', marginBottom: '6px' }}>
                    Production Breakdown:
                  </Text>
                  <Stack gap={1}>
                    {breakdown.map((item, idx) => (
                      <Box key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text fontSize="10px" style={{ color: 'var(--text-secondary)' }}>
                          {item.source}
                        </Text>
                        <Box style={{ textAlign: 'right' }}>
                          <Text fontSize="10px" style={{ color: 'var(--accent-teal)' }}>
                            +{item.amount.toFixed(2)}/s
                          </Text>
                          {item.details && (
                            <Text fontSize="9px" style={{ color: 'var(--text-dim)' }}>
                              {item.details}
                            </Text>
                          )}
                        </Box>
                      </Box>
                    ))}
                    <Box style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', marginTop: '4px' }}>
                      <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text fontSize="11px" fontWeight="bold" style={{ color: 'var(--text-primary)' }}>
                          Total:
                        </Text>
                        <Text fontSize="11px" fontWeight="bold" style={{ color: 'var(--accent-teal)' }}>
                          {formatRate(rate)}
                        </Text>
                      </Box>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};
