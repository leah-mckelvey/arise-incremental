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

// Create Drizzle instance
export const db = drizzle(client, { schema });

// Export the type of the db instance for dependency injection
export type Database = typeof db;

// Helper to close database connection (useful for testing)
export const closeDb = async () => {
  await client.close();
};

