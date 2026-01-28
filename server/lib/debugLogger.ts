/**
 * Debug logging utilities for tracking state synchronization issues
 * Enable with DEBUG_TRANSACTIONS=true environment variable
 */

const DEBUG_ENABLED = process.env.DEBUG_TRANSACTIONS === 'true';

export interface TransactionLog {
  timestamp: number;
  userId: string;
  endpoint: string;
  clientTxId?: string;
  phase: 'START' | 'BEFORE_PASSIVE' | 'AFTER_PASSIVE' | 'VALIDATION' | 'SUCCESS' | 'ERROR';
  resources?: {
    essence: number;
    crystals: number;
    gold: number;
    souls: number;
  };
  resourceCaps?: {
    essence: number;
    crystals: number;
    gold: number;
    souls: number;
  };
  action?: string;
  cost?: Partial<Record<string, number>>;
  error?: string;
}

const transactionLogs: TransactionLog[] = [];

export function logTransaction(log: TransactionLog) {
  if (!DEBUG_ENABLED) return;

  transactionLogs.push(log);

  const emoji = {
    START: '🎬',
    BEFORE_PASSIVE: '⏰',
    AFTER_PASSIVE: '💰',
    VALIDATION: '🔍',
    SUCCESS: '✅',
    ERROR: '❌',
  }[log.phase];

  console.log(`${emoji} [${log.endpoint}] ${log.phase} - ${log.userId.substring(0, 8)}...`);
  
  if (log.clientTxId) {
    console.log(`   TxID: ${log.clientTxId}`);
  }

  if (log.action) {
    console.log(`   Action: ${log.action}`);
  }

  if (log.cost) {
    console.log(`   Cost: ${JSON.stringify(log.cost)}`);
  }

  if (log.resources) {
    console.log(`   Resources: E=${log.resources.essence} C=${log.resources.crystals} G=${log.resources.gold} S=${log.resources.souls}`);
  }

  if (log.resourceCaps) {
    console.log(`   Caps: E=${log.resourceCaps.essence} C=${log.resourceCaps.crystals} G=${log.resourceCaps.gold} S=${log.resourceCaps.souls}`);
  }

  if (log.error) {
    console.log(`   Error: ${log.error}`);
  }

  console.log(''); // Empty line for readability
}

export function getTransactionLogs(userId?: string): TransactionLog[] {
  if (userId) {
    return transactionLogs.filter(log => log.userId === userId);
  }
  return transactionLogs;
}

export function clearTransactionLogs() {
  transactionLogs.length = 0;
}

/**
 * Helper to create a transaction logger for a specific endpoint
 */
export function createTransactionLogger(endpoint: string, userId: string, clientTxId?: string) {
  return {
    start: (resources: TransactionLog['resources'], resourceCaps: TransactionLog['resourceCaps']) => {
      logTransaction({
        timestamp: Date.now(),
        userId,
        endpoint,
        clientTxId,
        phase: 'START',
        resources,
        resourceCaps,
      });
    },

    beforePassive: (resources: TransactionLog['resources']) => {
      logTransaction({
        timestamp: Date.now(),
        userId,
        endpoint,
        clientTxId,
        phase: 'BEFORE_PASSIVE',
        resources,
      });
    },

    afterPassive: (resources: TransactionLog['resources'], resourceCaps: TransactionLog['resourceCaps']) => {
      logTransaction({
        timestamp: Date.now(),
        userId,
        endpoint,
        clientTxId,
        phase: 'AFTER_PASSIVE',
        resources,
        resourceCaps,
      });
    },

    validation: (action: string, cost: Partial<Record<string, number>>, resources: TransactionLog['resources']) => {
      logTransaction({
        timestamp: Date.now(),
        userId,
        endpoint,
        clientTxId,
        phase: 'VALIDATION',
        action,
        cost,
        resources,
      });
    },

    success: (resources: TransactionLog['resources'], resourceCaps: TransactionLog['resourceCaps']) => {
      logTransaction({
        timestamp: Date.now(),
        userId,
        endpoint,
        clientTxId,
        phase: 'SUCCESS',
        resources,
        resourceCaps,
      });
    },

    error: (error: string, resources?: TransactionLog['resources']) => {
      logTransaction({
        timestamp: Date.now(),
        userId,
        endpoint,
        clientTxId,
        phase: 'ERROR',
        error,
        resources,
      });
    },
  };
}

