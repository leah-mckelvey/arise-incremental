import { describe, it, expect, beforeEach } from 'vitest';
import { useArtifactsStore } from './artifactsStore';
import type { Resources } from './types';

describe('artifactsStore', () => {
  beforeEach(() => {
    useArtifactsStore.getState().reset();
  });

  describe('initial state', () => {
    it('should start with blacksmith level 1', () => {
      const state = useArtifactsStore.getState();
      expect(state.blacksmithLevel).toBe(1);
    });

    it('should start with 0 blacksmith XP', () => {
      const state = useArtifactsStore.getState();
      expect(state.blacksmithXp).toBe(0);
    });

    it('should start with empty inventory', () => {
      const state = useArtifactsStore.getState();
      expect(state.inventory).toEqual([]);
    });

    it('should start with no equipped artifacts', () => {
      const state = useArtifactsStore.getState();
      expect(state.equipped.weapon).toBeUndefined();
      expect(state.equipped.head).toBeUndefined();
    });
  });

  describe('craftArtifact', () => {
    it('should craft E-rank weapon when resources are sufficient', () => {
      const resources: Resources = {
        essence: 100,
        crystals: 50,
        gold: 100,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      };

      let craftedArtifact = null;
      let costPaid = null;

      useArtifactsStore.getState().craftArtifact('E', 'weapon', resources, (cost, artifact) => {
        costPaid = cost;
        craftedArtifact = artifact;
      });

      const state = useArtifactsStore.getState();
      expect(state.inventory.length).toBe(1);
      expect(state.inventory[0].rank).toBe('E');
      expect(state.inventory[0].slot).toBe('weapon');
      expect(craftedArtifact).not.toBeNull();
      expect(costPaid).not.toBeNull();
    });

    it('should not craft when resources are insufficient', () => {
      const resources: Resources = {
        essence: 0,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      };

      let callbackCalled = false;

      useArtifactsStore.getState().craftArtifact('E', 'weapon', resources, () => {
        callbackCalled = true;
      });

      const state = useArtifactsStore.getState();
      expect(state.inventory.length).toBe(0);
      expect(callbackCalled).toBe(false);
    });
  });

  describe('equipArtifact', () => {
    it('should equip artifact from inventory', () => {
      const resources: Resources = {
        essence: 100,
        crystals: 50,
        gold: 100,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      };

      let craftedArtifact = null;

      useArtifactsStore.getState().craftArtifact('E', 'weapon', resources, (_, artifact) => {
        craftedArtifact = artifact;
      });

      useArtifactsStore.getState().equipArtifact(craftedArtifact!);

      const state = useArtifactsStore.getState();
      expect(state.inventory.length).toBe(0);
      expect(state.equipped.weapon).toBeDefined();
      expect(state.equipped.weapon?.rank).toBe('E');
    });

    it('should swap equipped artifact to inventory', () => {
      const resources: Resources = {
        essence: 200,
        crystals: 100,
        gold: 200,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      };

      let artifact1 = null;
      let artifact2 = null;

      useArtifactsStore.getState().craftArtifact('E', 'weapon', resources, (_, artifact) => {
        artifact1 = artifact;
      });

      useArtifactsStore.getState().craftArtifact('E', 'weapon', resources, (_, artifact) => {
        artifact2 = artifact;
      });

      useArtifactsStore.getState().equipArtifact(artifact1!);
      useArtifactsStore.getState().equipArtifact(artifact2!);

      const state = useArtifactsStore.getState();
      expect(state.inventory.length).toBe(1);
      expect(state.equipped.weapon?.id).toBe(artifact2!.id);
      expect(state.inventory[0].id).toBe(artifact1!.id);
    });
  });

  describe('addBlacksmithXp', () => {
    it('should add blacksmith XP', () => {
      useArtifactsStore.getState().addBlacksmithXp(50);
      const state = useArtifactsStore.getState();
      expect(state.blacksmithXp).toBe(50);
    });
  });
});
