import { createStore } from '@ts-query/core';

// Hunter rank types
export type HunterRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'National';
export type HunterClass = 'Hunter' | 'Necromancer';

// Hunter stats
export interface HunterStats {
  strength: number;     // Affects damage & resource gathering
  agility: number;      // Affects speed & crit chance
  intelligence: number; // Affects mana & shadow capacity
  vitality: number;     // Affects HP & regeneration
}

// Hunter (Sung Jinwoo)
export interface Hunter {
  name: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  rank: HunterRank;
  class: HunterClass;
  stats: HunterStats;
  statPoints: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
}

// Game resource types
export interface Resources {
  // Basic resources (E-rank)
  essence: number;      // 🔮 Basic dungeon resource
  crystals: number;     // 💎 Mid-tier resource
  gold: number;         // 💰 In-game currency

  // Advanced resources (Post-class change)
  souls: number;        // 👻 For shadow upgrades
  attraction: number;   // ⭐ For recruiting allies

  // Premium currency
  gems: number;         // 💠 Premium currency

  // Research currency
  knowledge: number;    // 📚 For research/tech tree
}

// Resource caps/storage limits
export interface ResourceCaps {
  essence: number;
  crystals: number;
  gold: number;
  souls: number;
  attraction: number;
  gems: number;
  knowledge: number;
}

// Building types
export interface Building {
  id: string;
  name: string;
  description?: string; // What the building does
  count: number;
  baseCost: Resources;
  costMultiplier: number;
  produces?: Partial<Resources>;
  perSecond?: number;
  xpPerSecond?: number; // Passive XP generation (for Training Grounds)
  increasesCaps?: Partial<ResourceCaps>; // How much this building increases storage caps
}

// Research/Tech types
export interface Research {
  id: string;
  name: string;
  description: string;
  cost: number; // Knowledge points required
  researched: boolean;
  requires?: string[]; // IDs of prerequisite research
  unlocks?: string[]; // IDs of buildings/research this unlocks
  effects?: {
    // Production multipliers (multiplicative with other bonuses)
    productionMultiplier?: Partial<Record<keyof Resources, number>>;
    // Building efficiency (e.g., "essenceExtractor": 1.5 = 50% more production)
    buildingEfficiency?: Record<string, number>;
    // Cap multipliers
    capMultiplier?: Partial<Record<keyof Resources, number>>;
    // Flat cap increases
    capIncrease?: Partial<ResourceCaps>;
    // Gathering bonuses
    gatheringBonus?: Partial<Record<keyof Resources, number>>;
  };
}

// Game state
export interface GameState {
  version: number; // Schema version for migrations
  hunter: Hunter;
  resources: Resources;
  resourceCaps: ResourceCaps;
  buildings: Record<string, Building>;
  research: Record<string, Research>;
  lastUpdate: number;

  // Actions
  addResource: (resource: keyof Resources, amount: number) => void;
  gatherResource: (resource: 'essence' | 'crystals' | 'gold') => void;
  purchaseBuilding: (buildingId: string) => void;
  purchaseResearch: (researchId: string) => void;
  addXp: (amount: number) => void;
  allocateStat: (stat: keyof HunterStats) => void;
  tick: () => void;
  reset: () => void;
}

// Helper: Calculate XP needed for next level
const calculateXpToNextLevel = (level: number): number => {
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

// Helper: Calculate max HP based on vitality
const calculateMaxHp = (vitality: number, level: number): number => {
  return 100 + (vitality * 10) + (level * 5);
};

// Helper: Calculate max Mana based on intelligence
const calculateMaxMana = (intelligence: number, level: number): number => {
  return 50 + (intelligence * 15) + (level * 3);
};

// Helper: Determine rank based on level
const calculateRank = (level: number): HunterRank => {
  if (level >= 100) return 'National';
  if (level >= 80) return 'S';
  if (level >= 60) return 'A';
  if (level >= 40) return 'B';
  if (level >= 20) return 'C';
  if (level >= 10) return 'D';
  return 'E';
};

// Helper: Create initial hunter
const createInitialHunter = (): Hunter => {
  const initialStats: HunterStats = {
    strength: 5,
    agility: 5,
    intelligence: 5,
    vitality: 5,
  };

  return {
    name: 'Sung Jinwoo',
    level: 1,
    xp: 0,
    xpToNextLevel: calculateXpToNextLevel(1),
    rank: 'E',
    class: 'Hunter',
    stats: initialStats,
    statPoints: 0,
    hp: calculateMaxHp(initialStats.vitality, 1),
    maxHp: calculateMaxHp(initialStats.vitality, 1),
    mana: calculateMaxMana(initialStats.intelligence, 1),
    maxMana: calculateMaxMana(initialStats.intelligence, 1),
  };
};

// Helper to create full Resources object with defaults
const createResources = (partial: Partial<Resources> = {}): Resources => {
  return {
    essence: 0,
    crystals: 0,
    gold: 0,
    souls: 0,
    attraction: 0,
    gems: 0,
    knowledge: 0,
    ...partial,
  };
};

// Helper to create resource caps with defaults
const createResourceCaps = (partial: Partial<ResourceCaps> = {}): ResourceCaps => {
  return {
    essence: 100,      // Start with small caps to create pressure
    crystals: 50,
    gold: 200,
    souls: 10,
    attraction: 25,
    gems: 10,
    knowledge: 100,    // Research cap
    ...partial,
  };
};

// Initial building definitions
const initialBuildings: Record<string, Building> = {
  essenceExtractor: {
    id: 'essenceExtractor',
    name: '🔮 Essence Extractor',
    description: 'Passively generates essence from ambient mana',
    count: 0,
    baseCost: createResources({ essence: 10 }),
    costMultiplier: 1.15,
    produces: { essence: 1 },
    perSecond: 0.1,
  },
  trainingGround: {
    id: 'trainingGround',
    name: '⚔️ Training Ground',
    description: 'Provides passive XP gain',
    count: 0,
    baseCost: createResources({ essence: 50, crystals: 5 }),
    costMultiplier: 1.15,
    xpPerSecond: 0.5, // Passive XP generation
  },
  hunterGuild: {
    id: 'hunterGuild',
    name: '🏛️ Hunter Guild',
    description: 'Generates attraction for recruiting allies',
    count: 0,
    baseCost: createResources({ crystals: 200, gold: 250 }),
    costMultiplier: 1.15,
    produces: { attraction: 1 },
    perSecond: 0.1,
  },
  mageTower: {
    id: 'mageTower',
    name: '🗼 Mage Tower',
    description: 'Produces premium gems through arcane rituals',
    count: 0,
    baseCost: createResources({ crystals: 25 }),
    costMultiplier: 1.15,
    produces: { gems: 1 },
    perSecond: 0.05,
  },
  crystalMine: {
    id: 'crystalMine',
    name: '💎 Crystal Mine',
    description: 'Extracts valuable crystals from dungeon depths',
    count: 0,
    baseCost: createResources({ essence: 100 }),
    costMultiplier: 1.15,
    produces: { crystals: 1 },
    perSecond: 0.2,
  },
  // Storage buildings
  essenceVault: {
    id: 'essenceVault',
    name: '📦 Essence Vault',
    description: 'Increases essence storage capacity',
    count: 0,
    baseCost: createResources({ essence: 50 }),
    costMultiplier: 1.12,
    increasesCaps: { essence: 50 },
  },
  crystalWarehouse: {
    id: 'crystalWarehouse',
    name: '🏪 Crystal Warehouse',
    description: 'Increases crystal storage capacity',
    count: 0,
    baseCost: createResources({ essence: 75, crystals: 25 }),
    costMultiplier: 1.12,
    increasesCaps: { crystals: 25 },
  },
  goldVault: {
    id: 'goldVault',
    name: '🏦 Gold Vault',
    description: 'Increases gold storage capacity',
    count: 0,
    baseCost: createResources({ essence: 100, gold: 50 }),
    costMultiplier: 1.12,
    increasesCaps: { gold: 100 },
  },
  // Advanced buildings (unlocked by research)
  soulHarvester: {
    id: 'soulHarvester',
    name: '👻 Soul Harvester',
    description: 'Harvests souls from defeated enemies. Each soul boosts all production by 1%',
    count: 0,
    baseCost: createResources({ essence: 500, crystals: 200, gold: 300 }),
    costMultiplier: 1.2,
    produces: { souls: 1 },
    perSecond: 0.05,
  },
};

// Initial research definitions - designed for synergistic gameplay
const initialResearch: Record<string, Research> = {
  // Tier 1: Basic unlocks and efficiency
  basicExtraction: {
    id: 'basicExtraction',
    name: '🔬 Basic Extraction',
    description: 'Improves essence gathering efficiency by 50%',
    cost: 10,
    researched: false,
    effects: {
      gatheringBonus: { essence: 0.5 },
    },
  },
  knowledgeGeneration: {
    id: 'knowledgeGeneration',
    name: '📚 Knowledge Generation',
    description: 'Training Grounds now produce knowledge points',
    cost: 15,
    researched: false,
    effects: {
      // This will be handled specially in tick() - Training Grounds produce knowledge
    },
  },

  // Tier 2: Synergistic upgrades
  manaResonance: {
    id: 'manaResonance',
    name: '✨ Mana Resonance',
    description: 'Essence Extractors gain +25% efficiency for each Crystal Mine you own',
    cost: 50,
    researched: false,
    requires: ['basicExtraction'],
    effects: {
      // Synergy: essenceExtractor production scales with crystalMine count
    },
  },
  compoundedLearning: {
    id: 'compoundedLearning',
    name: '🧠 Compounded Learning',
    description: 'Each Training Ground increases knowledge production of all Training Grounds by 10%',
    cost: 75,
    researched: false,
    requires: ['knowledgeGeneration'],
    effects: {
      // Synergy: Training Grounds scale with each other
    },
  },

  // Tier 3: Major multipliers
  industrialScale: {
    id: 'industrialScale',
    name: '🏭 Industrial Scale',
    description: 'All production buildings gain +100% efficiency',
    cost: 200,
    researched: false,
    requires: ['manaResonance'],
    effects: {
      buildingEfficiency: {
        essenceExtractor: 2.0,
        crystalMine: 2.0,
        mageTower: 2.0,
      },
    },
  },
  deepStorage: {
    id: 'deepStorage',
    name: '📦 Deep Storage',
    description: 'All storage caps increased by 50%',
    cost: 150,
    researched: false,
    requires: ['basicExtraction'],
    effects: {
      capMultiplier: {
        essence: 1.5,
        crystals: 1.5,
        gold: 1.5,
        gems: 1.5,
      },
    },
  },

  // Tier 4: Exponential loops
  shadowEconomy: {
    id: 'shadowEconomy',
    name: '👻 Shadow Economy',
    description: 'Unlocks Soul Harvester building. Souls boost all production by 1% per soul owned',
    cost: 500,
    researched: false,
    requires: ['industrialScale', 'compoundedLearning'],
    unlocks: ['soulHarvester'],
    effects: {
      // Special: souls provide global production multiplier
    },
  },

  // Additional synergies
  crystalSynergy: {
    id: 'crystalSynergy',
    name: '💎 Crystal Synergy',
    description: 'Crystal Mines gain +10% efficiency for each Essence Vault you own',
    cost: 100,
    researched: false,
    requires: ['basicExtraction'],
    effects: {
      // Synergy: crystalMine production scales with essenceVault count
    },
  },
  guildNetwork: {
    id: 'guildNetwork',
    name: '🏛️ Guild Network',
    description: 'Hunter Guilds produce +5% more attraction for each other Hunter Guild',
    cost: 125,
    researched: false,
    requires: ['knowledgeGeneration'],
    effects: {
      // Synergy: hunterGuild scales with itself
    },
  },

  // Late game exponential
  knowledgeLoop: {
    id: 'knowledgeLoop',
    name: '🔄 Knowledge Loop',
    description: 'Each 100 knowledge points increases all production by 5%',
    cost: 1000,
    researched: false,
    requires: ['shadowEconomy', 'deepStorage'],
    effects: {
      // Special: knowledge provides production multiplier
    },
  },
  transcendence: {
    id: 'transcendence',
    name: '⚡ Transcendence',
    description: 'All buildings produce +1% per hunter level. Caps increased by +10% per hunter level',
    cost: 2000,
    researched: false,
    requires: ['knowledgeLoop'],
    effects: {
      // Special: hunter level provides global bonuses
    },
  },
};

// Calculate building cost based on count
const calculateCost = (building: Building): Resources => {
  const multiplier = Math.pow(building.costMultiplier, building.count);
  return createResources({
    essence: Math.floor(building.baseCost.essence * multiplier),
    crystals: Math.floor(building.baseCost.crystals * multiplier),
    gold: Math.floor(building.baseCost.gold * multiplier),
    souls: Math.floor(building.baseCost.souls * multiplier),
    attraction: Math.floor(building.baseCost.attraction * multiplier),
    gems: Math.floor(building.baseCost.gems * multiplier),
  });
};

// Check if player can afford a building
const canAfford = (resources: Resources, cost: Resources): boolean => {
  return (
    resources.essence >= cost.essence &&
    resources.crystals >= cost.crystals &&
    resources.gold >= cost.gold &&
    resources.souls >= cost.souls &&
    resources.attraction >= cost.attraction &&
    resources.gems >= cost.gems
  );
};

// Calculate total resource caps based on base caps + building bonuses + research
const calculateResourceCaps = (
  buildings: Record<string, Building>,
  research: Record<string, Research>,
  hunterLevel: number = 1
): ResourceCaps => {
  const baseCaps = createResourceCaps();
  const caps = { ...baseCaps };

  // Add building cap increases
  Object.values(buildings).forEach((building) => {
    if (building.increasesCaps && building.count > 0) {
      Object.entries(building.increasesCaps).forEach(([resource, increase]) => {
        if (increase) {
          caps[resource as keyof ResourceCaps] += increase * building.count;
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

// Current schema version
const CURRENT_VERSION = 2; // Incremented when we removed legacy resources

// Initial state
const initialState = {
  version: CURRENT_VERSION,
  hunter: createInitialHunter(),
  resources: createResources(),
  resourceCaps: createResourceCaps(),
  buildings: initialBuildings,
  research: initialResearch,
  lastUpdate: Date.now(),
};

// Deep merge helper to preserve new defaults when loading persisted state
const deepMerge = <T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T => {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>) as T[Extract<keyof T, string>];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
};

// Load persisted state from localStorage
const loadPersistedState = (): Partial<GameState> | null => {
  try {
    const stored = localStorage.getItem('arise-incremental-storage');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load persisted state:', error);
  }
  return null;
};

// Save state to localStorage
const persistState = (state: GameState) => {
  try {
    localStorage.setItem('arise-incremental-storage', JSON.stringify(state));
  } catch (error) {
    console.error('Failed to persist state:', error);
  }
};

export const gameStore = createStore<GameState>((set, get) => {
  const persisted = loadPersistedState();

  // Deep merge persisted state with initial state to preserve new defaults
  const mergedState = persisted
    ? deepMerge(initialState, persisted)
    : initialState;

  const store: GameState = {
    ...mergedState,

    addResource: (resource: keyof Resources, amount: number) => {
      set((state) => {
        const newAmount = state.resources[resource] + amount;
        const cap = state.resourceCaps[resource];
        return {
          resources: {
            ...state.resources,
            [resource]: Math.max(0, Math.min(cap, newAmount)),
          },
        };
      });
    },

    gatherResource: (resource: 'essence' | 'crystals' | 'gold') => {
      const state = get();
      const { stats } = state.hunter;

      // Calculate base amount and stat bonus
      const baseAmount = 1;
      let statBonus = 0;
      let xpGain = 0;

      switch (resource) {
        case 'essence':
          // Intelligence affects essence gathering (mana-based resource)
          statBonus = Math.floor(stats.intelligence * 0.1);
          xpGain = 5;
          break;
        case 'crystals':
          // Agility affects crystal mining (speed/precision)
          statBonus = Math.floor(stats.agility * 0.1);
          xpGain = 8;
          break;
        case 'gold':
          // Strength affects gold collection (combat/hunting)
          statBonus = Math.floor(stats.strength * 0.1);
          xpGain = 12;
          break;
      }

      const totalAmount = baseAmount + statBonus;

      // Add the resource and XP (respecting caps)
      set((state) => {
        const newAmount = state.resources[resource] + totalAmount;
        const cap = state.resourceCaps[resource];
        return {
          resources: {
            ...state.resources,
            [resource]: Math.min(cap, newAmount),
          },
        };
      });

      // Add XP separately
      get().addXp(xpGain);
    },

    purchaseBuilding: (buildingId: string) => {
      const state = get();
      const building = state.buildings[buildingId];
      if (!building) return;

      const cost = calculateCost(building);
      if (!canAfford(state.resources, cost)) return;

      set((state) => {
        const newBuildings = {
          ...state.buildings,
          [buildingId]: {
            ...building,
            count: building.count + 1,
          },
        };

        return {
          resources: createResources({
            essence: state.resources.essence - cost.essence,
            crystals: state.resources.crystals - cost.crystals,
            gold: state.resources.gold - cost.gold,
            souls: state.resources.souls - cost.souls,
            attraction: state.resources.attraction - cost.attraction,
            gems: state.resources.gems - cost.gems,
            knowledge: state.resources.knowledge - cost.knowledge,
          }),
          buildings: newBuildings,
          resourceCaps: calculateResourceCaps(newBuildings, state.research, state.hunter.level),
        };
      });
    },

    purchaseResearch: (researchId: string) => {
      const state = get();
      const research = state.research[researchId];
      if (!research) return;
      if (research.researched) return; // Already researched
      if (state.resources.knowledge < research.cost) return; // Can't afford

      // Check prerequisites
      if (research.requires) {
        const hasPrereqs = research.requires.every(
          (reqId) => state.research[reqId]?.researched
        );
        if (!hasPrereqs) return;
      }

      set((state) => {
        const newResearch = {
          ...state.research,
          [researchId]: {
            ...research,
            researched: true,
          },
        };

        return {
          resources: createResources({
            ...state.resources,
            knowledge: state.resources.knowledge - research.cost,
          }),
          research: newResearch,
          // Recalculate caps in case research affects them
          resourceCaps: calculateResourceCaps(state.buildings, newResearch, state.hunter.level),
        };
      });
    },

    addXp: (amount: number) => {
      set((state) => {
        let newXp = state.hunter.xp + amount;
        let newLevel = state.hunter.level;
        let newStatPoints = state.hunter.statPoints;
        let xpToNextLevel = state.hunter.xpToNextLevel;

        // Handle level ups
        while (newXp >= xpToNextLevel) {
          newXp -= xpToNextLevel;
          newLevel += 1;
          newStatPoints += 3; // 3 stat points per level
          xpToNextLevel = calculateXpToNextLevel(newLevel);
        }

        const newRank = calculateRank(newLevel);
        const newMaxHp = calculateMaxHp(state.hunter.stats.vitality, newLevel);
        const newMaxMana = calculateMaxMana(state.hunter.stats.intelligence, newLevel);

        return {
          hunter: {
            ...state.hunter,
            level: newLevel,
            xp: newXp,
            xpToNextLevel,
            rank: newRank,
            statPoints: newStatPoints,
            maxHp: newMaxHp,
            hp: Math.min(state.hunter.hp, newMaxHp), // Don't exceed new max
            maxMana: newMaxMana,
            mana: Math.min(state.hunter.mana, newMaxMana),
          },
        };
      });
    },

    allocateStat: (stat: keyof HunterStats) => {
      set((state) => {
        if (state.hunter.statPoints <= 0) return state;

        const newStats = {
          ...state.hunter.stats,
          [stat]: state.hunter.stats[stat] + 1,
        };

        const newMaxHp = calculateMaxHp(newStats.vitality, state.hunter.level);
        const newMaxMana = calculateMaxMana(newStats.intelligence, state.hunter.level);

        return {
          hunter: {
            ...state.hunter,
            stats: newStats,
            statPoints: state.hunter.statPoints - 1,
            maxHp: newMaxHp,
            hp: stat === 'vitality' ? newMaxHp : state.hunter.hp, // Heal to full on VIT increase
            maxMana: newMaxMana,
            mana: stat === 'intelligence' ? newMaxMana : state.hunter.mana, // Restore mana on INT increase
          },
        };
      });
    },

    tick: () => {
      const state = get();
      const now = Date.now();
      // Ensure deltaTime is never negative (protects against clock skew or corrupted state)
      const deltaTime = Math.max(0, (now - state.lastUpdate) / 1000); // Convert to seconds

      // Calculate research bonuses
      const researchedTechs = Object.values(state.research).filter(r => r.researched);

      // Calculate global multipliers
      let globalProductionMultiplier = 1.0;

      // Shadow Economy: Each soul increases all production by 1%
      if (state.research.shadowEconomy?.researched) {
        globalProductionMultiplier *= (1 + state.resources.souls * 0.01);
      }

      // Knowledge Loop: Each 100 knowledge increases all production by 5%
      if (state.research.knowledgeLoop?.researched) {
        const knowledgeBonus = Math.floor(state.resources.knowledge / 100) * 0.05;
        globalProductionMultiplier *= (1 + knowledgeBonus);
      }

      // Transcendence: +1% per hunter level
      if (state.research.transcendence?.researched) {
        globalProductionMultiplier *= (1 + state.hunter.level * 0.01);
      }

      // Calculate resource generation
      const resourceGains: Resources = createResources();
      let xpGain = 0;

      // Add production from buildings
      Object.values(state.buildings).forEach((building) => {
        if (building.produces && building.perSecond) {
          Object.entries(building.produces).forEach(([resource, amount]) => {
            if (amount) {
              let production = amount * building.count * building.perSecond! * deltaTime;

              // Apply building efficiency bonuses from research
              researchedTechs.forEach(tech => {
                if (tech.effects?.buildingEfficiency?.[building.id]) {
                  production *= tech.effects.buildingEfficiency[building.id];
                }
              });

              // Apply Mana Resonance synergy: essenceExtractor scales with crystalMine count
              if (building.id === 'essenceExtractor' && state.research.manaResonance?.researched) {
                const crystalMines = state.buildings.crystalMine?.count || 0;
                production *= (1 + crystalMines * 0.25);
              }

              // Apply Crystal Synergy: crystalMine scales with essenceVault count
              if (building.id === 'crystalMine' && state.research.crystalSynergy?.researched) {
                const essenceVaults = state.buildings.essenceVault?.count || 0;
                production *= (1 + essenceVaults * 0.1);
              }

              // Apply Guild Network: hunterGuild scales with itself
              if (building.id === 'hunterGuild' && state.research.guildNetwork?.researched) {
                const guildCount = state.buildings.hunterGuild?.count || 0;
                production *= (1 + (guildCount - 1) * 0.05); // -1 because we don't count the current one
              }

              // Apply global production multiplier (from souls, knowledge, level, etc.)
              production *= globalProductionMultiplier;

              resourceGains[resource as keyof Resources] += production;
            }
          });
        }

        // Add XP generation from Training Grounds
        if (building.xpPerSecond) {
          xpGain += building.count * building.xpPerSecond * deltaTime;
        }

        // Knowledge generation from Training Grounds (if researched)
        if (building.id === 'trainingGround' && state.research.knowledgeGeneration?.researched) {
          let knowledgeProduction = building.count * 0.1 * deltaTime; // Base: 0.1 knowledge/s per Training Ground

          // Apply Compounded Learning synergy: each Training Ground boosts all others by 10%
          if (state.research.compoundedLearning?.researched) {
            knowledgeProduction *= Math.pow(1.1, building.count);
          }

          resourceGains.knowledge += knowledgeProduction;
        }
      });

      set((state) => ({
        resources: createResources({
          essence: Math.min(state.resourceCaps.essence, state.resources.essence + resourceGains.essence),
          crystals: Math.min(state.resourceCaps.crystals, state.resources.crystals + resourceGains.crystals),
          gold: Math.min(state.resourceCaps.gold, state.resources.gold + resourceGains.gold),
          souls: Math.min(state.resourceCaps.souls, state.resources.souls + resourceGains.souls),
          attraction: Math.min(state.resourceCaps.attraction, state.resources.attraction + resourceGains.attraction),
          gems: Math.min(state.resourceCaps.gems, state.resources.gems + resourceGains.gems),
          knowledge: Math.min(state.resourceCaps.knowledge, state.resources.knowledge + resourceGains.knowledge),
        }),
        lastUpdate: now,
      }));

      // Add XP separately (triggers level-up logic)
      if (xpGain > 0) {
        get().addXp(xpGain);
      }
    },

    reset: () => {
      set({
        ...initialState,
        lastUpdate: Date.now(),
      });
    },
  };

  return store;
});

// Subscribe to state changes and persist
gameStore.subscribe((state) => {
  persistState(state);
});

// Helper function to get current building cost
export const getBuildingCost = (building: Building): Resources => {
  return calculateCost(building);
};

// Helper function to check affordability
export const canAffordBuilding = (
  resources: Resources,
  building: Building
): boolean => {
  return canAfford(resources, calculateCost(building));
};
