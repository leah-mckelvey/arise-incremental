/**
 * Companion (ally and shadow) recruitment actions
 * Handles recruiting allies and extracting shadows with optimistic updates
 */

import { gameStore } from '../gameStore';
import { useAlliesStore } from '../alliesStore';
import { useShadowsStore } from '../shadowsStore';
import { useNotificationsStore } from '../notificationsStore';
import * as gameApi from '../../api/gameApi';
import { syncServerState } from './syncActions';

export const recruitGenericAlly = async (name: string, rank: string, attractionCost: number) => {
  // Validate affordability before optimistic update
  // addResource clamps at 0, so we must check explicitly
  const currentAttraction = gameStore.getState().resources.attraction;
  if (currentAttraction < attractionCost) {
    useNotificationsStore
      .getState()
      .addNotification(
        'error',
        'Insufficient Attraction',
        'Not enough attraction to recruit this ally.',
        undefined,
        5000
      );
    return;
  }

  // Store previous state for rollback
  const previousResources = gameStore.getState().resources;
  const previousAllies = useAlliesStore.getState().allies;

  // Optimistic update - deduct attraction and recruit ally
  // TODO(PR#6): Optimistic ally recruitment creates client-side ID/name (e.g., "Shadow Soldier #3").
  // syncServerState() replaces allies array with server-generated IDs/names. If the player selects
  // the new ally into partyIds before the API returns, those references can become invalid after sync.
  // Potential fixes: 1) Use server-assigned IDs only (wait for API), 2) Reconcile client/server IDs,
  // 3) Use temporary IDs that get mapped after sync.
  gameStore.getState().addResource('attraction', -attractionCost);
  useAlliesStore.getState().recruitGenericAlly(name, rank);

  // Track pending mutation
  gameStore.setState((s) => ({ pendingMutations: s.pendingMutations + 1 }));

  try {
    // Background API call
    const response = await gameApi.recruitAlly(name, rank);
    // Success - sync server state
    syncServerState(response.state);
  } catch (error) {
    // Rollback on error
    gameStore.setState({ resources: previousResources });
    useAlliesStore.setState({ allies: previousAllies });
    console.error('Failed to recruit ally:', error);
    useNotificationsStore
      .getState()
      .addNotification(
        'error',
        'Recruitment Failed',
        'Failed to recruit ally. Your resources have been restored.',
        undefined,
        5000
      );
  } finally {
    gameStore.setState((s) => ({ pendingMutations: s.pendingMutations - 1 }));
  }
};

export const extractShadowManual = async (name: string, dungeonId: string, soulsCost: number) => {
  // Check if necromancer is unlocked before attempting extraction
  if (!useShadowsStore.getState().necromancerUnlocked) {
    useNotificationsStore
      .getState()
      .addNotification(
        'error',
        'Extraction Failed',
        'Necromancer ability is not unlocked.',
        undefined,
        5000
      );
    return;
  }

  // Validate affordability before optimistic update
  // addResource clamps at 0, so we must check explicitly
  const currentSouls = gameStore.getState().resources.souls;
  if (currentSouls < soulsCost) {
    useNotificationsStore
      .getState()
      .addNotification(
        'error',
        'Insufficient Souls',
        'Not enough souls to extract this shadow.',
        undefined,
        5000
      );
    return;
  }

  // Check if shadow already exists BEFORE deducting souls (prevents double-extraction race condition)
  // PR #6 Review: extractShadow returns existing shadow if name matches, but we'd have already deducted souls
  const existingShadow = useShadowsStore.getState().shadows.find((s) => s.name === name);
  if (existingShadow) {
    useNotificationsStore
      .getState()
      .addNotification(
        'info',
        'Shadow Already Extracted',
        `${name} has already been extracted.`,
        undefined,
        3000
      );
    return;
  }

  // Store previous state for rollback
  const previousResources = gameStore.getState().resources;
  const previousShadows = useShadowsStore.getState().shadows;

  // Optimistic update - deduct souls and extract shadow
  gameStore.getState().addResource('souls', -soulsCost);
  const shadow = useShadowsStore.getState().extractShadow(name, dungeonId);

  // Safety check - if extraction failed, rollback immediately
  if (!shadow) {
    gameStore.setState({ resources: previousResources });
    useNotificationsStore
      .getState()
      .addNotification('error', 'Extraction Failed', 'Failed to extract shadow.', undefined, 5000);
    return;
  }

  // Track pending mutation
  gameStore.setState((s) => ({ pendingMutations: s.pendingMutations + 1 }));

  try {
    // Background API call
    const response = await gameApi.extractShadow(name, dungeonId);
    // Success - sync server state
    syncServerState(response.state);
  } catch (error) {
    // Rollback on error
    gameStore.setState({ resources: previousResources });
    useShadowsStore.setState({ shadows: previousShadows });
    console.error('Failed to extract shadow:', error);
    useNotificationsStore
      .getState()
      .addNotification(
        'error',
        'Extraction Failed',
        'Failed to extract shadow. Your resources have been restored.',
        undefined,
        5000
      );
  } finally {
    gameStore.setState((s) => ({ pendingMutations: s.pendingMutations - 1 }));
  }
};
