import { useResourcesQuery, useAllResourceRatesQuery, useResourceCapsQuery } from '../queries/gameQueries';
import { Box, Heading, Text, Stack } from '@ts-query/ui-react';
import type { Resources } from '../store/gameStore';

export const ResourceDisplay = () => {
  const { data: resources } = useResourcesQuery();
  const { data: caps } = useResourceCapsQuery();
  const { data: rates } = useAllResourceRatesQuery();

  if (!resources || !caps || !rates) return null;

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

          return (
            <Box
              key={key}
              p={2}
              bg="var(--bg-tertiary)"
              rounded="4px"
              style={{
                border: '1px solid var(--border-color)',
                transition: 'all 0.2s ease',
              }}
            >
              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <Text fontSize="13px" fontWeight="bold" style={{ color: 'var(--text-secondary)' }}>
                  {icon} {name}
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
          );
        })}
      </Stack>
    </Box>
  );
};
