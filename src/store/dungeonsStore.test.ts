import { describe, it, expect, beforeEach } from 'vitest';
import { useDungeonsStore } from './dungeonsStore';

describe('dungeonsStore', () => {
  beforeEach(() => {
    useDungeonsStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have dungeons loaded', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      expect(dungeons.length).toBeGreaterThan(0);
    });

    it('should have no active dungeons initially', () => {
      const activeDungeons = useDungeonsStore.getState().activeDungeons;
      expect(activeDungeons).toEqual([]);
    });

    it('should have first dungeon unlocked', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const firstDungeon = dungeons[0];
      expect(firstDungeon.unlocked).toBe(true);
    });
  });

  describe('startDungeon', () => {
    it('should start a dungeon with valid party', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const unlockedDungeon = dungeons.find((d) => d.unlocked);
      expect(unlockedDungeon).toBeDefined();

      let successCalled = false;
      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, Date.now(), ['sung-jinwoo'], () => {
          successCalled = true;
        });

      expect(successCalled).toBe(true);
      expect(useDungeonsStore.getState().activeDungeons.length).toBe(1);
    });

    it('should not start a locked dungeon', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const lockedDungeon = dungeons.find((d) => !d.unlocked);

      if (!lockedDungeon) {
        // If all dungeons are unlocked in test data, unlock the first and lock a second
        return;
      }

      let successCalled = false;
      useDungeonsStore
        .getState()
        .startDungeon(lockedDungeon.id, Date.now(), ['sung-jinwoo'], () => {
          successCalled = true;
        });

      expect(successCalled).toBe(false);
      expect(useDungeonsStore.getState().activeDungeons.length).toBe(0);
    });

    it('should not allow starting dungeon with nonexistent dungeon id', () => {
      let successCalled = false;
      useDungeonsStore
        .getState()
        .startDungeon('nonexistent-dungeon-id', Date.now(), ['sung-jinwoo'], () => {
          successCalled = true;
        });

      expect(successCalled).toBe(false);
      expect(useDungeonsStore.getState().activeDungeons.length).toBe(0);
    });

    it('should track party members in active dungeon', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const unlockedDungeon = dungeons.find((d) => d.unlocked);

      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, Date.now(), ['sung-jinwoo', 'companion-1'], () => {});

      const activeDungeon = useDungeonsStore.getState().activeDungeons[0];
      expect(activeDungeon.partyIds).toContain('sung-jinwoo');
      expect(activeDungeon.partyIds).toContain('companion-1');
    });

    it('should prevent companions already in dungeon from joining another', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const unlockedDungeon = dungeons.find((d) => d.unlocked);

      // Start first dungeon with sung-jinwoo
      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, Date.now(), ['sung-jinwoo'], () => {});

      // Try to start second dungeon with same companion
      let secondSuccess = false;
      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, Date.now() + 1, ['sung-jinwoo'], () => {
          secondSuccess = true;
        });

      expect(secondSuccess).toBe(false);
      expect(useDungeonsStore.getState().activeDungeons.length).toBe(1);
    });

    it('should allow multiple dungeons with different parties', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const unlockedDungeon = dungeons.find((d) => d.unlocked);

      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, Date.now(), ['sung-jinwoo'], () => {});

      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, Date.now() + 1, ['companion-1'], () => {});

      expect(useDungeonsStore.getState().activeDungeons.length).toBe(2);
    });

    it('should set correct endTime based on dungeon duration', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const unlockedDungeon = dungeons.find((d) => d.unlocked);
      const startTime = Date.now();

      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, startTime, ['sung-jinwoo'], () => {});

      const activeDungeon = useDungeonsStore.getState().activeDungeons[0];
      expect(activeDungeon.startTime).toBe(startTime);
      expect(activeDungeon.endTime).toBe(startTime + unlockedDungeon!.duration * 1000);
    });
  });

  describe('completeDungeon', () => {
    it('should complete a dungeon when time is up', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const unlockedDungeon = dungeons.find((d) => d.unlocked);
      const startTime = Date.now() - 60000; // Started 60s ago

      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, startTime, ['sung-jinwoo'], () => {});

      const activeDungeonId = useDungeonsStore.getState().activeDungeons[0].id;

      let completedRewards: unknown = null;
      let completedName = '';
      useDungeonsStore
        .getState()
        .completeDungeon(activeDungeonId, Date.now(), (rewards, dungeonName) => {
          completedRewards = rewards;
          completedName = dungeonName;
        });

      expect(completedRewards).toBeDefined();
      expect(completedName).toBe(unlockedDungeon!.name);
      expect(useDungeonsStore.getState().activeDungeons.length).toBe(0);
    });

    it('should not complete dungeon before time is up', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const unlockedDungeon = dungeons.find((d) => d.unlocked);
      const startTime = Date.now();

      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, startTime, ['sung-jinwoo'], () => {});

      const activeDungeonId = useDungeonsStore.getState().activeDungeons[0].id;

      let callbackCalled = false;
      useDungeonsStore.getState().completeDungeon(
        activeDungeonId,
        startTime + 1000, // Only 1 second later
        () => {
          callbackCalled = true;
        }
      );

      expect(callbackCalled).toBe(false);
      expect(useDungeonsStore.getState().activeDungeons.length).toBe(1);
    });

    it('should remove completed dungeon from activeDungeons - freeing hunters', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const unlockedDungeon = dungeons.find((d) => d.unlocked);
      const startTime = Date.now() - 60000;

      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, startTime, ['sung-jinwoo', 'companion-1'], () => {});

      // Verify hunters are busy
      const activeDungeon = useDungeonsStore.getState().activeDungeons[0];
      expect(activeDungeon.partyIds).toContain('sung-jinwoo');

      // Complete the dungeon
      useDungeonsStore.getState().completeDungeon(activeDungeon.id, Date.now(), () => {});

      // Verify hunters are no longer in any active dungeon
      const remainingDungeons = useDungeonsStore.getState().activeDungeons;
      expect(remainingDungeons.length).toBe(0);

      // Now they should be able to start a new dungeon
      let canStartNew = false;
      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, Date.now(), ['sung-jinwoo'], () => {
          canStartNew = true;
        });
      expect(canStartNew).toBe(true);
    });

    it('should not complete nonexistent dungeon', () => {
      let callbackCalled = false;
      useDungeonsStore.getState().completeDungeon('nonexistent-id', Date.now(), () => {
        callbackCalled = true;
      });

      expect(callbackCalled).toBe(false);
    });

    it('should return correct rewards from dungeon', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const unlockedDungeon = dungeons.find((d) => d.unlocked);
      const startTime = Date.now() - 60000;

      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, startTime, ['sung-jinwoo'], () => {});

      const activeDungeonId = useDungeonsStore.getState().activeDungeons[0].id;

      let receivedRewards: unknown = null;
      useDungeonsStore.getState().completeDungeon(activeDungeonId, Date.now(), (rewards) => {
        receivedRewards = rewards;
      });

      expect(receivedRewards).toEqual(unlockedDungeon!.rewards);
    });
  });

  describe('cancelDungeon', () => {
    it('should cancel an active dungeon', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const unlockedDungeon = dungeons.find((d) => d.unlocked);

      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, Date.now(), ['sung-jinwoo'], () => {});

      const activeDungeonId = useDungeonsStore.getState().activeDungeons[0].id;
      useDungeonsStore.getState().cancelDungeon(activeDungeonId);

      expect(useDungeonsStore.getState().activeDungeons.length).toBe(0);
    });

    it('should free hunters when dungeon is cancelled', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const unlockedDungeon = dungeons.find((d) => d.unlocked);

      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, Date.now(), ['sung-jinwoo'], () => {});

      const activeDungeonId = useDungeonsStore.getState().activeDungeons[0].id;
      useDungeonsStore.getState().cancelDungeon(activeDungeonId);

      // Hunter should be free to start new dungeon
      let canStart = false;
      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, Date.now(), ['sung-jinwoo'], () => {
          canStart = true;
        });
      expect(canStart).toBe(true);
    });
  });

  describe('unlockDungeon', () => {
    it('should unlock a locked dungeon', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const lockedDungeon = dungeons.find((d) => !d.unlocked);

      if (!lockedDungeon) {
        // Skip if no locked dungeons
        return;
      }

      useDungeonsStore.getState().unlockDungeon(lockedDungeon.id);

      const updatedDungeon = useDungeonsStore
        .getState()
        .dungeons.find((d) => d.id === lockedDungeon.id);
      expect(updatedDungeon!.unlocked).toBe(true);
    });

    it('should allow starting previously locked dungeon after unlock', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const lockedDungeon = dungeons.find((d) => !d.unlocked);

      if (!lockedDungeon) {
        return;
      }

      // Try to start locked dungeon - should fail
      let startedWhileLocked = false;
      useDungeonsStore
        .getState()
        .startDungeon(lockedDungeon.id, Date.now(), ['sung-jinwoo'], () => {
          startedWhileLocked = true;
        });
      expect(startedWhileLocked).toBe(false);

      // Unlock it
      useDungeonsStore.getState().unlockDungeon(lockedDungeon.id);

      // Now should be able to start
      let startedAfterUnlock = false;
      useDungeonsStore
        .getState()
        .startDungeon(lockedDungeon.id, Date.now(), ['sung-jinwoo'], () => {
          startedAfterUnlock = true;
        });
      expect(startedAfterUnlock).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all active dungeons', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const unlockedDungeon = dungeons.find((d) => d.unlocked);

      useDungeonsStore
        .getState()
        .startDungeon(unlockedDungeon!.id, Date.now(), ['sung-jinwoo'], () => {});

      expect(useDungeonsStore.getState().activeDungeons.length).toBe(1);

      useDungeonsStore.getState().reset();

      expect(useDungeonsStore.getState().activeDungeons.length).toBe(0);
    });

    it('should reset dungeon unlock states', () => {
      const dungeons = useDungeonsStore.getState().dungeons;
      const lockedDungeon = dungeons.find((d) => !d.unlocked);

      if (!lockedDungeon) {
        return;
      }

      useDungeonsStore.getState().unlockDungeon(lockedDungeon.id);
      expect(
        useDungeonsStore.getState().dungeons.find((d) => d.id === lockedDungeon.id)!.unlocked
      ).toBe(true);

      useDungeonsStore.getState().reset();

      // Should be locked again after reset
      expect(
        useDungeonsStore.getState().dungeons.find((d) => d.id === lockedDungeon.id)!.unlocked
      ).toBe(false);
    });
  });
});
