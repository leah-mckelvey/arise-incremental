import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAlliesStore } from './alliesStore';

describe('alliesStore', () => {
  beforeEach(() => {
    useAlliesStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should start with empty allies array', () => {
      const state = useAlliesStore.getState();
      expect(state.allies).toEqual([]);
    });
  });

  describe('recruitAlly (named allies from dungeons)', () => {
    it('should create a new named ally with correct properties', () => {
      const ally = useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');

      expect(ally.id).toMatch(/^ally-\d+-\d+$/);
      expect(ally.name).toBe('Igris');
      expect(ally.type).toBe('ally');
      expect(ally.originDungeonId).toBe('dungeon-castle');
      expect(ally.level).toBe(1);
      expect(ally.xp).toBe(0);
      expect(ally.xpToNextLevel).toBe(100); // Math.floor(100 * 1.5^0) = 100
    });

    it('should add the ally to the store', () => {
      useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');

      const state = useAlliesStore.getState();
      expect(state.allies.length).toBe(1);
      expect(state.allies[0].name).toBe('Igris');
    });

    it('should return existing ally if already recruited from same dungeon', () => {
      const firstAlly = useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');
      const secondAlly = useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');

      expect(firstAlly.id).toBe(secondAlly.id);
      expect(useAlliesStore.getState().allies.length).toBe(1);
    });

    it('should allow same-named ally from different dungeons', () => {
      const ally1 = useAlliesStore.getState().recruitAlly('Knight', 'dungeon-1');
      const ally2 = useAlliesStore.getState().recruitAlly('Knight', 'dungeon-2');

      expect(ally1.id).not.toBe(ally2.id);
      expect(useAlliesStore.getState().allies.length).toBe(2);
    });

    it('should generate unique IDs for allies recruited in quick succession', () => {
      const ally1 = useAlliesStore.getState().recruitAlly('Ally1', 'dungeon-1');
      const ally2 = useAlliesStore.getState().recruitAlly('Ally2', 'dungeon-2');
      const ally3 = useAlliesStore.getState().recruitAlly('Ally3', 'dungeon-3');

      const ids = [ally1.id, ally2.id, ally3.id];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('recruitGenericAlly', () => {
    it('should create a generic ally with numbered name', () => {
      const ally = useAlliesStore.getState().recruitGenericAlly('Shadow Soldier', 'E-Rank');

      expect(ally.name).toBe('Shadow Soldier #1');
      expect(ally.type).toBe('ally');
      expect(ally.originDungeonId).toBe('recruited');
      expect(ally.level).toBe(1);
    });

    it('should increment numbers for multiple generic allies with same base name', () => {
      const ally1 = useAlliesStore.getState().recruitGenericAlly('Shadow Soldier', 'E-Rank');
      const ally2 = useAlliesStore.getState().recruitGenericAlly('Shadow Soldier', 'E-Rank');
      const ally3 = useAlliesStore.getState().recruitGenericAlly('Shadow Soldier', 'E-Rank');

      expect(ally1.name).toBe('Shadow Soldier #1');
      expect(ally2.name).toBe('Shadow Soldier #2');
      expect(ally3.name).toBe('Shadow Soldier #3');
    });

    it('should track different generic ally types separately', () => {
      const soldier1 = useAlliesStore.getState().recruitGenericAlly('Shadow Soldier', 'E-Rank');
      const archer1 = useAlliesStore.getState().recruitGenericAlly('Shadow Archer', 'E-Rank');
      const soldier2 = useAlliesStore.getState().recruitGenericAlly('Shadow Soldier', 'E-Rank');

      expect(soldier1.name).toBe('Shadow Soldier #1');
      expect(archer1.name).toBe('Shadow Archer #1');
      expect(soldier2.name).toBe('Shadow Soldier #2');
    });
  });

  describe('addXpToAlly', () => {
    it('should add XP to an ally', () => {
      const ally = useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');
      useAlliesStore.getState().addXpToAlly(ally.id, 50);

      const updatedAlly = useAlliesStore.getState().allies[0];
      expect(updatedAlly.xp).toBe(50);
    });

    it('should level up ally when XP threshold is reached', () => {
      const ally = useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');
      useAlliesStore.getState().addXpToAlly(ally.id, 100); // Exactly enough for level 2

      const updatedAlly = useAlliesStore.getState().allies[0];
      expect(updatedAlly.level).toBe(2);
      expect(updatedAlly.xp).toBe(0);
      expect(updatedAlly.xpToNextLevel).toBe(150); // Math.floor(100 * 1.5^1) = 150
    });

    it('should call onLevelUp callback when leveling up', () => {
      const ally = useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');
      const onLevelUp = vi.fn();

      useAlliesStore.getState().addXpToAlly(ally.id, 100, onLevelUp);

      expect(onLevelUp).toHaveBeenCalledWith(2);
    });

    it('should handle multiple level ups in a single XP addition', () => {
      const ally = useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');
      const onLevelUp = vi.fn();

      // Level 1->2: 100 XP, Level 2->3: 150 XP, Total: 250 XP
      useAlliesStore.getState().addXpToAlly(ally.id, 250, onLevelUp);

      const updatedAlly = useAlliesStore.getState().allies[0];
      expect(updatedAlly.level).toBe(3);
      expect(updatedAlly.xp).toBe(0);
      expect(onLevelUp).toHaveBeenCalledTimes(2);
      expect(onLevelUp).toHaveBeenNthCalledWith(1, 2);
      expect(onLevelUp).toHaveBeenNthCalledWith(2, 3);
    });

    it('should not modify state for non-existent ally', () => {
      useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');
      useAlliesStore.getState().addXpToAlly('non-existent-id', 100);

      const ally = useAlliesStore.getState().allies[0];
      expect(ally.xp).toBe(0); // Unchanged
    });

    it('should carry over excess XP after leveling', () => {
      const ally = useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');
      useAlliesStore.getState().addXpToAlly(ally.id, 120); // 20 XP over threshold

      const updatedAlly = useAlliesStore.getState().allies[0];
      expect(updatedAlly.level).toBe(2);
      expect(updatedAlly.xp).toBe(20);
    });
  });

  describe('getAlliesForDungeon', () => {
    it('should return allies from a specific dungeon', () => {
      useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');
      useAlliesStore.getState().recruitAlly('Iron', 'dungeon-castle');
      useAlliesStore.getState().recruitAlly('Tusk', 'dungeon-forest');

      const castleAllies = useAlliesStore.getState().getAlliesForDungeon('dungeon-castle');

      expect(castleAllies.length).toBe(2);
      expect(castleAllies.map((a) => a.name)).toEqual(['Igris', 'Iron']);
    });

    it('should return empty array for dungeon with no allies', () => {
      useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');

      const forestAllies = useAlliesStore.getState().getAlliesForDungeon('dungeon-forest');

      expect(forestAllies).toEqual([]);
    });

    it('should filter generic allies by their "recruited" origin', () => {
      useAlliesStore.getState().recruitGenericAlly('Soldier', 'E-Rank');
      useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');

      const castleAllies = useAlliesStore.getState().getAlliesForDungeon('dungeon-castle');
      const recruitedAllies = useAlliesStore.getState().getAlliesForDungeon('recruited');

      expect(castleAllies.length).toBe(1);
      expect(recruitedAllies.length).toBe(1);
    });
  });

  describe('reset', () => {
    it('should clear all allies', () => {
      useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');
      useAlliesStore.getState().recruitAlly('Iron', 'dungeon-castle');
      useAlliesStore.getState().recruitGenericAlly('Soldier', 'E-Rank');

      expect(useAlliesStore.getState().allies.length).toBe(3);

      useAlliesStore.getState().reset();

      expect(useAlliesStore.getState().allies).toEqual([]);
    });
  });

  describe('XP calculation formula', () => {
    it('should use correct XP scaling formula: floor(100 * 1.5^(level-1))', () => {
      const ally = useAlliesStore.getState().recruitAlly('Igris', 'dungeon-castle');

      // Level 1: floor(100 * 1.5^0) = 100
      expect(ally.xpToNextLevel).toBe(100);

      // Add enough XP to get to level 2
      useAlliesStore.getState().addXpToAlly(ally.id, 100);
      let updated = useAlliesStore.getState().allies[0];
      // Level 2: floor(100 * 1.5^1) = 150
      expect(updated.xpToNextLevel).toBe(150);

      // Add enough XP to get to level 3
      useAlliesStore.getState().addXpToAlly(ally.id, 150);
      updated = useAlliesStore.getState().allies[0];
      // Level 3: floor(100 * 1.5^2) = 225
      expect(updated.xpToNextLevel).toBe(225);

      // Add enough XP to get to level 4
      useAlliesStore.getState().addXpToAlly(ally.id, 225);
      updated = useAlliesStore.getState().allies[0];
      // Level 4: floor(100 * 1.5^3) = 337
      expect(updated.xpToNextLevel).toBe(337);
    });
  });
});
