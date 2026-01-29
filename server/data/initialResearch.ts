import type { Research } from '../../shared/types.js';

export const initialResearch: Record<string, Research> = {
  // Test research items (for integration tests)
  basicEfficiency: {
    id: 'basicEfficiency',
    name: '⚡ Basic Efficiency',
    description: 'Improves overall efficiency by 10%',
    cost: 50,
    researched: false,
    effects: {
      productionMultiplier: {
        essence: 1.1,
        crystals: 1.1,
        gold: 1.1,
        souls: 1.1,
        attraction: 1.1,
        gems: 1.1,
        knowledge: 1.1,
      },
    },
  },
  advancedEfficiency: {
    id: 'advancedEfficiency',
    name: '⚡⚡ Advanced Efficiency',
    description: 'Further improves efficiency by 20%',
    cost: 50,
    researched: false,
    requires: ['basicEfficiency'],
    effects: {
      productionMultiplier: {
        essence: 1.2,
        crystals: 1.2,
        gold: 1.2,
        souls: 1.2,
        attraction: 1.2,
        gems: 1.2,
        knowledge: 1.2,
      },
    },
  },

  // Tier 1: Basic unlocks and efficiency
  basicExtraction: {
    id: 'basicExtraction',
    name: '🔬 Basic Extraction',
    description: 'Essence Extractors produce +50% more essence',
    cost: 10,
    researched: false,
    effects: {
      buildingEfficiency: {
        essenceExtractor: 1.5,
      },
    },
  },
  crystalMining: {
    id: 'crystalMining',
    name: '💎 Crystal Mining',
    description: 'Crystal Mines produce +50% more crystals',
    cost: 10,
    researched: false,
    effects: {
      buildingEfficiency: {
        crystalMine: 1.5,
      },
    },
  },
  goldRush: {
    id: 'goldRush',
    name: '💰 Gold Rush',
    description: 'Merchant Guilds produce +50% more gold',
    cost: 10,
    researched: false,
    effects: {
      buildingEfficiency: {
        merchantGuild: 1.5,
      },
    },
  },
  knowledgeGeneration: {
    id: 'knowledgeGeneration',
    name: '📚 Knowledge Generation',
    description: 'Libraries produce +50% more knowledge',
    cost: 10,
    researched: false,
    effects: {
      buildingEfficiency: {
        library: 1.5,
      },
    },
  },
  soulHarvesting: {
    id: 'soulHarvesting',
    name: '👻 Soul Harvesting',
    description: 'Soul Harvesters produce +50% more souls',
    cost: 10,
    researched: false,
    effects: {
      buildingEfficiency: {
        soulHarvester: 1.5,
      },
    },
  },
  attractionBoost: {
    id: 'attractionBoost',
    name: '⭐ Attraction Boost',
    description: 'Hunter Guilds and Recruitment Centers produce +50% more attraction',
    cost: 10,
    researched: false,
    effects: {
      buildingEfficiency: {
        hunterGuild: 1.5,
        recruitmentCenter: 1.5,
      },
    },
  },
  gemPolishing: {
    id: 'gemPolishing',
    name: '💠 Gem Polishing',
    description: 'Gem Workshops produce +50% more gems',
    cost: 10,
    researched: false,
    effects: {
      buildingEfficiency: {
        gemWorkshop: 1.5,
      },
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
    description:
      'Each Training Ground increases knowledge production of all Training Grounds by 10%',
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
    description: 'All Tier 1 production buildings gain +100% efficiency',
    cost: 200,
    researched: false,
    requires: ['manaResonance'],
    effects: {
      buildingEfficiency: {
        essenceExtractor: 2.0,
        crystalMine: 2.0,
        merchantGuild: 2.0,
        library: 2.0,
        hunterGuild: 2.0,
        mageTower: 2.0,
      },
    },
  },
  advancedIndustry: {
    id: 'advancedIndustry',
    name: '🏗️ Advanced Industry',
    description: 'All Tier 2 production buildings gain +100% efficiency',
    cost: 500,
    researched: false,
    requires: ['industrialScale'],
    effects: {
      buildingEfficiency: {
        essenceRefinery: 2.0,
        crystalReactor: 2.0,
        tradingPost: 2.0,
        academy: 2.0,
        soulHarvester: 2.0,
        soulShrine: 2.0,
        gemWorkshop: 2.0,
        recruitmentCenter: 2.0,
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
        souls: 1.5,
        attraction: 1.5,
        gems: 1.5,
        knowledge: 1.5,
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
    description:
      'All buildings produce +1% per hunter level. Caps increased by +10% per hunter level',
    cost: 2000,
    researched: false,
    requires: ['knowledgeLoop'],
    effects: {
      // Special: hunter level provides global bonuses
    },
  },

  // Companion Research Tree
  companionTraining: {
    id: 'companionTraining',
    name: '🎓 Companion Training',
    description: 'Companions gain +50% XP from dungeons',
    cost: 100,
    researched: false,
    requires: ['basicExtraction'],
    effects: {
      companionXpBonus: 0.5,
    },
  },
  leadershipAura: {
    id: 'leadershipAura',
    name: '👑 Leadership Aura',
    description: 'Companions gain +10% effectiveness for each point of Authority you have',
    cost: 250,
    researched: false,
    requires: ['companionTraining'],
    effects: {
      // Special: authority boosts companion effectiveness
    },
  },
  allyBond: {
    id: 'allyBond',
    name: '💞 Ally Bond',
    description: 'Each ally in your roster increases attraction generation by 5%',
    cost: 300,
    researched: false,
    requires: ['companionTraining'],
    effects: {
      // Special: allies boost attraction
    },
  },
  shadowMastery: {
    id: 'shadowMastery',
    name: '👻 Shadow Mastery',
    description: 'Each shadow in your roster increases soul generation by 5%',
    cost: 400,
    researched: false,
    requires: ['shadowEconomy'],
    effects: {
      // Special: shadows boost soul generation
    },
  },
  monarchsDomain: {
    id: 'monarchsDomain',
    name: "⚔️ Monarch's Domain",
    description:
      'Unlock the ability to send companions on solo missions (passive resource generation)',
    cost: 800,
    researched: false,
    requires: ['leadershipAura', 'shadowMastery'],
    effects: {
      // Special: unlocks companion missions feature (future)
    },
  },

  // Artifact Research
  artifactMastery: {
    id: 'artifactMastery',
    name: '🔨 Artifact Mastery',
    description: 'Blacksmith gains +100% XP from upgrades and destruction',
    cost: 150,
    researched: false,
    requires: ['basicExtraction'],
    effects: {
      blacksmithXpBonus: 1.0,
    },
  },
  enchantmentTheory: {
    id: 'enchantmentTheory',
    name: '✨ Enchantment Theory',
    description: 'Artifact stat bonuses increased by 25%',
    cost: 350,
    researched: false,
    requires: ['artifactMastery'],
    effects: {
      artifactStatBonus: 0.25,
    },
  },
  legendaryForge: {
    id: 'legendaryForge',
    name: '🔥 Legendary Forge',
    description: 'Unlock the ability to craft Legendary artifacts at Blacksmith level 20',
    cost: 1500,
    researched: false,
    requires: ['enchantmentTheory', 'industrialScale'],
    effects: {
      // Special: unlocks legendary crafting
    },
  },

  // Dungeon Research
  dungeonEfficiency: {
    id: 'dungeonEfficiency',
    name: '⏱️ Dungeon Efficiency',
    description: 'All dungeons complete 20% faster',
    cost: 200,
    researched: false,
    requires: ['basicExtraction'],
    effects: {
      dungeonSpeedBonus: 0.2,
    },
  },
  treasureHunter: {
    id: 'treasureHunter',
    name: '💎 Treasure Hunter',
    description: 'Dungeon rewards increased by 25%',
    cost: 400,
    researched: false,
    requires: ['dungeonEfficiency'],
    effects: {
      dungeonRewardBonus: 0.25,
    },
  },
  raidLeader: {
    id: 'raidLeader',
    name: '🎖️ Raid Leader',
    description: 'Can run 2 additional dungeons simultaneously',
    cost: 600,
    researched: false,
    requires: ['treasureHunter', 'leadershipAura'],
    effects: {
      // Special: increases max concurrent dungeons (future)
    },
  },
};
