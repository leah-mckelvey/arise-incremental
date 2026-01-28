import { useEffect, useState } from 'react';
import { QueryClient } from '@ts-query/core';
import { QueryClientProvider } from '@ts-query/react';
import { Box, Heading, Button } from '@ts-query/ui-react';
import { gameStore, initializeGame } from './store/gameStore';
import { ResourceDisplay } from './components/ResourceDisplay';
import { TabNavigation, type TabId } from './components/TabNavigation';
import { HunterTab } from './components/HunterTab';
import { BuildingList } from './components/BuildingList';
import { ResearchTab } from './components/ResearchTab';
import { ArtifactsTab } from './components/ArtifactsTab';
import { DungeonsTab } from './components/DungeonsTab';
import { AlliesTab } from './components/AlliesTab';
import { ShadowsTab } from './components/ShadowsTab';
import { DevTools } from './components/DevTools';
import { NotificationDisplay } from './components/NotificationDisplay';
import './App.css';

const queryClient = new QueryClient();

function GameContent() {
  const [activeTab, setActiveTab] = useState<TabId>('hunter');

  // Get functions directly from the store
  const tick = gameStore.getState().tick;
  const reset = gameStore.getState().reset;
  const syncWithServer = gameStore.getState().syncWithServer;

  // Initialize game systems on mount
  useEffect(() => {
    initializeGame();
    // Initial sync with server
    syncWithServer();
  }, [syncWithServer]);

  // Game loop
  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [tick]);

  // Sync on visibility change (when user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User returned to tab - sync to get offline gains
        syncWithServer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [syncWithServer]);

  // Periodic sync every 5 minutes (for offline gains, respects pending mutations)
  useEffect(() => {
    const syncInterval = setInterval(
      () => {
        // Only sync if tab is visible (don't waste resources in background)
        if (document.visibilityState === 'visible') {
          syncWithServer(); // Will skip if mutations are in flight
        }
      },
      5 * 60 * 1000
    ); // 5 minutes

    return () => clearInterval(syncInterval);
  }, [syncWithServer]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'hunter':
        return <HunterTab />;
      case 'buildings':
        return <BuildingList />;
      case 'research':
        return <ResearchTab />;
      case 'artifacts':
        return <ArtifactsTab />;
      case 'dungeons':
        return <DungeonsTab />;
      case 'allies':
        return <AlliesTab />;
      case 'shadows':
        return <ShadowsTab />;
      default:
        return null;
    }
  };

  return (
    <Box
      style={{
        display: 'flex',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Sidebar with resources */}
      <Box
        style={{
          width: '280px',
          minWidth: '280px',
          background: 'var(--bg-primary)',
          borderRight: '2px solid var(--border-color)',
          padding: '20px',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        <ResourceDisplay />
      </Box>

      {/* Main content area */}
      <Box
        style={{
          flex: 1,
          padding: '20px',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
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
          <Heading
            level={1}
            style={{
              color: 'var(--text-primary)',
              textShadow: '0 0 20px var(--accent-teal)',
            }}
          >
            ⚔️ Shadow Monarch Idle
          </Heading>
          <Button
            onClick={reset}
            size="sm"
            style={{
              background: 'var(--danger)',
              color: '#fff',
              border: '1px solid var(--danger)',
              fontWeight: 'bold',
            }}
          >
            Reset Game
          </Button>
        </Box>

        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        {renderTabContent()}
      </Box>

      {/* Dev Tools - fixed position (dev mode only) */}
      {import.meta.env.DEV && <DevTools />}

      {/* Notification Display - fixed position */}
      <NotificationDisplay />
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
