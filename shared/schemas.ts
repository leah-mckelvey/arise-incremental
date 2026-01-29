/**
 * Zod schemas for runtime validation of JSON data from the database.
 * These schemas mirror the TypeScript interfaces in types.ts but provide
 * runtime validation to catch data corruption or schema drift.
 */

import { z } from 'zod';

// Resource schemas
export const ResourcesSchema = z.object({
  essence: z.number(),
  crystals: z.number(),
  gold: z.number(),
  souls: z.number(),
  attraction: z.number(),
  gems: z.number(),
  knowledge: z.number(),
});

export const ResourceCapsSchema = z.object({
  essence: z.number(),
  crystals: z.number(),
  gold: z.number(),
  souls: z.number(),
  attraction: z.number(),
  gems: z.number(),
  knowledge: z.number(),
});

// Building schema
export const BuildingSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  count: z.number(),
  baseCost: ResourcesSchema,
  costMultiplier: z.number(),
  produces: ResourcesSchema.partial().optional(),
  perSecond: z.number().optional(),
  xpPerSecond: z.number().optional(),
  increasesCaps: ResourceCapsSchema.partial().optional(),
});

export const BuildingsRecordSchema = z.record(z.string(), BuildingSchema);

// Research schema
export const ResearchSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  cost: z.number(),
  researched: z.boolean(),
  requires: z.array(z.string()).optional(),
  unlocks: z.array(z.string()).optional(),
  effects: z
    .object({
      productionMultiplier: z.record(z.string(), z.number()).optional(),
      buildingEfficiency: z.record(z.string(), z.number()).optional(),
      capMultiplier: z.record(z.string(), z.number()).optional(),
      capIncrease: ResourceCapsSchema.partial().optional(),
      gatheringBonus: z.record(z.string(), z.number()).optional(),
      companionXpBonus: z.number().optional(),
      blacksmithXpBonus: z.number().optional(),
      artifactStatBonus: z.number().optional(),
      dungeonSpeedBonus: z.number().optional(),
      dungeonRewardBonus: z.number().optional(),
    })
    .optional(),
});

export const ResearchRecordSchema = z.record(z.string(), ResearchSchema);

// Dungeon schemas
export const DungeonRewardsSchema = z.object({
  essence: z.number(),
  crystals: z.number(),
  gold: z.number(),
  souls: z.number(),
  attraction: z.number(),
  gems: z.number(),
  knowledge: z.number(),
  experience: z.number(),
});

export const DungeonSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['solo', 'alliance']),
  rank: z.enum(['E', 'D', 'C', 'B', 'A', 'S']),
  requiredLevel: z.number(),
  duration: z.number(),
  rewards: DungeonRewardsSchema,
  unlocked: z.boolean(),
  companionDropChance: z.number().optional(),
  companionNames: z.array(z.string()).optional(),
});

export const DungeonsArraySchema = z.array(DungeonSchema);

export const ActiveDungeonSchema = z.object({
  id: z.string(),
  dungeonId: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  partyIds: z.array(z.string()).optional(),
});

export const ActiveDungeonsArraySchema = z.array(ActiveDungeonSchema);

// Companion schemas
export const AllySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal('ally'),
  originDungeonId: z.string(),
  level: z.number(),
  xp: z.number(),
  xpToNextLevel: z.number(),
});

export const AlliesArraySchema = z.array(AllySchema);

export const ShadowSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal('shadow'),
  originDungeonId: z.string(),
  level: z.number(),
  xp: z.number(),
  xpToNextLevel: z.number(),
});

export const ShadowsArraySchema = z.array(ShadowSchema);

// Artifact schemas
export const ArtifactStatBonusSchema = z.object({
  strength: z.number().optional(),
  agility: z.number().optional(),
  intelligence: z.number().optional(),
  vitality: z.number().optional(),
  sense: z.number().optional(),
});

export const ArtifactUpgradeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  statBonus: ArtifactStatBonusSchema,
  cost: ResourcesSchema,
  blacksmithXpCost: z.number(),
});

export const ArtifactSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  rank: z.enum(['E', 'D', 'C', 'B', 'A', 'S']),
  tier: z.enum(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']),
  slot: z.enum([
    'weapon',
    'head',
    'chest',
    'hands',
    'legs',
    'feet',
    'neck',
    'ears',
    'wrist',
    'ring1',
    'ring2',
  ]),
  baseStats: ArtifactStatBonusSchema,
  upgrades: z.array(ArtifactUpgradeSchema),
  maxUpgrades: z.number(),
  craftCost: ResourcesSchema,
});

export const EquippedArtifactsSchema = z.object({
  weapon: ArtifactSchema.optional(),
  head: ArtifactSchema.optional(),
  chest: ArtifactSchema.optional(),
  hands: ArtifactSchema.optional(),
  legs: ArtifactSchema.optional(),
  feet: ArtifactSchema.optional(),
  neck: ArtifactSchema.optional(),
  ears: ArtifactSchema.optional(),
  wrist: ArtifactSchema.optional(),
  ring1: ArtifactSchema.optional(),
  ring2: ArtifactSchema.optional(),
});

export const ArtifactsStateSchema = z.object({
  equipped: EquippedArtifactsSchema,
  inventory: z.array(ArtifactSchema),
  blacksmithLevel: z.number(),
  blacksmithXp: z.number(),
});

// Type exports inferred from schemas
export type ParsedBuildings = z.infer<typeof BuildingsRecordSchema>;
export type ParsedResearch = z.infer<typeof ResearchRecordSchema>;
export type ParsedDungeons = z.infer<typeof DungeonsArraySchema>;
export type ParsedActiveDungeons = z.infer<typeof ActiveDungeonsArraySchema>;
export type ParsedAllies = z.infer<typeof AlliesArraySchema>;
export type ParsedShadows = z.infer<typeof ShadowsArraySchema>;
export type ParsedArtifactsState = z.infer<typeof ArtifactsStateSchema>;
