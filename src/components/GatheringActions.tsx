import { gameStore } from '../store/gameStore';
import { Box, Heading, Button } from '@ts-query/ui-react';

export const GatheringActions = () => {
  // Get the addResource function directly from the store
  const addResource = gameStore.getState().addResource;

  return (
    <Box
      bg="#f0e8d8"
      p={5}
      rounded="8px"
      mb={5}
      style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
    >
      <Heading level={3} style={{ marginBottom: '15px', color: '#5a4a3a' }}>
        Gather Resources
      </Heading>
      <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
        <Button
          onClick={() => addResource('catnip', 1)}
          colorScheme="green"
          size="md"
        >
          🌾 Gather Catnip
        </Button>
        <Button
          onClick={() => addResource('wood', 1)}
          colorScheme="green"
          size="md"
        >
          🪵 Chop Wood
        </Button>
        <Button
          onClick={() => addResource('minerals', 1)}
          colorScheme="green"
          size="md"
        >
          ⛰️ Mine Minerals
        </Button>
      </Box>
    </Box>
  );
};
