import { useEffect } from 'react';
import { QueryClient } from '@ts-query/core';
import { QueryClientProvider } from '@ts-query/react';
import { Box, Heading, Button } from '@ts-query/ui-react';
import { gameStore } from './store/gameStore';
import { ResourceDisplay } from './components/ResourceDisplay';
import { GatheringActions } from './components/GatheringActions';
import { BuildingList } from './components/BuildingList';
import './App.css';

const queryClient = new QueryClient();

function GameContent() {
  // Get functions directly from the store
  const tick = gameStore.getState().tick;
  const reset = gameStore.getState().reset;

  // Game loop
  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [tick]);

  return (
    <Box
      p={5}
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <Box
        mb={5}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Heading level={1} style={{ color: '#5a4a3a' }}>
          🐱 Arise Incremental
        </Heading>
        <Button
          onClick={reset}
          colorScheme="red"
          size="sm"
        >
          Reset Game
        </Button>
      </Box>

      <ResourceDisplay />
      <GatheringActions />
      <BuildingList />
    </Box>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GameContent />
    </QueryClientProvider>
  );
}

export default App;
