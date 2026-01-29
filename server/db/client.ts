import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';

// Database configuration
const dbUrl = process.env.DATABASE_URL || 'file:local.db';
const dbAuthToken = process.env.DATABASE_AUTH_TOKEN;

const CLIENT_ID = Math.random().toString(36).substring(7);
console.log('[DB CLIENT] CLIENT_ID:', CLIENT_ID);
console.log('[DB CLIENT] process.env.DATABASE_URL =', process.env.DATABASE_URL);
console.log('[DB CLIENT] Initializing database client with URL:', dbUrl);

// Create libsql client
const client = createClient({
  url: dbUrl,
  authToken: dbAuthToken,
});

// SQLite tuning to reduce test flakiness / SQLITE_BUSY under concurrent access.
// Safe to no-op for non-file (remote libsql/Turso) URLs.
if (dbUrl.startsWith('file:')) {
  // Enable WAL for better concurrency (multiple readers + one writer)
  await client.execute('PRAGMA journal_mode = WAL;');
  // Wait a bit for locks instead of immediately throwing SQLITE_BUSY
  await client.execute('PRAGMA busy_timeout = 5000;');
  // WAL-friendly default; trades durability for speed (fine for local dev/tests)
  await client.execute('PRAGMA synchronous = NORMAL;');
}

// Create Drizzle instance
export const db = drizzle(client, { schema });

// Export the type of the db instance for dependency injection
export type Database = typeof db;

// Helper to close database connection (useful for testing)
export const closeDb = async () => {
  await client.close();
};
