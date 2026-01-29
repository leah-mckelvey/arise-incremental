/**
 * Dungeon actions
 * Handles starting, canceling, completing dungeons and checking completions
 */

import { gameStore } from '../gameStore';
import { useDungeonsStore } from '../dungeonsStore';
import { useHunterStore } from '../hunterStore';
import { useAlliesStore } from '../alliesStore';
import { useShadowsStore } from '../shadowsStore';
import { useNotificationsStore } from '../notificationsStore';
import * as gameApi from '../../api/gameApi';
import { syncServerState } from './syncActions';
import { handleLevelUp } from './hunterActions';

// Track which dungeons are currently being completed to prevent double-completion
const completingDungeons = new Set<string>();

export const startDungeon = async (dungeonId: string, partyIds: string[] = []) => {
  const currentTime = Date.now();

  // Store previous state for rollback
  const previousActiveDungeons = useDungeonsStore.getState().activeDungeons;

  // Optimistic update
  useDungeonsStore.getState().startDungeon(dungeonId, currentTime, partyIds, () => {
    console.log('🏰 Dungeon started successfully');
  });

  // Check if the dungeon actually started (dungeonsStore validates locked/busy companions)
  const currentActiveDungeons = useDungeonsStore.getState().activeDungeons;
  if (currentActiveDungeons === previousActiveDungeons) {
    // No change - validation failed (dungeon locked or companions busy)
    return;
  }

  // Track pending mutation
  gameStore.setState((s) => ({ pendingMutations: s.pendingMutations + 1 }));

  try {
    // Background API call
    const response = await gameApi.startDungeon(dungeonId, partyIds);
    // Success - sync server state
    syncServerState(response.state);
  } catch (error) {
    // Rollback on error
    useDungeonsStore.setState({ activeDungeons: previousActiveDungeons });
    console.error('Failed to start dungeon:', error);
    useNotificationsStore
      .getState()
      .addNotification(
        'error',
        'Dungeon Start Failed',
        'Failed to start dungeon. Please try again.',
        undefined,
        5000
      );
  } finally {
    gameStore.setState((s) => ({ pendingMutations: s.pendingMutations - 1 }));
  }
};

export const cancelDungeon = async (activeDungeonId: string) => {
  // Store previous state for rollback
  const previousActiveDungeons = useDungeonsStore.getState().activeDungeons;

  // Optimistic update
  useDungeonsStore.getState().cancelDungeon(activeDungeonId);

  // Track pending mutation
  gameStore.setState((s) => ({ pendingMutations: s.pendingMutations + 1 }));

  try {
    // Background API call
    const response = await gameApi.cancelDungeon(activeDungeonId);
    // Success - sync server state
    syncServerState(response.state);
  } catch (error) {
    // Rollback on error
    useDungeonsStore.setState({ activeDungeons: previousActiveDungeons });
    console.error('Failed to cancel dungeon:', error);
    useNotificationsStore
      .getState()
      .addNotification(
        'error',
        'Cancel Failed',
        'Failed to cancel dungeon. Please try again.',
        undefined,
        5000
      );
  } finally {
    gameStore.setState((s) => ({ pendingMutations: s.pendingMutations - 1 }));
  }
};

// Check and complete dungeons if time is up (called from tick)
export const checkDungeonCompletion = () => {
  const activeDungeons = useDungeonsStore.getState().activeDungeons;
  if (activeDungeons.length === 0) return;

  const currentTime = Date.now();

  // Check each active dungeon
  activeDungeons.forEach((activeDungeon) => {
    if (currentTime >= activeDungeon.endTime && !completingDungeons.has(activeDungeon.id)) {
      // Mark as completing to prevent double-completion
      completingDungeons.add(activeDungeon.id);

      // Call the async completion function
      completeDungeonWithApi(activeDungeon.id).finally(() => {
        completingDungeons.delete(activeDungeon.id);
      });
    }
  });
};

// Complete a dungeon by calling the backend API
const completeDungeonWithApi = async (activeDungeonId: string) => {
  const currentTime = Date.now();

  // Get the active dungeon info before we remove it
  const activeDungeon = useDungeonsStore
    .getState()
    .activeDungeons.find((ad) => ad.id === activeDungeonId);
  if (!activeDungeon) {
    console.warn('Active dungeon not found for completion:', activeDungeonId);
    return;
  }

  const dungeon = useDungeonsStore
    .getState()
    .dungeons.find((d) => d.id === activeDungeon.dungeonId);
  if (!dungeon) {
    console.warn('Dungeon definition not found:', activeDungeon.dungeonId);
    return;
  }

  // Store previous state for rollback
  // processRewards can modify: resources, resourceCaps (via handleLevelUp), hunter,
  // dungeon unlocks, necromancer unlock, allies (XP + drops), shadows (XP + drops)
  const previousActiveDungeons = useDungeonsStore.getState().activeDungeons;
  const previousDungeons = useDungeonsStore.getState().dungeons;
  const previousResources = gameStore.getState().resources;
  const previousResourceCaps = gameStore.getState().resourceCaps;
  const previousHunter = useHunterStore.getState().hunter;
  const previousNecromancerUnlocked = useShadowsStore.getState().necromancerUnlocked;
  const previousAllies = useAlliesStore.getState().allies;
  const previousShadows = useShadowsStore.getState().shadows;

  // Optimistic update - remove dungeon from active list locally
  useDungeonsStore
    .getState()
    .completeDungeon(activeDungeonId, currentTime, (rewards, dungeonName) => {
      // Calculate companion effectiveness based on their level vs Sung Jinwoo's level
      const hunterLevel = useHunterStore.getState().hunter.level;
      let companionEffectiveness = 0;

      if (activeDungeon.partyIds && activeDungeon.partyIds.length > 0) {
        activeDungeon.partyIds.forEach((companionId) => {
          // Find the companion
          const ally = useAlliesStore.getState().allies.find((a) => a.id === companionId);
          const shadow = useShadowsStore.getState().shadows.find((s) => s.id === companionId);
          const companion = ally || shadow;

          if (companion) {
            // Companion effectiveness = their level / hunter level
            // Guard against division by zero (hunterLevel should always be >= 1)
            const effectiveness = hunterLevel > 0 ? companion.level / hunterLevel : 0;
            companionEffectiveness += effectiveness;
          }
        });
      }

      // CONTINUED IN NEXT SECTION - processRewards function handles rest
      processRewards(rewards, companionEffectiveness, activeDungeon, dungeon, dungeonName);
    });

  // Track pending mutation to prevent sync conflicts
  gameStore.setState((s) => ({ pendingMutations: s.pendingMutations + 1 }));

  try {
    // Call backend API to complete dungeon
    const response = await gameApi.completeDungeon(activeDungeonId);
    // Success - sync server state (resources, hunter, activeDungeons)
    syncServerState(response.state);
    console.log('✅ Dungeon completion synced with server');
  } catch (error) {
    // Rollback on error - restore ALL previous state
    // processRewards may have modified: resources, resourceCaps, hunter,
    // dungeon unlocks, necromancer unlock, allies, shadows
    useDungeonsStore.setState({
      activeDungeons: previousActiveDungeons,
      dungeons: previousDungeons,
    });
    gameStore.setState({
      resources: previousResources,
      resourceCaps: previousResourceCaps,
    });
    useHunterStore.setState({ hunter: previousHunter });
    useShadowsStore.setState({
      necromancerUnlocked: previousNecromancerUnlocked,
      shadows: previousShadows,
    });
    useAlliesStore.setState({ allies: previousAllies });
    console.error('Failed to complete dungeon on server:', error);
    useNotificationsStore
      .getState()
      .addNotification(
        'error',
        'Sync Failed',
        'Dungeon completed locally but failed to sync with server. Your progress may be lost on refresh.',
        undefined,
        8000
      );
  } finally {
    gameStore.setState((s) => ({ pendingMutations: s.pendingMutations - 1 }));
  }
};

// Helper function to process dungeon rewards
interface DungeonRewards {
  essence: number;
  crystals: number;
  gold: number;
  souls: number;
  attraction: number;
  gems: number;
  knowledge: number;
  experience: number;
}

interface ActiveDungeon {
  id: string;
  dungeonId: string;
  partyIds?: string[];
  startTime: number;
  endTime: number;
}

interface Dungeon {
  id: string;
  name: string;
  type: 'solo' | 'alliance';
  companionDropChance?: number;
  companionNames?: string[];
}

const processRewards = (
  rewards: DungeonRewards,
  companionEffectiveness: number,
  activeDungeon: ActiveDungeon,
  dungeon: Dungeon,
  dungeonName: string
) => {
  // Total multiplier = 1 (Sung Jinwoo) + companion effectiveness
  const rewardMultiplier = 1 + companionEffectiveness;

  // Multiply all rewards by effectiveness
  const multipliedRewards = {
    essence: Math.floor(rewards.essence * rewardMultiplier),
    crystals: Math.floor(rewards.crystals * rewardMultiplier),
    gold: Math.floor(rewards.gold * rewardMultiplier),
    souls: Math.floor(rewards.souls * rewardMultiplier),
    attraction: Math.floor(rewards.attraction * rewardMultiplier),
    gems: Math.floor(rewards.gems * rewardMultiplier),
    knowledge: Math.floor(rewards.knowledge * rewardMultiplier),
    experience: Math.floor(rewards.experience * rewardMultiplier),
  };

  // Grant all rewards (clamped to caps)
  const currentResources = gameStore.getState().resources;
  const currentCaps = gameStore.getState().resourceCaps;
  gameStore.setState({
    resources: {
      essence: Math.min(currentCaps.essence, currentResources.essence + multipliedRewards.essence),
      crystals: Math.min(
        currentCaps.crystals,
        currentResources.crystals + multipliedRewards.crystals
      ),
      gold: Math.min(currentCaps.gold, currentResources.gold + multipliedRewards.gold),
      souls: Math.min(currentCaps.souls, currentResources.souls + multipliedRewards.souls),
      attraction: Math.min(
        currentCaps.attraction,
        currentResources.attraction + multipliedRewards.attraction
      ),
      gems: Math.min(currentCaps.gems, currentResources.gems + multipliedRewards.gems),
      knowledge: Math.min(
        currentCaps.knowledge,
        currentResources.knowledge + multipliedRewards.knowledge
      ),
    },
  });

  // Grant hunter XP
  useHunterStore.getState().addXp(multipliedRewards.experience, (newLevel) => {
    console.log(`🎉 Leveled up to ${newLevel}!`);
    handleLevelUp(newLevel);
  });

  // Grant XP to companions in party
  grantCompanionXp(activeDungeon.partyIds, rewards.experience);

  // Check for companion drop
  checkCompanionDrop(dungeon);

  // Show completion notification
  const partySize = activeDungeon.partyIds?.length || 0;
  useNotificationsStore.getState().addNotification(
    'dungeon_complete',
    'Dungeon Complete!',
    partySize > 0
      ? `${dungeonName} cleared with ${partySize} companion${partySize > 1 ? 's' : ''}! (${rewardMultiplier.toFixed(2)}x rewards)`
      : `${dungeonName} cleared successfully!`,
    multipliedRewards,
    6000 // 6 seconds
  );

  console.log('🎉 Dungeon rewards granted!', multipliedRewards);
};

const grantCompanionXp = (partyIds: string[] | undefined, baseExperience: number) => {
  if (!partyIds || partyIds.length === 0) return;

  const companionXp = Math.floor(baseExperience * 0.5); // Companions get 50% of base XP

  partyIds.forEach((companionId) => {
    // Check if it's an ally or shadow
    const ally = useAlliesStore.getState().allies.find((a) => a.id === companionId);
    if (ally) {
      useAlliesStore.getState().addXpToAlly(companionId, companionXp);
    } else {
      const shadow = useShadowsStore.getState().shadows.find((s) => s.id === companionId);
      if (shadow) {
        useShadowsStore.getState().addXpToShadow(companionId, companionXp);
      }
    }
  });
};

const checkCompanionDrop = (dungeon: Dungeon) => {
  if (!dungeon.companionDropChance || !dungeon.companionNames?.length) return;

  // Filter out companions you already have
  let availableCompanionNames: string[] = [];

  if (dungeon.type === 'alliance') {
    const existingAllyNames = useAlliesStore
      .getState()
      .allies.filter((a) => a.originDungeonId === dungeon.id)
      .map((a) => a.name);
    availableCompanionNames = dungeon.companionNames.filter(
      (name) => !existingAllyNames.includes(name)
    );
  } else if (dungeon.type === 'solo') {
    const existingShadowNames = useShadowsStore
      .getState()
      .shadows.filter((s) => s.originDungeonId === dungeon.id)
      .map((s) => s.name);
    availableCompanionNames = dungeon.companionNames.filter(
      (name) => !existingShadowNames.includes(name)
    );
  }

  // Only roll if there are companions left to recruit
  if (availableCompanionNames.length === 0) {
    console.log(`✅ All companions from ${dungeon.name} already recruited!`);
    return;
  }

  const roll = Math.random();
  console.log(
    `🎲 Companion drop roll: ${roll.toFixed(3)} vs ${dungeon.companionDropChance} (${dungeon.name})`
  );
  console.log(
    `   Available companions: ${availableCompanionNames.join(', ')} (${availableCompanionNames.length}/${dungeon.companionNames.length})`
  );

  if (roll < dungeon.companionDropChance) {
    // Randomly select from available companions
    const randomName =
      availableCompanionNames[Math.floor(Math.random() * availableCompanionNames.length)];
    console.log(`✅ Companion dropped! Type: ${dungeon.type}, Name: ${randomName}`);

    if (dungeon.type === 'alliance') {
      // Recruit ally
      const newAlly = useAlliesStore.getState().recruitAlly(randomName, dungeon.id);
      console.log(`🤝 Recruited ally:`, newAlly);
      useNotificationsStore
        .getState()
        .addNotification(
          'unlock',
          'New Ally Recruited!',
          `${newAlly.name} has joined your cause!`,
          undefined,
          6000
        );
    } else if (dungeon.type === 'solo' && useShadowsStore.getState().necromancerUnlocked) {
      // Extract shadow (only if necromancer unlocked)
      const newShadow = useShadowsStore.getState().extractShadow(randomName, dungeon.id);
      console.log(`👻 Extracted shadow:`, newShadow);
      if (newShadow) {
        useNotificationsStore
          .getState()
          .addNotification(
            'unlock',
            'Shadow Extracted!',
            `${newShadow.name} has been added to your shadow army!`,
            undefined,
            6000
          );
      }
    }
  } else {
    console.log(`❌ No companion dropped this time`);
  }
};
