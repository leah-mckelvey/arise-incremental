/**
 * Safe parsing functions for game state JSON fields from the database.
 * These functions validate data at runtime using zod schemas, replacing
 * unsafe type assertions like `as Record<string, Building>`.
 */

import {
  BuildingsRecordSchema,
  ResearchRecordSchema,
  DungeonsArraySchema,
  ActiveDungeonsArraySchema,
  AlliesArraySchema,
  ShadowsArraySchema,
  ArtifactsStateSchema,
  type ParsedBuildings,
  type ParsedResearch,
  type ParsedDungeons,
  type ParsedActiveDungeons,
  type ParsedAllies,
  type ParsedShadows,
  type ParsedArtifactsState,
} from '../../shared/schemas.js';

/**
 * Parse buildings JSON from database.
 * Returns empty object if null/undefined or parsing fails.
 */
export function parseBuildings(data: unknown): ParsedBuildings {
  if (data === null || data === undefined) {
    return {};
  }
  const result = BuildingsRecordSchema.safeParse(data);
  if (!result.success) {
    console.error('Failed to parse buildings:', result.error.format());
    return {};
  }
  return result.data;
}

/**
 * Parse research JSON from database.
 * Returns empty object if null/undefined or parsing fails.
 */
export function parseResearch(data: unknown): ParsedResearch {
  if (data === null || data === undefined) {
    return {};
  }
  const result = ResearchRecordSchema.safeParse(data);
  if (!result.success) {
    console.error('Failed to parse research:', result.error.format());
    return {};
  }
  return result.data;
}

/**
 * Parse dungeons JSON from database.
 * Returns empty array if null/undefined or parsing fails.
 */
export function parseDungeons(data: unknown): ParsedDungeons {
  if (data === null || data === undefined) {
    return [];
  }
  const result = DungeonsArraySchema.safeParse(data);
  if (!result.success) {
    console.error('Failed to parse dungeons:', result.error.format());
    return [];
  }
  return result.data;
}

/**
 * Parse active dungeons JSON from database.
 * Returns empty array if null/undefined or parsing fails.
 */
export function parseActiveDungeons(data: unknown): ParsedActiveDungeons {
  if (data === null || data === undefined) {
    return [];
  }
  const result = ActiveDungeonsArraySchema.safeParse(data);
  if (!result.success) {
    console.error('Failed to parse active dungeons:', result.error.format());
    return [];
  }
  return result.data;
}

/**
 * Parse allies JSON from database.
 * Returns empty array if null/undefined or parsing fails.
 */
export function parseAllies(data: unknown): ParsedAllies {
  if (data === null || data === undefined) {
    return [];
  }
  const result = AlliesArraySchema.safeParse(data);
  if (!result.success) {
    console.error('Failed to parse allies:', result.error.format());
    return [];
  }
  return result.data;
}

/**
 * Parse shadows JSON from database.
 * Returns empty array if null/undefined or parsing fails.
 */
export function parseShadows(data: unknown): ParsedShadows {
  if (data === null || data === undefined) {
    return [];
  }
  const result = ShadowsArraySchema.safeParse(data);
  if (!result.success) {
    console.error('Failed to parse shadows:', result.error.format());
    return [];
  }
  return result.data;
}

/**
 * Parse artifacts state JSON from database.
 * Returns default state if null/undefined or parsing fails.
 */
export function parseArtifactsState(data: unknown): ParsedArtifactsState {
  const defaultState: ParsedArtifactsState = {
    equipped: {},
    inventory: [],
    blacksmithLevel: 1,
    blacksmithXp: 0,
  };

  if (data === null || data === undefined) {
    return defaultState;
  }
  const result = ArtifactsStateSchema.safeParse(data);
  if (!result.success) {
    console.error('Failed to parse artifacts state:', result.error.format());
    return defaultState;
  }
  return result.data;
}
