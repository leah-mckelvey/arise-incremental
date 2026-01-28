import type { Resources, HunterStats, Building, Research } from '../types.js';

// ResourceCaps is the same as Resources for now
type ResourceCaps = Resources;

/**
 * Calculate total resource caps based on base caps + building bonuses + research effects + hunter stats
 */
export const calculateResourceCaps = (
  baseCaps: ResourceCaps,
  buildings: Record<string, Building>,
  research: Record<string, Research>,
  hunterLevel: number = 1,
  hunterStats?: HunterStats
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

  // Apply hunter stat bonuses to caps (Sung Jinwoo as force multiplier)
  // Each stat point gives +1% to its associated resource cap
  if (hunterStats) {
    caps.essence *= (1 + hunterStats.strength / 100);
    caps.crystals *= (1 + hunterStats.sense / 100);
    caps.gold *= (1 + hunterStats.agility / 100);
    caps.souls *= (1 + hunterStats.vitality / 100);
    caps.knowledge *= (1 + hunterStats.intelligence / 100);
    // Attraction and gems scale with average of all stats
    const avgStat = (hunterStats.strength + hunterStats.agility + hunterStats.intelligence + hunterStats.vitality + hunterStats.sense) / 5;
    caps.attraction *= (1 + avgStat / 100);
    caps.gems *= (1 + avgStat / 100);
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
 * Calculate the total cost for purchasing multiple buildings
 * Uses geometric series formula for exponential cost scaling
 */
export const calculateBulkBuildingCost = (
  building: Building,
  quantity: number
): Resources => {
  const baseCost = building.baseCost;
  const multiplier = building.costMultiplier;
  const currentCount = building.count;

  // For each resource, calculate the sum of geometric series
  // Cost = baseCost * multiplier^n for the nth building
  // Total = baseCost * (multiplier^currentCount) * (1 - multiplier^quantity) / (1 - multiplier)
  const totalCost: Resources = {
    essence: 0,
    crystals: 0,
    gold: 0,
    souls: 0,
    attraction: 0,
    gems: 0,
    knowledge: 0,
  };

  Object.keys(baseCost).forEach((resource) => {
    const baseAmount = baseCost[resource as keyof Resources];
    if (baseAmount > 0) {
      // Sum of geometric series: a * (1 - r^n) / (1 - r)
      // where a = baseCost * multiplier^currentCount, r = multiplier, n = quantity
      const firstCost = baseAmount * Math.pow(multiplier, currentCount);
      const sum = firstCost * (1 - Math.pow(multiplier, quantity)) / (1 - multiplier);
      totalCost[resource as keyof Resources] = Math.floor(sum);
    }
  });

  return totalCost;
};

/**
 * Calculate the maximum number of buildings that can be purchased with current resources
 */
export const calculateMaxBuildingPurchases = (
  building: Building,
  currentResources: Resources
): number => {
  let maxQuantity = 0;

  // Binary search for the maximum quantity we can afford
  let low = 0;
  let high = 1000; // Reasonable upper limit

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cost = calculateBulkBuildingCost(building, mid);

    // Check if we can afford this quantity
    const canAfford = Object.keys(cost).every((resource) => {
      const resourceKey = resource as keyof Resources;
      return cost[resourceKey] <= currentResources[resourceKey];
    });

    if (canAfford) {
      maxQuantity = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return maxQuantity;
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
  globalMultiplier: number,
  hunterStats?: HunterStats
): Resources => {
  const gains: Resources = {
    essence: 0,
    crystals: 0,
    gold: 0,
    souls: 0,
    attraction: 0,
    gems: 0,
    knowledge: 0,
  };

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

          // Apply hunter stat bonuses (Sung Jinwoo as force multiplier)
          // Each stat point gives +0.5% to its associated resource production
          if (hunterStats) {
            if (resource === 'essence') {
              production *= (1 + hunterStats.strength / 200);
            } else if (resource === 'crystals') {
              production *= (1 + hunterStats.sense / 200);
            } else if (resource === 'gold') {
              production *= (1 + hunterStats.agility / 200);
            } else if (resource === 'souls') {
              production *= (1 + hunterStats.vitality / 200);
            } else if (resource === 'knowledge') {
              production *= (1 + hunterStats.intelligence / 200);
            } else {
              // Attraction and gems scale with average of all stats
              const avgStat = (hunterStats.strength + hunterStats.agility + hunterStats.intelligence + hunterStats.vitality + hunterStats.sense) / 5;
              production *= (1 + avgStat / 200);
            }
          }

          gains[resource] = gains[resource] + production;
        }
      });
    }
  });

  return gains;
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
  deltaTime: number,
  hunterStats?: HunterStats
): { resourceGains: Resources; xpGain: number } => {
  // Calculate global production multiplier
  const globalMultiplier = calculateGlobalProductionMultiplier(research, resources, hunterLevel);

  // Calculate resource production from buildings
  const resourceGains = calculateBuildingProduction(buildings, research, deltaTime, globalMultiplier, hunterStats);

  // Add knowledge production from training grounds
  const knowledgeProduction = calculateKnowledgeProduction(buildings, research, deltaTime);
  resourceGains.knowledge = (resourceGains.knowledge || 0) + knowledgeProduction;

  // Calculate XP gain from buildings
  const xpGain = calculateBuildingXpGain(buildings, deltaTime);

  return { resourceGains, xpGain };
};

