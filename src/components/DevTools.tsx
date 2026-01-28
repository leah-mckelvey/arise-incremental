import { gameStore } from '../store/gameStore';
import { Box, Button, Text, Stack } from '@ts-query/ui-react';

export const DevTools = () => {
  const handleFillResources = () => {
    gameStore.getState().devFillResources();
    console.log('💰 DEV: Resources filled to cap!', gameStore.getState().resources);
  };

  return (
    <Box
      bg="var(--bg-secondary)"
      p={4}
      rounded="8px"
      style={{
        boxShadow: '0 4px 12px rgba(255, 0, 0, 0.3), 0 0 20px rgba(255, 0, 0, 0.2)',
        border: '2px solid #ff0000',
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000,
      }}
    >
      <Stack gap={2}>
        <Text
          fontSize="14px"
          fontWeight="bold"
          style={{
            color: '#ff0000',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          🛠️ Dev Tools
        </Text>
        <Button
          onClick={handleFillResources}
          size="sm"
          style={{
            background: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)',
            color: '#fff',
            border: '1px solid #ff0000',
            fontWeight: 'bold',
          }}
        >
          💰 Fill Resources
          <br />
          <span style={{ fontSize: '10px', opacity: 0.8 }}>Ctrl+Shift+F</span>
        </Button>
      </Stack>
    </Box>
  );
};
