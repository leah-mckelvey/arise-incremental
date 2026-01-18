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

// Hunter stats
export interface HunterStats {
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  sense: number;
  authority: number; // Controls max party size for allies and shadows
}

// Hunter state
export interface Hunter {
  level: number;
  xp: number;
  xpToNextLevel: number;
  rank: string;
  stats: HunterStats;
  statPoints: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
}

// Notification system types
export type NotificationType = 'dungeon_complete' | 'level_up' | 'unlock' | 'craft' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  rewards?: DungeonRewards;
  timestamp: number;
  duration?: number; // ms, defaults to 5000
}

// Dungeon system types
export type DungeonType = 'solo' | 'alliance';
export type DungeonRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface DungeonRewards {
  essence: number;
  crystals: number;
  gold: number;
  souls: number;
  attraction: number;
  gems: number;
  knowledge: number;
  experience: number; // Hunter XP
}

export interface Dungeon {
  id: string;
  name: string;
  description: string;
  type: DungeonType;
  rank: DungeonRank;
  requiredLevel: number;
  duration: number; // seconds
  rewards: DungeonRewards;
  unlocked: boolean;
  companionDropChance?: number; // 0-1, chance to drop ally (alliance) or shadow (solo, requires necromancer)
  companionNames?: string[]; // Pool of possible companion names from this dungeon
}

export interface ActiveDungeon {
  dungeonId: string;
  startTime: number; // timestamp
  endTime: number; // timestamp
  partyIds?: string[]; // IDs of allies or shadows assigned to this dungeon
}

// Companion system types (Allies & Shadows)
export type CompanionType = 'ally' | 'shadow';

export interface Companion {
  id: string;
  name: string;
  type: CompanionType;
  originDungeonId: string; // Which dungeon they came from (only levels from this dungeon)
  level: number;
  xp: number;
  xpToNextLevel: number;
  // Companions might have stats later, but for now they just multiply rewards
}

export interface Ally extends Companion {
  type: 'ally';
}

export interface Shadow extends Companion {
  type: 'shadow';
}

// Artifact system types
export type ArtifactRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export type ArtifactTier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export type ArtifactSlot =
  | 'weapon'
  | 'head'
  | 'chest'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'neck'
  | 'ears'
  | 'wrist'
  | 'ring1'
  | 'ring2';

export interface ArtifactStatBonus {
  strength?: number;      // Percentage bonus (e.g., 5 = +5%)
  agility?: number;
  intelligence?: number;
  vitality?: number;
  sense?: number;
}

export interface ArtifactUpgrade {
  id: string;
  name: string;
  description: string;
  statBonus: ArtifactStatBonus;
  cost: Resources;
  blacksmithXpCost: number;
}

export interface Artifact {
  id: string;
  name: string;
  description: string;
  rank: ArtifactRank;
  tier: ArtifactTier;               // Loot tier (Common → Legendary)
  slot: ArtifactSlot;
  baseStats: ArtifactStatBonus;
  upgrades: ArtifactUpgrade[];      // Applied upgrades
  maxUpgrades: number;              // Max upgrade slots (increases with tier)
  craftCost: Resources;
}

export interface EquippedArtifacts {
  weapon?: Artifact;
  head?: Artifact;
  chest?: Artifact;
  hands?: Artifact;
  legs?: Artifact;
  feet?: Artifact;
  neck?: Artifact;
  ears?: Artifact;
  wrist?: Artifact;
  ring1?: Artifact;
  ring2?: Artifact;
}

