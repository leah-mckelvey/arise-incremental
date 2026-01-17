import type { Research } from '../store/researchStore';

export const initialResearch: Record<string, Research> = {
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

