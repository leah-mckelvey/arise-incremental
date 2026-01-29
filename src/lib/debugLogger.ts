/**
 * Frontend debug logging for tracking state synchronization
 * Enable with localStorage.setItem('DEBUG_TRANSACTIONS', 'true')
 */

export interface FrontendTransactionLog {
  timestamp: number;
  phase: 'OPTIMISTIC_START' | 'API_REQUEST' | 'API_RESPONSE' | 'SYNC_STATE' | 'ERROR' | 'ROLLBACK';
  endpoint: string;
  clientTxId?: string;
  action?: string;
  localState?: {
    essence: number;
    crystals: number;
    gold: number;
    souls: number;
  };
  serverState?: {
    essence: number;
    crystals: number;
    gold: number;
    souls: number;
  };
  error?: string;
  requestBody?: unknown;
  responseBody?: unknown;
}

const logs: FrontendTransactionLog[] = [];

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('DEBUG_TRANSACTIONS') === 'true';
}

export function logFrontendTransaction(log: FrontendTransactionLog) {
  if (!isDebugEnabled()) return;

  logs.push(log);

  const emoji = {
    OPTIMISTIC_START: '🚀',
    API_REQUEST: '📤',
    API_RESPONSE: '📥',
    SYNC_STATE: '🔄',
    ERROR: '❌',
    ROLLBACK: '↩️',
  }[log.phase];

  console.group(`${emoji} [FRONTEND] ${log.phase} - ${log.endpoint}`);

  if (log.clientTxId) {
    console.log(`TxID: ${log.clientTxId}`);
  }

  if (log.action) {
    console.log(`Action: ${log.action}`);
  }

  if (log.localState) {
    console.log('Local State:', log.localState);
  }

  if (log.serverState) {
    console.log('Server State:', log.serverState);
  }

  if (log.localState && log.serverState) {
    const diff = {
      essence: log.serverState.essence - log.localState.essence,
      crystals: log.serverState.crystals - log.localState.crystals,
      gold: log.serverState.gold - log.localState.gold,
      souls: log.serverState.souls - log.localState.souls,
    };

    const hasDiff = Object.values(diff).some((d) => d !== 0);
    if (hasDiff) {
      console.warn('⚠️ STATE DESYNC DETECTED:', diff);
    }
  }

  if (log.requestBody) {
    console.log('Request:', log.requestBody);
  }

  if (log.responseBody) {
    console.log('Response:', log.responseBody);
  }

  if (log.error) {
    console.error('Error:', log.error);
  }

  console.groupEnd();
}

export function getFrontendLogs(): FrontendTransactionLog[] {
  return logs;
}

export function clearFrontendLogs() {
  logs.length = 0;
}

/**
 * Helper to create a transaction logger for a specific action
 */
export function createFrontendLogger(endpoint: string, action: string, clientTxId: string) {
  return {
    optimisticStart: (localState: FrontendTransactionLog['localState']) => {
      logFrontendTransaction({
        timestamp: Date.now(),
        phase: 'OPTIMISTIC_START',
        endpoint,
        clientTxId,
        action,
        localState,
      });
    },

    apiRequest: (requestBody: unknown, localState: FrontendTransactionLog['localState']) => {
      logFrontendTransaction({
        timestamp: Date.now(),
        phase: 'API_REQUEST',
        endpoint,
        clientTxId,
        action,
        requestBody,
        localState,
      });
    },

    apiResponse: (
      responseBody: unknown,
      serverState: FrontendTransactionLog['serverState'],
      localState: FrontendTransactionLog['localState']
    ) => {
      logFrontendTransaction({
        timestamp: Date.now(),
        phase: 'API_RESPONSE',
        endpoint,
        clientTxId,
        action,
        responseBody,
        serverState,
        localState,
      });
    },

    syncState: (
      serverState: FrontendTransactionLog['serverState'],
      localState: FrontendTransactionLog['localState']
    ) => {
      logFrontendTransaction({
        timestamp: Date.now(),
        phase: 'SYNC_STATE',
        endpoint,
        clientTxId,
        action,
        serverState,
        localState,
      });
    },

    error: (error: string, localState?: FrontendTransactionLog['localState']) => {
      logFrontendTransaction({
        timestamp: Date.now(),
        phase: 'ERROR',
        endpoint,
        clientTxId,
        action,
        error,
        localState,
      });
    },

    rollback: (localState: FrontendTransactionLog['localState']) => {
      logFrontendTransaction({
        timestamp: Date.now(),
        phase: 'ROLLBACK',
        endpoint,
        clientTxId,
        action,
        localState,
      });
    },
  };
}
