/**
 * Shared types between frontend and backend
 * This ensures type safety across the entire stack
 */

// Game resource types
export interface Resources {
  essence: number; // 🔮 Basic dungeon resource
  crystals: number; // 💎 Mid-tier resource
  gold: number; // 💰 In-game currency
  souls: number; // 👻 For shadow upgrades
  attraction: number; // ⭐ For recruiting allies
  gems: number; // 💠 Premium currency
  knowledge: number; // 📚 For research/tech tree
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
  authority: number; // Controls max party size
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

// Building types
export interface Building {
  id: string;
  name: string;
  description?: string;
  count: number;
  baseCost: Resources;
  costMultiplier: number;
  produces?: Partial<Resources>;
  perSecond?: number;
  xpPerSecond?: number;
  increasesCaps?: Partial<ResourceCaps>;
}

// Artifact types
export type ArtifactRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
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
export type ArtifactTier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export interface ArtifactStatBonus {
  strength?: number; // Percentage bonus (e.g., 5 = +5%)
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
  tier: ArtifactTier;
  slot: ArtifactSlot;
  baseStats: ArtifactStatBonus;
  upgrades: ArtifactUpgrade[];
  maxUpgrades: number;
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

// Dungeon types
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
  companionDropChance?: number;
  companionNames?: string[];
}

export interface ActiveDungeon {
  id: string;
  dungeonId: string;
  startTime: number;
  endTime: number;
  partyIds?: string[];
}

// Companion types (Allies & Shadows)
export type CompanionType = 'ally' | 'shadow';

export interface Companion {
  id: string;
  name: string;
  type: CompanionType;
  originDungeonId: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
}

export interface Ally extends Companion {
  type: 'ally';
}

export interface Shadow extends Companion {
  type: 'shadow';
}

// Research types
export interface Research {
  id: string;
  name: string;
  description: string;
  cost: number; // Knowledge cost
  researched: boolean;
  requires?: string[]; // IDs of prerequisite research
  unlocks?: string[]; // IDs of buildings/research this unlocks
  effects?: {
    productionMultiplier?: Partial<Record<keyof Resources, number>>;
    buildingEfficiency?: Record<string, number>;
    capMultiplier?: Partial<Record<keyof Resources, number>>;
    capIncrease?: Partial<ResourceCaps>;
    gatheringBonus?: Partial<Record<keyof Resources, number>>;
    companionXpBonus?: number;
    blacksmithXpBonus?: number;
    artifactStatBonus?: number;
    dungeonSpeedBonus?: number;
    dungeonRewardBonus?: number;
  };
}

// Game state (what gets sent to/from server)
export interface GameStateDTO {
  version: number;
  resources: Resources;
  resourceCaps: ResourceCaps;
  hunter: Hunter;
  buildings: Record<string, Building>;
  artifacts: {
    equipped: EquippedArtifacts;
    inventory: Artifact[];
    blacksmithLevel: number;
    blacksmithXp: number;
  };
  dungeons: Dungeon[];
  activeDungeons: ActiveDungeon[];
  allies: Ally[];
  shadows: Shadow[];
  research: Record<string, Research>;
  lastUpdate: number;
}

// Offline gains popup data
export interface OfflineGains {
  timeAway: number; // milliseconds
  resourceGains: Resources;
  xpGained: number;
  capped: boolean; // whether gains were capped
}

// API Response types
export interface GameStateResponse {
  state: GameStateDTO;
  offlineGains?: OfflineGains;
}

export interface TransactionResponse {
  success: boolean;
  state: GameStateDTO;
  error?: string;
}

// Transaction request types
export interface GatherResourceRequest {
  resource: 'essence' | 'crystals' | 'gold' | 'souls' | 'attraction' | 'gems' | 'knowledge';
  clientTxId: string;
}

export interface PurchaseBuildingRequest {
  buildingId: string;
  clientTxId: string;
}

export interface PurchaseBulkBuildingRequest {
  buildingId: string;
  quantity: number;
  clientTxId: string;
}

export interface CraftArtifactRequest {
  rank: ArtifactRank;
  slot: ArtifactSlot;
  clientTxId: string;
}

export interface UpgradeArtifactRequest {
  artifactId: string;
  upgradeId: string;
  clientTxId: string;
}

export interface EquipArtifactRequest {
  artifactId: string;
  clientTxId: string;
}

export interface DestroyArtifactRequest {
  artifactId: string;
  clientTxId: string;
}

export interface StartDungeonRequest {
  dungeonId: string;
  partyIds: string[];
  clientTxId: string;
}

export interface CompleteDungeonRequest {
  activeDungeonId: string;
  clientTxId: string;
}

export interface CancelDungeonRequest {
  activeDungeonId: string;
  clientTxId: string;
}

export interface AllocateStatRequest {
  stat: keyof HunterStats;
  clientTxId: string;
}

export interface PurchaseResearchRequest {
  researchId: string;
  clientTxId: string;
}

export interface RecruitAllyRequest {
  name: string;
  rank: string;
  clientTxId: string;
}

export interface ExtractShadowRequest {
  name: string;
  dungeonId: string;
  clientTxId: string;
}

export interface ResetGameRequest {
  clientTxId: string;
}
