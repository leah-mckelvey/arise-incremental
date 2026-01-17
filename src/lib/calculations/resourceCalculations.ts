import type { Resources, ResourceCaps, HunterStats } from '../../store/types';
import type { Building } from '../../store/buildingsStore';
import type { Research } from '../../store/researchStore';

/**
 * Calculate total resource caps based on base caps + building bonuses + research effects
 */
export const calculateResourceCaps = (
  baseCaps: ResourceCaps,
  buildings: Record<string, Building>,
  research: Record<string, Research>,
  hunterLevel: number = 1
): ResourceCaps => {
  const caps = { ...baseCaps };

  // Add building cap increases
  Object.values(buildings).forEach((building) => {
    if (building.increasesCaps && building.count > 0) {
      (Object.keys(building.increasesCaps) as Array<keyof ResourceCaps>).forEach((resource) => {
        const increase = building.increasesCaps![resource];
        if (increase) {
          caps[resource] = caps[resource] + increase * building.count;
        }
      });
    }
  });
  
  // Apply research multipliers
  const researchedTechs = Object.values(research).filter(r => r.researched);
  researchedTechs.forEach(tech => {
    if (tech.effects?.capMultiplier) {
      Object.entries(tech.effects.capMultiplier).forEach(([resource, multiplier]) => {
        if (multiplier) {
          caps[resource as keyof ResourceCaps] *= multiplier;
        }
      });
    }
    
    if (tech.effects?.capIncrease) {
      Object.entries(tech.effects.capIncrease).forEach(([resource, increase]) => {
        if (increase) {
          caps[resource as keyof ResourceCaps] += increase;
        }
      });
    }
  });
  
  // Apply Transcendence: +10% caps per hunter level
  if (research.transcendence?.researched) {
    const levelMultiplier = 1 + (hunterLevel * 0.1);
    Object.keys(caps).forEach((resource) => {
      caps[resource as keyof ResourceCaps] *= levelMultiplier;
    });
  }

  return caps;
};

/**
 * Calculate gathering amount for a resource based on hunter stats and research
 */
export const calculateGatherAmount = (
  resource: 'essence' | 'crystals' | 'gold',
  hunterStats: HunterStats,
  research: Record<string, Research>
): number => {
  const baseGatherAmounts: Record<typeof resource, number> = {
    essence: 1,
    crystals: 0.5,
    gold: 2,
  };

  const statBonuses: Record<typeof resource, keyof HunterStats> = {
    essence: 'sense',
    crystals: 'intelligence',
    gold: 'agility',
  };

  const baseStat = hunterStats[statBonuses[resource]];
  let amount = baseGatherAmounts[resource] * (1 + baseStat / 100);

  // Apply research bonuses
  const researchedTechs = Object.values(research).filter(r => r.researched);
  researchedTechs.forEach(tech => {
    if (tech.effects?.gatheringBonus?.[resource]) {
      amount *= (1 + tech.effects.gatheringBonus[resource]!);
    }
  });

  return amount;
};

/**
 * Calculate XP gain from gathering
 */
export const calculateGatherXp = (
  resource: 'essence' | 'crystals' | 'gold',
  hunterStats: HunterStats
): number => {
  const statBonuses: Record<typeof resource, keyof HunterStats> = {
    essence: 'sense',
    crystals: 'intelligence',
    gold: 'agility',
  };

  const baseStat = hunterStats[statBonuses[resource]];
  return 0.1 * (1 + baseStat / 200);
};

/**
 * Calculate global production multiplier from research
 */
export const calculateGlobalProductionMultiplier = (
  research: Record<string, Research>,
  resources: Resources,
  hunterLevel: number
): number => {
  let multiplier = 1.0;

  if (research.shadowEconomy?.researched) {
    multiplier *= (1 + resources.souls * 0.01);
  }

  if (research.knowledgeLoop?.researched) {
    const knowledgeBonus = Math.floor(resources.knowledge / 100) * 0.05;
    multiplier *= (1 + knowledgeBonus);
  }

  if (research.transcendence?.researched) {
    multiplier *= (1 + hunterLevel * 0.01);
  }

  return multiplier;
};

/**
 * Calculate building efficiency multiplier from research
 */
export const calculateBuildingEfficiency = (
  buildingId: string,
  research: Record<string, Research>
): number => {
  let efficiency = 1.0;

  const researchedTechs = Object.values(research).filter(r => r.researched);
  researchedTechs.forEach(tech => {
    if (tech.effects?.buildingEfficiency?.[buildingId]) {
      efficiency *= tech.effects.buildingEfficiency[buildingId];
    }
  });

  return efficiency;
};

/**
 * Calculate synergy multiplier for a specific building
 */
export const calculateBuildingSynergy = (
  buildingId: string,
  buildings: Record<string, Building>,
  research: Record<string, Research>
): number => {
  let synergy = 1.0;

  // Mana Resonance: Essence Extractors gain +25% per Crystal Mine
  if (buildingId === 'essenceExtractor' && research.manaResonance?.researched) {
    const crystalMines = buildings.crystalMine?.count || 0;
    synergy *= (1 + crystalMines * 0.25);
  }

  // Crystal Synergy: Crystal Mines gain +10% per Essence Vault
  if (buildingId === 'crystalMine' && research.crystalSynergy?.researched) {
    const essenceVaults = buildings.essenceVault?.count || 0;
    synergy *= (1 + essenceVaults * 0.1);
  }

  // Guild Network: Hunter Guilds gain +5% per other Hunter Guild
  if (buildingId === 'hunterGuild' && research.guildNetwork?.researched) {
    const guildCount = buildings.hunterGuild?.count || 0;
    synergy *= (1 + (guildCount - 1) * 0.05);
  }

  return synergy;
};

/**
 * Calculate knowledge production from training grounds
 */
export const calculateKnowledgeProduction = (
  buildings: Record<string, Building>,
  research: Record<string, Research>,
  deltaTime: number
): number => {
  let knowledgeProduction = 0;

  const trainingGround = buildings.trainingGround;
  if (trainingGround && research.knowledgeGeneration?.researched) {
    knowledgeProduction = trainingGround.count * 0.1 * deltaTime;

    // Compounded Learning: Each Training Ground increases knowledge production by 10%
    if (research.compoundedLearning?.researched) {
      knowledgeProduction *= Math.pow(1.1, trainingGround.count);
    }
  }

  return knowledgeProduction;
};

/**
 * Calculate XP gain from buildings
 */
export const calculateBuildingXpGain = (
  buildings: Record<string, Building>,
  deltaTime: number
): number => {
  let xpGain = 0;

  Object.values(buildings).forEach((building) => {
    if (building.xpPerSecond) {
      xpGain += building.count * building.xpPerSecond * deltaTime;
    }
  });

  return xpGain;
};

/**
 * Calculate resource production from buildings over time
 * This is a comprehensive function that applies all bonuses and synergies
 */
export const calculateBuildingProduction = (
  buildings: Record<string, Building>,
  research: Record<string, Research>,
  deltaTime: number,
  globalMultiplier: number
): Resources => {
  const gains: Partial<Resources> = {};

  Object.values(buildings).forEach((building) => {
    if (building.produces && building.perSecond) {
      (Object.keys(building.produces) as Array<keyof Resources>).forEach((resource) => {
        const amount = building.produces![resource];
        if (amount) {
          let production = amount * building.count * building.perSecond! * deltaTime;

          // Apply building efficiency bonuses from research
          production *= calculateBuildingEfficiency(building.id, research);

          // Apply synergy bonuses
          production *= calculateBuildingSynergy(building.id, buildings, research);

          // Apply global multiplier
          production *= globalMultiplier;

          gains[resource] = (gains[resource] || 0) + production;
        }
      });
    }
  });

  return gains as Resources;
};

/**
 * Calculate all resource and XP gains for a tick
 * This is the main orchestration function for tick calculations
 */
export const calculateTickGains = (
  buildings: Record<string, Building>,
  research: Record<string, Research>,
  resources: Resources,
  hunterLevel: number,
  deltaTime: number
): { resourceGains: Resources; xpGain: number } => {
  // Calculate global production multiplier
  const globalMultiplier = calculateGlobalProductionMultiplier(research, resources, hunterLevel);

  // Calculate resource production from buildings
  const resourceGains = calculateBuildingProduction(buildings, research, deltaTime, globalMultiplier);

  // Add knowledge production from training grounds
  const knowledgeProduction = calculateKnowledgeProduction(buildings, research, deltaTime);
  resourceGains.knowledge = (resourceGains.knowledge || 0) + knowledgeProduction;

  // Calculate XP gain from buildings
  const xpGain = calculateBuildingXpGain(buildings, deltaTime);

  return { resourceGains, xpGain };
};

