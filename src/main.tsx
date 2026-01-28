import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import {
  gameStore,
  purchaseBuilding,
  purchaseResearch,
  allocateStat,
  craftArtifact,
  equipArtifact,
  unequipArtifact,
  upgradeArtifact,
  useArtifactsStore,
} from './store/gameStore';
import { useBuildingsStore } from './store/buildingsStore';
import { useResearchStore } from './store/researchStore';
import { useHunterStore } from './store/hunterStore';

// Expose stores to window for debugging (dev mode only)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  interface DebugWindow extends Window {
    __GAME_STORE__: typeof gameStore;
    __BUILDINGS_STORE__: typeof useBuildingsStore;
    __RESEARCH_STORE__: typeof useResearchStore;
    __HUNTER_STORE__: typeof useHunterStore;
    __ARTIFACTS_STORE__: typeof useArtifactsStore;
    __PURCHASE_BUILDING__: typeof purchaseBuilding;
    __PURCHASE_RESEARCH__: typeof purchaseResearch;
    __ALLOCATE_STAT__: typeof allocateStat;
    __CRAFT_ARTIFACT__: typeof craftArtifact;
    __EQUIP_ARTIFACT__: typeof equipArtifact;
    __UNEQUIP_ARTIFACT__: typeof unequipArtifact;
    __UPGRADE_ARTIFACT__: typeof upgradeArtifact;
    __DEV_FILL__: () => void;
  }

  const debugWindow = window as unknown as DebugWindow;
  debugWindow.__GAME_STORE__ = gameStore;
  debugWindow.__BUILDINGS_STORE__ = useBuildingsStore;
  debugWindow.__RESEARCH_STORE__ = useResearchStore;
  debugWindow.__HUNTER_STORE__ = useHunterStore;
  debugWindow.__ARTIFACTS_STORE__ = useArtifactsStore;
  debugWindow.__PURCHASE_BUILDING__ = purchaseBuilding;
  debugWindow.__PURCHASE_RESEARCH__ = purchaseResearch;
  debugWindow.__ALLOCATE_STAT__ = allocateStat;
  debugWindow.__CRAFT_ARTIFACT__ = craftArtifact;
  debugWindow.__EQUIP_ARTIFACT__ = equipArtifact;
  debugWindow.__UNEQUIP_ARTIFACT__ = unequipArtifact;
  debugWindow.__UPGRADE_ARTIFACT__ = upgradeArtifact;
  debugWindow.__DEV_FILL__ = () => gameStore.getState().devFillResources();

  // Add keyboard shortcut: Ctrl+Shift+F to fill resources
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      gameStore.getState().devFillResources();
      console.log('💰 DEV: Resources filled to cap!', gameStore.getState().resources);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
