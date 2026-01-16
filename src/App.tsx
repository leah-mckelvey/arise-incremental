import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGameStore } from './store/gameStore';
import { ResourceDisplay } from './components/ResourceDisplay';
import { GatheringActions } from './components/GatheringActions';
import { BuildingList } from './components/BuildingList';
import './App.css';

const queryClient = new QueryClient();

function GameContent() {
  const tick = useGameStore((state) => state.tick);
  const reset = useGameStore((state) => state.reset);

  // Game loop
  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [tick]);

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1 style={{ color: '#5a4a3a', margin: 0 }}>🐱 Arise Incremental</h1>
        <button
          onClick={reset}
          style={{
            padding: '10px 20px',
            background: '#d9534f',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          Reset Game
        </button>
      </div>
      
      <ResourceDisplay />
      <GatheringActions />
      <BuildingList />
    </div>
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
