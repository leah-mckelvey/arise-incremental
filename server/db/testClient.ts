import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';

/**
 * Test database client for E2E tests.
 * Uses a separate SQLite database file to ensure complete isolation from dev database.
 */

// Use separate test database
const testDbUrl = process.env.TEST_DATABASE_URL || 'file:test-e2e.db';

// Create libsql client for tests
const testClient = createClient({
  url: testDbUrl,
});

// Create Drizzle instance for tests
export const testDb = drizzle(testClient, { schema });

// Helper to close test database connection
export const closeTestDb = async () => {
  await testClient.close();
};
