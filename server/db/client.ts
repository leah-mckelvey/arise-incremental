import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';

// Database configuration
const dbUrl = process.env.DATABASE_URL || 'file:local.db';
const dbAuthToken = process.env.DATABASE_AUTH_TOKEN;

// Create libsql client
const client = createClient({
  url: dbUrl,
  authToken: dbAuthToken,
});

// Create Drizzle instance
export const db = drizzle(client, { schema });

// Helper to close database connection (useful for testing)
export const closeDb = async () => {
  await client.close();
};

