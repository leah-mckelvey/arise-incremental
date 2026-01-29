import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useShadowsStore } from './shadowsStore';

describe('shadowsStore', () => {
  beforeEach(() => {
    useShadowsStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should start with empty shadows array', () => {
      const state = useShadowsStore.getState();
      expect(state.shadows).toEqual([]);
    });

    it('should start with necromancer locked', () => {
      const state = useShadowsStore.getState();
      expect(state.necromancerUnlocked).toBe(false);
    });
  });

  describe('unlockNecromancer', () => {
    it('should unlock necromancer ability', () => {
      useShadowsStore.getState().unlockNecromancer();

      expect(useShadowsStore.getState().necromancerUnlocked).toBe(true);
    });

    it('should persist after multiple calls', () => {
      useShadowsStore.getState().unlockNecromancer();
      useShadowsStore.getState().unlockNecromancer();

      expect(useShadowsStore.getState().necromancerUnlocked).toBe(true);
    });
  });

  describe('extractShadow', () => {
    describe('when necromancer is NOT unlocked', () => {
      it('should return null when necromancer is not unlocked', () => {
        const shadow = useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');

        // The current implementation returns {} as Shadow, which is a bug
        // The test expects null to define the correct behavior
        expect(shadow).toBeNull();
      });

      it('should not add shadow to store when necromancer is locked', () => {
        useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');

        expect(useShadowsStore.getState().shadows.length).toBe(0);
      });
    });

    describe('when necromancer IS unlocked', () => {
      beforeEach(() => {
        useShadowsStore.getState().unlockNecromancer();
      });

      it('should create a new shadow with correct properties', () => {
        const shadow = useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');

        expect(shadow).not.toBeNull();
        expect(shadow!.id).toMatch(/^shadow-\d+-\d+$/);
        expect(shadow!.name).toBe('Igris');
        expect(shadow!.type).toBe('shadow');
        expect(shadow!.originDungeonId).toBe('dungeon-castle');
        expect(shadow!.level).toBe(1);
        expect(shadow!.xp).toBe(0);
        expect(shadow!.xpToNextLevel).toBe(100);
      });

      it('should add the shadow to the store', () => {
        useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');

        const state = useShadowsStore.getState();
        expect(state.shadows.length).toBe(1);
        expect(state.shadows[0].name).toBe('Igris');
      });

      it('should return existing shadow if already extracted (by name only)', () => {
        const firstShadow = useShadowsStore.getState().extractShadow('Igris', 'dungeon-1');
        const secondShadow = useShadowsStore.getState().extractShadow('Igris', 'dungeon-2');

        expect(firstShadow!.id).toBe(secondShadow!.id);
        expect(useShadowsStore.getState().shadows.length).toBe(1);
      });

      it('should allow different-named shadows', () => {
        const shadow1 = useShadowsStore.getState().extractShadow('Igris', 'dungeon-1');
        const shadow2 = useShadowsStore.getState().extractShadow('Iron', 'dungeon-1');

        expect(shadow1!.id).not.toBe(shadow2!.id);
        expect(useShadowsStore.getState().shadows.length).toBe(2);
      });

      it('should generate unique IDs for shadows extracted in quick succession', () => {
        const shadow1 = useShadowsStore.getState().extractShadow('Shadow1', 'dungeon-1');
        const shadow2 = useShadowsStore.getState().extractShadow('Shadow2', 'dungeon-2');
        const shadow3 = useShadowsStore.getState().extractShadow('Shadow3', 'dungeon-3');

        const ids = [shadow1!.id, shadow2!.id, shadow3!.id];
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(3);
      });
    });
  });

  describe('addXpToShadow', () => {
    beforeEach(() => {
      useShadowsStore.getState().unlockNecromancer();
    });

    it('should add XP to a shadow', () => {
      const shadow = useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');
      useShadowsStore.getState().addXpToShadow(shadow!.id, 50);

      const updatedShadow = useShadowsStore.getState().shadows[0];
      expect(updatedShadow.xp).toBe(50);
    });

    it('should level up shadow when XP threshold is reached', () => {
      const shadow = useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');
      useShadowsStore.getState().addXpToShadow(shadow!.id, 100);

      const updatedShadow = useShadowsStore.getState().shadows[0];
      expect(updatedShadow.level).toBe(2);
      expect(updatedShadow.xp).toBe(0);
      expect(updatedShadow.xpToNextLevel).toBe(150);
    });

    it('should call onLevelUp callback when leveling up', () => {
      const shadow = useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');
      const onLevelUp = vi.fn();

      useShadowsStore.getState().addXpToShadow(shadow!.id, 100, onLevelUp);

      expect(onLevelUp).toHaveBeenCalledWith(2);
    });

    it('should handle multiple level ups in a single XP addition', () => {
      const shadow = useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');
      const onLevelUp = vi.fn();

      useShadowsStore.getState().addXpToShadow(shadow!.id, 250, onLevelUp);

      const updatedShadow = useShadowsStore.getState().shadows[0];
      expect(updatedShadow.level).toBe(3);
      expect(onLevelUp).toHaveBeenCalledTimes(2);
    });

    it('should not modify state for non-existent shadow', () => {
      useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');
      useShadowsStore.getState().addXpToShadow('non-existent-id', 100);

      const shadow = useShadowsStore.getState().shadows[0];
      expect(shadow.xp).toBe(0); // Unchanged
    });

    it('should carry over excess XP after leveling', () => {
      const shadow = useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');
      useShadowsStore.getState().addXpToShadow(shadow!.id, 120);

      const updatedShadow = useShadowsStore.getState().shadows[0];
      expect(updatedShadow.level).toBe(2);
      expect(updatedShadow.xp).toBe(20);
    });
  });

  describe('getShadowsForDungeon', () => {
    beforeEach(() => {
      useShadowsStore.getState().unlockNecromancer();
    });

    it('should return shadows from a specific dungeon', () => {
      useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');
      useShadowsStore.getState().extractShadow('Iron', 'dungeon-castle');
      useShadowsStore.getState().extractShadow('Tusk', 'dungeon-forest');

      // Note: Shadow duplicate check is by name only, so Iron goes to castle
      // But Tusk has different name so goes to forest
      const castleShadows = useShadowsStore.getState().getShadowsForDungeon('dungeon-castle');

      expect(castleShadows.length).toBe(2);
      expect(castleShadows.map((s) => s.name)).toContain('Igris');
      expect(castleShadows.map((s) => s.name)).toContain('Iron');
    });

    it('should return empty array for dungeon with no shadows', () => {
      useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');

      const forestShadows = useShadowsStore.getState().getShadowsForDungeon('dungeon-forest');

      expect(forestShadows).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should clear all shadows and lock necromancer', () => {
      useShadowsStore.getState().unlockNecromancer();
      useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');
      useShadowsStore.getState().extractShadow('Iron', 'dungeon-castle');

      expect(useShadowsStore.getState().shadows.length).toBe(2);
      expect(useShadowsStore.getState().necromancerUnlocked).toBe(true);

      useShadowsStore.getState().reset();

      expect(useShadowsStore.getState().shadows).toEqual([]);
      expect(useShadowsStore.getState().necromancerUnlocked).toBe(false);
    });
  });

  describe('XP calculation formula', () => {
    beforeEach(() => {
      useShadowsStore.getState().unlockNecromancer();
    });

    it('should use correct XP scaling formula: floor(100 * 1.5^(level-1))', () => {
      const shadow = useShadowsStore.getState().extractShadow('Igris', 'dungeon-castle');

      // Level 1: floor(100 * 1.5^0) = 100
      expect(shadow!.xpToNextLevel).toBe(100);

      // Add enough XP to get to level 2
      useShadowsStore.getState().addXpToShadow(shadow!.id, 100);
      let updated = useShadowsStore.getState().shadows[0];
      // Level 2: floor(100 * 1.5^1) = 150
      expect(updated.xpToNextLevel).toBe(150);

      // Add enough XP to get to level 3
      useShadowsStore.getState().addXpToShadow(shadow!.id, 150);
      updated = useShadowsStore.getState().shadows[0];
      // Level 3: floor(100 * 1.5^2) = 225
      expect(updated.xpToNextLevel).toBe(225);

      // Add enough XP to get to level 4
      useShadowsStore.getState().addXpToShadow(shadow!.id, 225);
      updated = useShadowsStore.getState().shadows[0];
      // Level 4: floor(100 * 1.5^3) = 337
      expect(updated.xpToNextLevel).toBe(337);
    });
  });
});
