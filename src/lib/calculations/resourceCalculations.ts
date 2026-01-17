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
 * Calculate resource production from buildings over time
 */
export const calculateBuildingProduction = (
  buildings: Record<string, Building>,
  deltaTime: number,
  globalMultiplier: number
): Resources => {
  const gains: Partial<Resources> = {};

  Object.values(buildings).forEach((building) => {
    if (building.produces && building.perSecond) {
      (Object.keys(building.produces) as Array<keyof Resources>).forEach((resource) => {
        const amount = building.produces![resource];
        if (amount) {
          const production = amount * building.count * building.perSecond * deltaTime * globalMultiplier;
          gains[resource] = (gains[resource] || 0) + production;
        }
      });
    }
  });

  return gains as Resources;
};

