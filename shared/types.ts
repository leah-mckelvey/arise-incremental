/**
 * Shared types between frontend and backend
 * This ensures type safety across the entire stack
 */

// Game resource types
export interface Resources {
  essence: number;      // 🔮 Basic dungeon resource
  crystals: number;     // 💎 Mid-tier resource
  gold: number;         // 💰 In-game currency
  souls: number;        // 👻 For shadow upgrades
  attraction: number;   // ⭐ For recruiting allies
  gems: number;         // 💠 Premium currency
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
export type ArtifactSlot = 'weapon' | 'armor' | 'accessory';
export type ArtifactTier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export interface ArtifactStats {
  strength?: number;
  agility?: number;
  intelligence?: number;
  vitality?: number;
  sense?: number;
}

export interface ArtifactUpgrade {
  stat: keyof ArtifactStats;
  value: number;
}

export interface Artifact {
  id: string;
  name: string;
  description: string;
  rank: ArtifactRank;
  tier: ArtifactTier;
  slot: ArtifactSlot;
  baseStats: ArtifactStats;
  upgrades: ArtifactUpgrade[];
  maxUpgrades: number;
  craftCost?: Resources;
}

export interface EquippedArtifacts {
  weapon: Artifact | null;
  armor: Artifact | null;
  accessory: Artifact | null;
}

// Dungeon types
export interface DungeonRewards {
  essence: number;
  crystals?: number;
  gold?: number;
  xp: number;
  loot?: Artifact[];
}

export interface Dungeon {
  id: string;
  name: string;
  description: string;
  rank: string;
  duration: number; // seconds
  rewards: DungeonRewards;
  unlocked: boolean;
  requiredLevel?: number;
}

export interface ActiveDungeon {
  id: string;
  dungeonId: string;
  startTime: number;
  endTime: number;
  partyIds?: string[];
}

// Ally/Shadow types
export interface Ally {
  id: string;
  name: string;
  rank: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  dungeonId?: string; // For unique allies from dungeons
}

// Research types
export interface Research {
  id: string;
  name: string;
  description: string;
  cost: Resources;
  purchased: boolean;
  unlocked: boolean;
  effects?: string;
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
  shadows: Ally[];
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
  resource: 'essence' | 'crystals' | 'gold';
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
  upgradeStat: keyof ArtifactStats;
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

export interface AllocateStatRequest {
  stat: keyof HunterStats;
  clientTxId: string;
}

export interface PurchaseResearchRequest {
  researchId: string;
  clientTxId: string;
}

export interface ResetGameRequest {
  clientTxId: string;
}

