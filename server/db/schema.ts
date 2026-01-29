import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table - stores user authentication info
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID
  clerkId: text('clerk_id').unique(), // For future Clerk integration
  email: text('email'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Game states table - one row per user
export const gameStates = sqliteTable('game_states', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),

  // Resources stored as individual columns for easier querying and indexing
  essence: real('essence').notNull().default(0),
  crystals: real('crystals').notNull().default(0),
  gold: real('gold').notNull().default(0),
  souls: real('souls').notNull().default(0),
  attraction: real('attraction').notNull().default(0),
  gems: real('gems').notNull().default(0),
  knowledge: real('knowledge').notNull().default(0),

  // Resource caps
  essenceCap: real('essence_cap').notNull().default(100),
  crystalsCap: real('crystals_cap').notNull().default(50),
  goldCap: real('gold_cap').notNull().default(100),
  soulsCap: real('souls_cap').notNull().default(0),
  attractionCap: real('attraction_cap').notNull().default(0),
  gemsCap: real('gems_cap').notNull().default(0),
  knowledgeCap: real('knowledge_cap').notNull().default(0),

  // Hunter stats
  hunterLevel: integer('hunter_level').notNull().default(1),
  hunterXp: real('hunter_xp').notNull().default(0),
  hunterXpToNextLevel: real('hunter_xp_to_next_level').notNull().default(100),
  hunterRank: text('hunter_rank').notNull().default('E'),
  hunterStatPoints: integer('hunter_stat_points').notNull().default(0),
  hunterHp: real('hunter_hp').notNull().default(100),
  hunterMaxHp: real('hunter_max_hp').notNull().default(100),
  hunterMana: real('hunter_mana').notNull().default(50),
  hunterMaxMana: real('hunter_max_mana').notNull().default(50),

  // Hunter stats (individual columns for querying)
  hunterStrength: integer('hunter_strength').notNull().default(5),
  hunterAgility: integer('hunter_agility').notNull().default(5),
  hunterIntelligence: integer('hunter_intelligence').notNull().default(5),
  hunterVitality: integer('hunter_vitality').notNull().default(5),
  hunterSense: integer('hunter_sense').notNull().default(5),
  hunterAuthority: integer('hunter_authority').notNull().default(5),

  // Complex data stored as JSON
  buildings: text('buildings', { mode: 'json' }).notNull().default('{}'),
  artifacts: text('artifacts', { mode: 'json' })
    .notNull()
    .default(
      '{"equipped":{"weapon":null,"armor":null,"accessory":null},"inventory":[],"blacksmithLevel":1,"blacksmithXp":0}'
    ),
  dungeons: text('dungeons', { mode: 'json' }).notNull().default('[]'),
  activeDungeons: text('active_dungeons', { mode: 'json' }).notNull().default('[]'),
  allies: text('allies', { mode: 'json' }).notNull().default('[]'),
  shadows: text('shadows', { mode: 'json' }).notNull().default('[]'),
  research: text('research', { mode: 'json' }).notNull().default('{}'),

  // Timestamp of last update (for offline gains)
  lastUpdate: integer('last_update', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Transactions table - audit log for all game actions (anti-cheat)
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  clientTxId: text('client_tx_id').unique().notNull(), // Client-generated UUID for idempotency

  type: text('type').notNull(), // 'gather', 'purchase_building', 'reset', etc.
  payload: text('payload', { mode: 'json' }).notNull(), // Transaction details

  // State before and after (for debugging/rollback)
  stateBefore: text('state_before', { mode: 'json' }),
  stateAfter: text('state_after', { mode: 'json' }),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Type exports for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type GameState = typeof gameStates.$inferSelect;
export type NewGameState = typeof gameStates.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
