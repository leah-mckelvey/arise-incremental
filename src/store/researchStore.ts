import { createStore } from '@ts-query/core';
import type { Resources, ResourceCaps } from './types';
import { initialResearch as baseInitialResearch } from '../data/initialResearch';

// Research/Tech types
export interface Research {
  id: string;
  name: string;
  description: string;
  cost: number; // Knowledge points required
  researched: boolean;
  requires?: string[]; // IDs of prerequisite research
  unlocks?: string[]; // IDs of buildings/research this unlocks
  effects?: {
    // Production multipliers (multiplicative with other bonuses)
    productionMultiplier?: Partial<Record<keyof Resources, number>>;
    // Building efficiency (e.g., "essenceExtractor": 1.5 = 50% more production)
    buildingEfficiency?: Record<string, number>;
    // Cap multipliers
    capMultiplier?: Partial<Record<keyof Resources, number>>;
    // Flat cap increases
    capIncrease?: Partial<ResourceCaps>;
    // Gathering bonuses
    gatheringBonus?: Partial<Record<keyof Resources, number>>;
  };
}

export interface ResearchState {
  research: Record<string, Research>;
  purchaseResearch: (researchId: string, knowledge: number, onSuccess: (cost: number, newResearch: Record<string, Research>) => void) => void;
  reset: () => void;
}

// Use initial research from data file
const initialResearch = baseInitialResearch;

const STORAGE_KEY = 'arise-research-storage';

const loadPersistedState = (): Partial<ResearchState> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load research state:', error);
  }
  return null;
};

const persistState = (state: ResearchState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ research: state.research }));
  } catch (error) {
    console.error('Failed to persist research state:', error);
  }
};

export const useResearchStore = createStore<ResearchState>((set, get) => {
  const persisted = loadPersistedState();
  const initialState = {
    research: persisted?.research || initialResearch,
  };

  const store: ResearchState = {
    ...initialState,

    purchaseResearch: (researchId, knowledge, onSuccess) => {
      const research = get().research[researchId];
      if (!research) return;
      if (research.researched) return;
      if (knowledge < research.cost) return;

      // Check prerequisites
      if (research.requires) {
        const hasPrereqs = research.requires.every(
          (reqId) => get().research[reqId]?.researched
        );
        if (!hasPrereqs) return;
      }

      set((state) => {
        const newResearch = {
          ...state.research,
          [researchId]: {
            ...research,
            researched: true,
          },
        };

        onSuccess(research.cost, newResearch);
        const newState = { ...state, research: newResearch };
        persistState(newState);
        return newState;
      });
    },

    reset: () => {
      set({ research: initialResearch });
      localStorage.removeItem(STORAGE_KEY);
    },
  };

  return store;
});

