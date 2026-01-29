import { describe, it, expect, beforeEach } from 'vitest';
import { useHunterStore } from './hunterStore';

describe('hunterStore', () => {
  beforeEach(() => {
    useHunterStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should start at level 1', () => {
      const hunter = useHunterStore.getState().hunter;
      expect(hunter.level).toBe(1);
    });

    it('should start with E-Rank', () => {
      const hunter = useHunterStore.getState().hunter;
      expect(hunter.rank).toBe('E-Rank');
    });

    it('should start with 0 XP', () => {
      const hunter = useHunterStore.getState().hunter;
      expect(hunter.xp).toBe(0);
    });

    it('should have initial stats of 10', () => {
      const hunter = useHunterStore.getState().hunter;
      expect(hunter.stats.strength).toBe(10);
      expect(hunter.stats.agility).toBe(10);
      expect(hunter.stats.intelligence).toBe(10);
      expect(hunter.stats.vitality).toBe(10);
      expect(hunter.stats.sense).toBe(10);
    });

    it('should start with 0 stat points', () => {
      const hunter = useHunterStore.getState().hunter;
      expect(hunter.statPoints).toBe(0);
    });
  });

  describe('addXp', () => {
    it('should add XP correctly', () => {
      useHunterStore.getState().addXp(50);
      const hunter = useHunterStore.getState().hunter;
      expect(hunter.xp).toBe(50);
    });

    it('should level up when XP threshold is reached', () => {
      const initialLevel = useHunterStore.getState().hunter.level;
      const xpNeeded = useHunterStore.getState().hunter.xpToNextLevel;

      useHunterStore.getState().addXp(xpNeeded);

      const hunter = useHunterStore.getState().hunter;
      expect(hunter.level).toBe(initialLevel + 1);
      expect(hunter.xp).toBe(0);
    });

    it('should grant stat points on level up', () => {
      const xpNeeded = useHunterStore.getState().hunter.xpToNextLevel;

      useHunterStore.getState().addXp(xpNeeded);

      const hunter = useHunterStore.getState().hunter;
      expect(hunter.statPoints).toBe(3);
    });

    it('should handle multiple level ups', () => {
      const initialLevel = useHunterStore.getState().hunter.level;

      // Add enough XP for multiple levels
      useHunterStore.getState().addXp(10000);

      const hunter = useHunterStore.getState().hunter;
      expect(hunter.level).toBeGreaterThan(initialLevel);
      expect(hunter.statPoints).toBeGreaterThan(0);
    });

    it('should update rank on level up', () => {
      // Level up to 10 (D-Rank threshold)
      useHunterStore.getState().addXp(10000);

      const hunter = useHunterStore.getState().hunter;
      expect(hunter.rank).not.toBe('E-Rank');
    });

    it('should call onLevelUp callback when leveling up', () => {
      const xpNeeded = useHunterStore.getState().hunter.xpToNextLevel;
      let callbackLevel = 0;

      useHunterStore.getState().addXp(xpNeeded, (newLevel) => {
        callbackLevel = newLevel;
      });

      expect(callbackLevel).toBe(2);
    });

    it('should not call onLevelUp callback when not leveling up', () => {
      let callbackCalled = false;

      useHunterStore.getState().addXp(10, () => {
        callbackCalled = true;
      });

      expect(callbackCalled).toBe(false);
    });
  });

  describe('allocateStat', () => {
    beforeEach(() => {
      // Give the hunter some stat points
      useHunterStore.setState({
        hunter: {
          ...useHunterStore.getState().hunter,
          statPoints: 5,
        },
      });
    });

    it('should increase strength', () => {
      const initialStrength = useHunterStore.getState().hunter.stats.strength;

      useHunterStore.getState().allocateStat('strength');

      const hunter = useHunterStore.getState().hunter;
      expect(hunter.stats.strength).toBe(initialStrength + 1);
      expect(hunter.statPoints).toBe(4);
    });

    it('should increase agility', () => {
      const initialAgility = useHunterStore.getState().hunter.stats.agility;

      useHunterStore.getState().allocateStat('agility');

      const hunter = useHunterStore.getState().hunter;
      expect(hunter.stats.agility).toBe(initialAgility + 1);
    });

    it('should increase intelligence', () => {
      const initialIntelligence = useHunterStore.getState().hunter.stats.intelligence;

      useHunterStore.getState().allocateStat('intelligence');

      const hunter = useHunterStore.getState().hunter;
      expect(hunter.stats.intelligence).toBe(initialIntelligence + 1);
      // Intelligence increases max mana
      expect(hunter.maxMana).toBeGreaterThan(80);
    });

    it('should increase vitality and max HP', () => {
      const initialVitality = useHunterStore.getState().hunter.stats.vitality;
      const initialMaxHp = useHunterStore.getState().hunter.maxHp;

      useHunterStore.getState().allocateStat('vitality');

      const hunter = useHunterStore.getState().hunter;
      expect(hunter.stats.vitality).toBe(initialVitality + 1);
      expect(hunter.maxHp).toBeGreaterThan(initialMaxHp);
      expect(hunter.hp).toBe(hunter.maxHp); // HP should be set to new max
    });

    it('should not allocate when no stat points available', () => {
      useHunterStore.setState({
        hunter: {
          ...useHunterStore.getState().hunter,
          statPoints: 0,
        },
      });

      const initialStrength = useHunterStore.getState().hunter.stats.strength;

      useHunterStore.getState().allocateStat('strength');

      const hunter = useHunterStore.getState().hunter;
      expect(hunter.stats.strength).toBe(initialStrength);
      expect(hunter.statPoints).toBe(0);
    });
  });
});
