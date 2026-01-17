import { useResourcesQuery, useAllResourceRatesQuery } from '../queries/gameQueries';
import { Box, Heading, Text } from '@ts-query/ui-react';

export const ResourceDisplay = () => {
  const { data: resources } = useResourcesQuery();
  const { data: rates } = useAllResourceRatesQuery();

  if (!resources || !rates) return null;

  const formatNumber = (num: number) => {
    return Math.floor(num).toLocaleString();
  };

  const formatRate = (rate: number) => {
    return rate > 0 ? `(+${rate.toFixed(2)}/s)` : '';
  };

  return (
    <Box
      bg="#f0e8d8"
      p={5}
      rounded="8px"
      mb={5}
      style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
    >
      <Heading level={3} style={{ marginBottom: '15px', color: '#5a4a3a' }}>
        Resources
      </Heading>
      <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Box p={2.5} bg="#fff" rounded="4px">
          <Text><strong>🌾 Catnip:</strong> {formatNumber(resources.catnip)} {formatRate(rates.catnip)}</Text>
        </Box>
        <Box p={2.5} bg="#fff" rounded="4px">
          <Text><strong>🪵 Wood:</strong> {formatNumber(resources.wood)} {formatRate(rates.wood)}</Text>
        </Box>
        <Box p={2.5} bg="#fff" rounded="4px">
          <Text><strong>⛰️ Minerals:</strong> {formatNumber(resources.minerals)} {formatRate(rates.minerals)}</Text>
        </Box>
        <Box p={2.5} bg="#fff" rounded="4px">
          <Text><strong>🔬 Science:</strong> {formatNumber(resources.science)} {formatRate(rates.science)}</Text>
        </Box>
      </Box>
    </Box>
  );
};
