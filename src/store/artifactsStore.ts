import { createStore } from '@ts-query/core';
import type { Artifact, ArtifactSlot, ArtifactRank, EquippedArtifacts, Resources, ArtifactUpgrade } from './types';
import { createInitialEquippedArtifacts, availableUpgrades, calculateUpgradeCost, calculateUpgradeBlacksmithXpCost } from '../data/initialArtifacts';
import { calculateCraftCost, calculateBlacksmithXpToNextLevel } from '../lib/calculations/artifactCalculations';
import { rollTier, rollStats, generateArtifactName, getTierMaxUpgrades } from '../lib/lootGenerator';

const STORAGE_KEY = 'arise-artifacts-state';

export interface ArtifactsState {
  equipped: EquippedArtifacts;
  inventory: Artifact[];
  blacksmithLevel: number;
  blacksmithXp: number;
  blacksmithXpToNextLevel: number;

  // Actions
  craftArtifact: (rank: ArtifactRank, slot: ArtifactSlot, resources: Resources, onSuccess: (cost: Resources, newArtifact: Artifact) => void) => void;
  equipArtifact: (artifact: Artifact) => void;
  unequipArtifact: (slot: ArtifactSlot) => void;
  upgradeArtifact: (artifactId: string, upgradeId: string, resources: Resources, onSuccess: (cost: Resources, blacksmithXpGain: number) => void) => void;
  destroyArtifact: (artifactId: string, onSuccess: (essenceGain: number) => void) => void;
  destroyArtifactsUnderRank: (maxRank: ArtifactRank, onSuccess: (essenceGain: number, count: number) => void) => void;
  addBlacksmithXp: (xp: number, onLevelUp?: (newLevel: number) => void) => void;
  reset: () => void;
}

const initialState = {
  equipped: createInitialEquippedArtifacts(),
  inventory: [] as Artifact[],
  blacksmithLevel: 1,
  blacksmithXp: 0,
  blacksmithXpToNextLevel: calculateBlacksmithXpToNextLevel(1),
};

const loadPersistedState = (): Partial<ArtifactsState> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load artifacts state:', error);
  }
  return null;
};

const persistState = (state: ArtifactsState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      equipped: state.equipped,
      inventory: state.inventory,
      blacksmithLevel: state.blacksmithLevel,
      blacksmithXp: state.blacksmithXp,
      blacksmithXpToNextLevel: state.blacksmithXpToNextLevel,
    }));
  } catch (error) {
    console.error('Failed to persist artifacts state:', error);
  }
};

export const useArtifactsStore = createStore<ArtifactsState>((set, get) => {
  const persisted = loadPersistedState();
  const mergedState = persisted ? { ...initialState, ...persisted } : initialState;

  const store: ArtifactsState = {
    ...mergedState,

    craftArtifact: (rank, slot, resources, onSuccess) => {
      const cost = calculateCraftCost(rank, slot);

      // Check if player can afford
      const canAfford = (Object.keys(cost) as Array<keyof Resources>).every(
        (resource) => resources[resource] >= cost[resource]
      );

      if (!canAfford) {
        console.warn('Cannot afford to craft artifact');
        return;
      }

      const state = get();

      // Roll tier based on blacksmith level
      const tier = rollTier(state.blacksmithLevel);

      // Roll stats based on tier
      const baseStats = rollStats(rank, slot, tier);

      // Generate procedural name
      const name = generateArtifactName(slot, tier, baseStats);

      // Create new artifact with loot system
      const newArtifact: Artifact = {
        id: `${slot}-${rank}-${tier}-${Date.now()}`,
        name,
        description: `A ${tier} ${rank}-rank ${slot} crafted by the blacksmith`,
        rank,
        tier,
        slot,
        baseStats,
        upgrades: [],
        maxUpgrades: getTierMaxUpgrades(tier),
        craftCost: cost,
      };

      console.log(`🎲 Crafted ${tier} artifact:`, name, baseStats);

      set((state) => ({
        inventory: [...state.inventory, newArtifact],
      }));

      // Callback to deduct resources
      onSuccess(cost, newArtifact);
      persistState(get());
    },

    equipArtifact: (artifact) => {
      set((state) => {
        // Remove from inventory
        const newInventory = state.inventory.filter((a) => a.id !== artifact.id);
        
        // Unequip current item in slot if exists
        const currentlyEquipped = state.equipped[artifact.slot];
        if (currentlyEquipped) {
          newInventory.push(currentlyEquipped);
        }

        return {
          inventory: newInventory,
          equipped: {
            ...state.equipped,
            [artifact.slot]: artifact,
          },
        };
      });
      persistState(get());
    },

    unequipArtifact: (slot) => {
      set((state) => {
        const artifact = state.equipped[slot];
        if (!artifact) return state;

        return {
          inventory: [...state.inventory, artifact],
          equipped: {
            ...state.equipped,
            [slot]: undefined,
          },
        };
      });
      persistState(get());
    },

    upgradeArtifact: (artifactId, upgradeId, resources, onSuccess) => {
      const state = get();

      // Find artifact (in inventory or equipped)
      let artifact = state.inventory.find((a) => a.id === artifactId);
      let isEquipped = false;

      if (!artifact) {
        artifact = Object.values(state.equipped).find((a) => a?.id === artifactId);
        isEquipped = true;
      }

      if (!artifact) {
        console.warn('Artifact not found');
        return;
      }

      if (artifact.upgrades.length >= artifact.maxUpgrades) {
        console.warn('Artifact has max upgrades');
        return;
      }

      const upgradeTemplate = availableUpgrades[upgradeId];
      if (!upgradeTemplate) {
        console.warn('Upgrade template not found');
        return;
      }

      const cost = calculateUpgradeCost(artifact.rank, artifact.upgrades.length);
      const blacksmithXpGain = calculateUpgradeBlacksmithXpCost(artifact.rank, artifact.upgrades.length);

      // Check affordability (only resources, not XP - upgrades GIVE XP!)
      const canAfford = (Object.keys(cost) as Array<keyof Resources>).every(
        (resource) => resources[resource] >= cost[resource]
      );

      if (!canAfford) {
        console.warn('Cannot afford upgrade', { cost, resources });
        return;
      }

      // Create upgrade
      const newUpgrade: ArtifactUpgrade = {
        ...upgradeTemplate,
        cost,
        blacksmithXpCost: blacksmithXpGain,
      };

      // Apply upgrade
      const upgradedArtifact = {
        ...artifact,
        upgrades: [...artifact.upgrades, newUpgrade],
      };

      console.log(`⚒️ Upgraded ${artifact.name} with ${upgradeTemplate.name} (+${blacksmithXpGain} blacksmith XP)`);

      if (isEquipped) {
        set((state) => ({
          equipped: {
            ...state.equipped,
            [artifact!.slot]: upgradedArtifact,
          },
        }));
      } else {
        set((state) => ({
          inventory: state.inventory.map((a) => (a.id === artifactId ? upgradedArtifact : a)),
        }));
      }

      onSuccess(cost, blacksmithXpGain);
      persistState(get());
    },

    destroyArtifact: (artifactId, onSuccess) => {
      const state = get();
      const artifact = state.inventory.find((a) => a.id === artifactId);

      if (!artifact) {
        console.warn('Artifact not found in inventory');
        return;
      }

      // Calculate essence gain based on rank and tier
      const rankValues: Record<ArtifactRank, number> = {
        E: 5,
        D: 15,
        C: 40,
        B: 100,
        A: 250,
        S: 600,
      };

      const tierMultipliers = {
        Common: 1,
        Uncommon: 1.5,
        Rare: 2.5,
        Epic: 4,
        Legendary: 7,
      };

      const baseEssence = rankValues[artifact.rank];
      const tierMult = tierMultipliers[artifact.tier];
      const upgradeBonus = artifact.upgrades.length * 5; // +5 essence per upgrade
      const essenceGain = Math.floor(baseEssence * tierMult + upgradeBonus);

      console.log(`💥 Destroyed ${artifact.name} for ${essenceGain} essence`);

      set((state) => ({
        inventory: state.inventory.filter((a) => a.id !== artifactId),
      }));

      onSuccess(essenceGain);
      persistState(get());
    },

    destroyArtifactsUnderRank: (maxRank, onSuccess) => {
      const state = get();
      const rankOrder: ArtifactRank[] = ['E', 'D', 'C', 'B', 'A', 'S'];
      const maxRankIndex = rankOrder.indexOf(maxRank);

      if (maxRankIndex === -1) {
        console.warn('Invalid rank');
        return;
      }

      // Find all artifacts at or below the specified rank
      const artifactsToDestroy = state.inventory.filter((artifact) => {
        const artifactRankIndex = rankOrder.indexOf(artifact.rank);
        return artifactRankIndex <= maxRankIndex;
      });

      if (artifactsToDestroy.length === 0) {
        console.warn('No artifacts to destroy');
        return;
      }

      // Calculate total essence gain
      const rankValues: Record<ArtifactRank, number> = {
        E: 5,
        D: 15,
        C: 40,
        B: 100,
        A: 250,
        S: 600,
      };

      const tierMultipliers = {
        Common: 1,
        Uncommon: 1.5,
        Rare: 2.5,
        Epic: 4,
        Legendary: 7,
      };

      let totalEssence = 0;
      artifactsToDestroy.forEach((artifact) => {
        const baseEssence = rankValues[artifact.rank];
        const tierMult = tierMultipliers[artifact.tier];
        const upgradeBonus = artifact.upgrades.length * 5;
        totalEssence += Math.floor(baseEssence * tierMult + upgradeBonus);
      });

      console.log(`💥 Destroyed ${artifactsToDestroy.length} artifacts (≤${maxRank}-Rank) for ${totalEssence} essence`);

      set((state) => ({
        inventory: state.inventory.filter((artifact) => {
          const artifactRankIndex = rankOrder.indexOf(artifact.rank);
          return artifactRankIndex > maxRankIndex;
        }),
      }));

      onSuccess(totalEssence, artifactsToDestroy.length);
      persistState(get());
    },

    addBlacksmithXp: (xp, onLevelUp) => {
      set((state) => {
        let newXp = state.blacksmithXp + xp;
        let newLevel = state.blacksmithLevel;
        let xpToNext = state.blacksmithXpToNextLevel;

        while (newXp >= xpToNext) {
          newXp -= xpToNext;
          newLevel += 1;
          xpToNext = calculateBlacksmithXpToNextLevel(newLevel);
          if (onLevelUp) onLevelUp(newLevel);
        }

        return {
          blacksmithXp: newXp,
          blacksmithLevel: newLevel,
          blacksmithXpToNextLevel: xpToNext,
        };
      });
      persistState(get());
    },

    reset: () => {
      set(initialState);
      persistState(get());
    },
  };

  return store;
});

useArtifactsStore.subscribe((state) => {
  persistState(state);
});

