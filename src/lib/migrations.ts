/**
 * Migration system for localStorage data
 * Handles version upgrades to preserve player progress
 */

const CURRENT_VERSION = 3;

interface StorageData {
  version?: number;
  [key: string]: unknown;
}

/**
 * Migrate buildings data to add new buildings
 */
const migrateBuildings = (buildings: Record<string, unknown>): Record<string, unknown> => {
  // Add merchantGuild if it doesn't exist
  if (!buildings.merchantGuild) {
    buildings.merchantGuild = {
      id: 'merchantGuild',
      name: '💰 Merchant Guild',
      description: 'Generates gold through trade and commerce',
      count: 0,
      baseCost: {
        essence: 30,
        crystals: 0,
        gold: 0,
        souls: 0,
        attraction: 0,
        gems: 0,
        knowledge: 0,
      },
      costMultiplier: 1.15,
      produces: { gold: 1 },
      perSecond: 0.15,
    };
  }
  return buildings;
};

/**
 * Migrate from version 1 to version 2
 */
const migrateV1toV2 = (data: StorageData): StorageData => {
  console.log('🔄 Migrating from v1 to v2...');
  // V2 added hunter stats affecting caps
  // No data changes needed, just version bump
  return { ...data, version: 2 };
};

/**
 * Migrate from version 2 to version 3
 */
const migrateV2toV3 = (data: StorageData): StorageData => {
  console.log('🔄 Migrating from v2 to v3 (adding artifacts system)...');
  
  // V3 adds artifacts system
  // Initialize artifacts store if it doesn't exist
  const artifactsKey = 'arise-artifacts-state';
  const artifactsData = localStorage.getItem(artifactsKey);
  
  if (!artifactsData) {
    const initialArtifactsState = {
      equipped: {},
      inventory: [],
      blacksmithLevel: 1,
      blacksmithXp: 0,
      blacksmithXpToNextLevel: 100,
    };
    localStorage.setItem(artifactsKey, JSON.stringify(initialArtifactsState));
    console.log('✅ Initialized artifacts system');
  }
  
  // Add merchantGuild to buildings
  const buildingsKey = 'arise-buildings-storage';
  const buildingsData = localStorage.getItem(buildingsKey);
  
  if (buildingsData) {
    try {
      const parsed = JSON.parse(buildingsData);
      if (parsed.buildings) {
        parsed.buildings = migrateBuildings(parsed.buildings);
        localStorage.setItem(buildingsKey, JSON.stringify(parsed));
        console.log('✅ Added Merchant Guild building');
      }
    } catch (error) {
      console.error('Failed to migrate buildings:', error);
    }
  }
  
  return { ...data, version: 3 };
};

/**
 * Run all necessary migrations
 */
export const runMigrations = (): void => {
  try {
    const gameKey = 'arise-game-storage';
    const stored = localStorage.getItem(gameKey);
    
    if (!stored) {
      // New player, no migration needed
      console.log('🆕 New player detected, no migration needed');
      return;
    }
    
    let data: StorageData = JSON.parse(stored);
    const currentVersion = data.version || 1;
    
    if (currentVersion === CURRENT_VERSION) {
      console.log(`✅ Already on latest version (v${CURRENT_VERSION})`);
      return;
    }
    
    console.log(`🔄 Migrating from v${currentVersion} to v${CURRENT_VERSION}...`);
    
    // Run migrations in sequence
    if (currentVersion < 2) {
      data = migrateV1toV2(data);
    }
    if (currentVersion < 3) {
      data = migrateV2toV3(data);
    }
    
    // Save migrated data
    localStorage.setItem(gameKey, JSON.stringify(data));
    console.log(`✅ Migration complete! Now on v${CURRENT_VERSION}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.warn('⚠️ You may need to reset your save if issues persist');
  }
};

/**
 * Get current version
 */
export const getCurrentVersion = (): number => {
  return CURRENT_VERSION;
};

