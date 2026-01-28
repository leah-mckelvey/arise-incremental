/**
 * API client for backend game endpoints
 */

import type {
  GameStateResponse,
  TransactionResponse,
  GatherResourceRequest,
  PurchaseBuildingRequest,
  PurchaseBulkBuildingRequest,
  AllocateStatRequest,
  PurchaseResearchRequest,
  StartDungeonRequest,
  CompleteDungeonRequest,
  CancelDungeonRequest,
  RecruitAllyRequest,
  ExtractShadowRequest,
  ResetGameRequest,
} from '../../shared/types';
import { logFrontendTransaction } from '../lib/debugLogger';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Generate a unique client transaction ID
 */
export function generateClientTxId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Helper to extract resource state for logging
 */
function extractResourceState(state: unknown) {
  if (!state || typeof state !== 'object') return undefined;
  const stateObj = state as Record<string, unknown>;
  if (!stateObj.resources || typeof stateObj.resources !== 'object') return undefined;
  const resources = stateObj.resources as Record<string, unknown>;
  return {
    essence: typeof resources.essence === 'number' ? resources.essence : 0,
    crystals: typeof resources.crystals === 'number' ? resources.crystals : 0,
    gold: typeof resources.gold === 'number' ? resources.gold : 0,
    souls: typeof resources.souls === 'number' ? resources.souls : 0,
  };
}

/**
 * Helper to handle API response with logging
 * Parses error responses and extracts detailed error messages
 */
async function handleApiResponse(
  response: Response,
  endpoint: string,
  clientTxId: string,
  action: string
): Promise<TransactionResponse> {
  const responseBody = await response.json();

  if (!response.ok) {
    // Log error with details from response body
    const errorMessage = responseBody.error || response.statusText;
    logFrontendTransaction({
      timestamp: Date.now(),
      phase: 'ERROR',
      endpoint,
      clientTxId,
      action,
      error: errorMessage,
      responseBody,
      serverState: extractResourceState(responseBody.state),
    });

    // Throw error with detailed message
    throw new Error(errorMessage);
  }

  // Log successful response
  logFrontendTransaction({
    timestamp: Date.now(),
    phase: 'API_RESPONSE',
    endpoint,
    clientTxId,
    action,
    responseBody,
    serverState: extractResourceState(responseBody.state),
  });

  return responseBody;
}

/**
 * GET /api/game/state
 * Load game state with offline gains
 */
export async function getGameState(): Promise<GameStateResponse> {
  const response = await fetch(`${API_BASE}/api/game/state`);
  if (!response.ok) {
    throw new Error(`Failed to load game state: ${response.statusText}`);
  }
  return response.json();
}

/**
 * POST /api/game/gather-resource
 * Manually gather a resource (1 at a time for anti-cheat)
 */
export async function gatherResource(
  resource: 'essence' | 'crystals' | 'gold'
): Promise<TransactionResponse> {
  const clientTxId = generateClientTxId();
  const endpoint = '/api/game/gather-resource';
  const action = `Gather ${resource}`;

  const request: GatherResourceRequest = {
    resource,
    clientTxId,
  };

  // Log API request
  logFrontendTransaction({
    timestamp: Date.now(),
    phase: 'API_REQUEST',
    endpoint,
    clientTxId,
    action,
    requestBody: request,
  });

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  return handleApiResponse(response, endpoint, clientTxId, action);
}

/**
 * POST /api/game/purchase-building
 * Purchase a single building
 */
export async function purchaseBuilding(buildingId: string): Promise<TransactionResponse> {
  const clientTxId = generateClientTxId();
  const endpoint = '/api/game/purchase-building';
  const action = `Purchase building ${buildingId}`;

  const request: PurchaseBuildingRequest = {
    buildingId,
    clientTxId,
  };

  // Log API request
  logFrontendTransaction({
    timestamp: Date.now(),
    phase: 'API_REQUEST',
    endpoint,
    clientTxId,
    action,
    requestBody: request,
  });

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  return handleApiResponse(response, endpoint, clientTxId, action);
}

/**
 * POST /api/game/purchase-bulk-building
 * Purchase multiple buildings at once
 */
export async function purchaseBulkBuilding(
  buildingId: string,
  quantity: number
): Promise<TransactionResponse> {
  const clientTxId = generateClientTxId();
  const endpoint = '/api/game/purchase-bulk-building';
  const action = `Purchase ${quantity}x ${buildingId}`;

  const request: PurchaseBulkBuildingRequest = {
    buildingId,
    quantity,
    clientTxId,
  };

  // Log API request
  logFrontendTransaction({
    timestamp: Date.now(),
    phase: 'API_REQUEST',
    endpoint,
    clientTxId,
    action,
    requestBody: request,
  });

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  return handleApiResponse(response, endpoint, clientTxId, action);
}

/**
 * POST /api/game/allocate-stat
 * Allocate a hunter stat point
 */
export async function allocateStat(
  stat: 'strength' | 'agility' | 'intelligence' | 'vitality' | 'sense' | 'authority'
): Promise<TransactionResponse> {
  const request: AllocateStatRequest = {
    stat,
    clientTxId: generateClientTxId(),
  };

  const response = await fetch(`${API_BASE}/api/game/allocate-stat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to allocate stat: ${response.statusText}`);
  }
  return response.json();
}

/**
 * POST /api/game/purchase-research
 * Purchase a research upgrade
 */
export async function purchaseResearch(researchId: string): Promise<TransactionResponse> {
  const clientTxId = generateClientTxId();
  const endpoint = '/api/game/purchase-research';
  const action = `Purchase research ${researchId}`;

  const request: PurchaseResearchRequest = {
    researchId,
    clientTxId,
  };

  // Log API request
  logFrontendTransaction({
    timestamp: Date.now(),
    phase: 'API_REQUEST',
    endpoint,
    clientTxId,
    action,
    requestBody: request,
  });

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  return handleApiResponse(response, endpoint, clientTxId, action);
}

/**
 * POST /api/game/start-dungeon
 * Start a dungeon run with a party
 */
export async function startDungeon(
  dungeonId: string,
  partyIds: string[]
): Promise<TransactionResponse> {
  const request: StartDungeonRequest = {
    dungeonId,
    partyIds,
    clientTxId: generateClientTxId(),
  };

  const response = await fetch(`${API_BASE}/api/game/start-dungeon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to start dungeon: ${response.statusText}`);
  }
  return response.json();
}

/**
 * POST /api/game/complete-dungeon
 * Complete a dungeon and claim rewards
 */
export async function completeDungeon(activeDungeonId: string): Promise<TransactionResponse> {
  const request: CompleteDungeonRequest = {
    activeDungeonId,
    clientTxId: generateClientTxId(),
  };

  const response = await fetch(`${API_BASE}/api/game/complete-dungeon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to complete dungeon: ${response.statusText}`);
  }
  return response.json();
}

/**
 * POST /api/game/cancel-dungeon
 * Cancel an active dungeon run
 */
export async function cancelDungeon(activeDungeonId: string): Promise<TransactionResponse> {
  const request: CancelDungeonRequest = {
    activeDungeonId,
    clientTxId: generateClientTxId(),
  };

  const response = await fetch(`${API_BASE}/api/game/cancel-dungeon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel dungeon: ${response.statusText}`);
  }
  return response.json();
}

/**
 * POST /api/game/recruit-ally
 * Recruit a new ally with attraction
 */
export async function recruitAlly(name: string, rank: string): Promise<TransactionResponse> {
  const clientTxId = generateClientTxId();
  const endpoint = '/api/game/recruit-ally';
  const action = `Recruit ${rank}-rank ally ${name}`;

  const request: RecruitAllyRequest = {
    name,
    rank,
    clientTxId,
  };

  // Log API request
  logFrontendTransaction({
    timestamp: Date.now(),
    phase: 'API_REQUEST',
    endpoint,
    clientTxId,
    action,
    requestBody: request,
  });

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  return handleApiResponse(response, endpoint, clientTxId, action);
}

/**
 * POST /api/game/extract-shadow
 * Extract a shadow from a defeated enemy
 */
export async function extractShadow(name: string, dungeonId: string): Promise<TransactionResponse> {
  const clientTxId = generateClientTxId();
  const endpoint = '/api/game/extract-shadow';
  const action = `Extract shadow ${name} from ${dungeonId}`;

  const request: ExtractShadowRequest = {
    name,
    dungeonId,
    clientTxId,
  };

  // Log API request
  logFrontendTransaction({
    timestamp: Date.now(),
    phase: 'API_REQUEST',
    endpoint,
    clientTxId,
    action,
    requestBody: request,
  });

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  return handleApiResponse(response, endpoint, clientTxId, action);
}

/**
 * POST /api/game/reset
 * Reset game to initial state
 */
export async function resetGame(): Promise<TransactionResponse> {
  const request: ResetGameRequest = {
    clientTxId: generateClientTxId(),
  };

  const response = await fetch(`${API_BASE}/api/game/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to reset game: ${response.statusText}`);
  }
  return response.json();
}

