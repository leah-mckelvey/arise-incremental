import { describe, it, expect, beforeEach } from 'vitest';
import { useResearchStore } from './researchStore';

describe('researchStore', () => {
  beforeEach(() => {
    useResearchStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have all research not researched', () => {
      const research = useResearchStore.getState().research;
      Object.values(research).forEach((tech) => {
        expect(tech.researched).toBe(false);
      });
    });

    it('should have correct costs', () => {
      const research = useResearchStore.getState().research;
      expect(research.basicExtraction.cost).toBe(10);
      expect(research.knowledgeGeneration.cost).toBe(10);
      expect(research.manaResonance.cost).toBe(50);
    });

    it('should have correct prerequisites', () => {
      const research = useResearchStore.getState().research;
      expect(research.basicExtraction.requires).toBeUndefined();
      expect(research.manaResonance.requires).toEqual(['basicExtraction']);
      expect(research.shadowEconomy.requires).toEqual(['industrialScale', 'compoundedLearning']);
    });
  });

  describe('purchaseResearch', () => {
    it('should research tech when knowledge is sufficient and no prerequisites', () => {
      let purchaseSucceeded = false;

      useResearchStore.getState().purchaseResearch('basicExtraction', 100, (cost, newResearch) => {
        purchaseSucceeded = true;
        expect(newResearch.basicExtraction.researched).toBe(true);
        expect(cost).toBe(10);
      });

      expect(purchaseSucceeded).toBe(true);
      expect(useResearchStore.getState().research.basicExtraction.researched).toBe(true);
    });

    it('should not research when knowledge is insufficient', () => {
      let callbackCalled = false;

      useResearchStore.getState().purchaseResearch('basicExtraction', 5, () => {
        callbackCalled = true;
      });

      expect(callbackCalled).toBe(false);
      expect(useResearchStore.getState().research.basicExtraction.researched).toBe(false);
    });

    it('should not research when prerequisites are not met', () => {
      let callbackCalled = false;

      useResearchStore.getState().purchaseResearch('manaResonance', 100, () => {
        callbackCalled = true;
      });

      expect(callbackCalled).toBe(false);
      expect(useResearchStore.getState().research.manaResonance.researched).toBe(false);
    });

    it('should research when prerequisites are met', () => {
      // First research the prerequisite
      useResearchStore.setState({
        research: {
          ...useResearchStore.getState().research,
          basicExtraction: {
            ...useResearchStore.getState().research.basicExtraction,
            researched: true,
          },
        },
      });

      let purchaseSucceeded = false;

      useResearchStore.getState().purchaseResearch('manaResonance', 100, (cost, newResearch) => {
        purchaseSucceeded = true;
        expect(newResearch.manaResonance.researched).toBe(true);
      });

      expect(purchaseSucceeded).toBe(true);
      expect(useResearchStore.getState().research.manaResonance.researched).toBe(true);
    });

    it('should not research already researched tech', () => {
      // Set tech as already researched
      useResearchStore.setState({
        research: {
          ...useResearchStore.getState().research,
          basicExtraction: {
            ...useResearchStore.getState().research.basicExtraction,
            researched: true,
          },
        },
      });

      let callbackCalled = false;

      useResearchStore.getState().purchaseResearch('basicExtraction', 100, () => {
        callbackCalled = true;
      });

      expect(callbackCalled).toBe(false);
    });

    it('should not research invalid tech', () => {
      let callbackCalled = false;

      useResearchStore.getState().purchaseResearch('invalidTech', 1000, () => {
        callbackCalled = true;
      });

      expect(callbackCalled).toBe(false);
    });

    it('should handle multiple prerequisites', () => {
      // Research both prerequisites for shadowEconomy
      useResearchStore.setState({
        research: {
          ...useResearchStore.getState().research,
          basicExtraction: { ...useResearchStore.getState().research.basicExtraction, researched: true },
          manaResonance: { ...useResearchStore.getState().research.manaResonance, researched: true },
          industrialScale: { ...useResearchStore.getState().research.industrialScale, researched: true },
          knowledgeGeneration: { ...useResearchStore.getState().research.knowledgeGeneration, researched: true },
          compoundedLearning: { ...useResearchStore.getState().research.compoundedLearning, researched: true },
        },
      });

      let purchaseSucceeded = false;

      useResearchStore.getState().purchaseResearch('shadowEconomy', 1000, (cost, newResearch) => {
        purchaseSucceeded = true;
        expect(newResearch.shadowEconomy.researched).toBe(true);
      });

      expect(purchaseSucceeded).toBe(true);
    });
  });

  describe('Research Effects', () => {
    it('should have building efficiency bonuses', () => {
      const basicExtraction = useResearchStore.getState().research.basicExtraction;
      expect(basicExtraction.effects?.buildingEfficiency?.essenceExtractor).toBe(1.5);
    });

    it('should have building efficiency bonuses for industrial scale', () => {
      const tech = useResearchStore.getState().research.industrialScale;
      expect(tech.effects?.buildingEfficiency?.essenceExtractor).toBe(2.0);
    });

    it('should have cap multipliers', () => {
      const tech = useResearchStore.getState().research.deepStorage;
      expect(tech.effects?.capMultiplier?.essence).toBe(1.5);
    });

    it('should have unlocks', () => {
      const tech = useResearchStore.getState().research.shadowEconomy;
      expect(tech.unlocks).toEqual(['soulHarvester']);
    });
  });
});

