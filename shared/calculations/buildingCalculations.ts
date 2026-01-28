import type { Resources, Building } from '../types.js';

/**
 * Calculate the cost of purchasing a building based on its current count
 */
export const calculateBuildingCost = (building: Building): Resources => {
  const multiplier = Math.pow(building.costMultiplier, building.count);

  return {
    essence: Math.floor(building.baseCost.essence * multiplier),
    crystals: Math.floor(building.baseCost.crystals * multiplier),
    gold: Math.floor(building.baseCost.gold * multiplier),
    souls: Math.floor(building.baseCost.souls * multiplier),
    attraction: Math.floor(building.baseCost.attraction * multiplier),
    gems: Math.floor(building.baseCost.gems * multiplier),
    knowledge: Math.floor(building.baseCost.knowledge * multiplier),
  };
};

/**
 * Check if player can afford a cost
 */
export const canAffordCost = (resources: Resources, cost: Resources): boolean => {
  return (
    resources.essence >= cost.essence &&
    resources.crystals >= cost.crystals &&
    resources.gold >= cost.gold &&
    resources.souls >= cost.souls &&
    resources.attraction >= cost.attraction &&
    resources.gems >= cost.gems &&
    resources.knowledge >= cost.knowledge
  );
};

/**
 * Deduct cost from resources
 */
export const deductCost = (resources: Resources, cost: Resources): Resources => {
  return {
    essence: resources.essence - cost.essence,
    crystals: resources.crystals - cost.crystals,
    gold: resources.gold - cost.gold,
    souls: resources.souls - cost.souls,
    attraction: resources.attraction - cost.attraction,
    gems: resources.gems - cost.gems,
    knowledge: resources.knowledge - cost.knowledge,
  };
};
