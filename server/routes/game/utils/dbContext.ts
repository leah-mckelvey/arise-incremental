import { sql } from 'drizzle-orm';
import { db as defaultDb, type Database } from '../../../db/client.js';

// Module-level db instance - can be overridden for testing via setDatabase()
let db: Database = defaultDb;
let dbName = 'defaultDb';

// Store a reference to verify identity
let injectedDbRef: Database | null = null;

/**
 * Set the database instance to use for all routes.
 * Call this BEFORE using the router (e.g., in test setup).
 */
export function setDatabase(database: Database): void {
  db = database;
  injectedDbRef = database;
  dbName = 'injectedDb';
  console.log('[setDatabase] Database instance set to:', dbName);
}

/**
 * Get the current database instance
 */
export function getDb(): Database {
  return db;
}

/**
 * Check if the current db is the injected one
 */
export function verifyDbInstance(testDb: Database): boolean {
  return db === testDb && db === injectedDbRef;
}

/**
 * Debug function: read game state directly using the injected db
 */
export async function debugReadGameState(userId: string): Promise<unknown> {
  const result = await db.get(sql`SELECT id, essence FROM game_states WHERE user_id = ${userId}`);
  console.log('[debugReadGameState] Direct read using db:', dbName, 'result:', result);
  return result;
}

/**
 * Get the current database name (for debugging)
 */
export function getDbName(): string {
  return dbName;
}
