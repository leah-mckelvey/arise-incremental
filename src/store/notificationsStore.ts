import { createStore } from '@ts-query/core';
import type { Notification, NotificationType, DungeonRewards } from './types';

// Counter to ensure unique notification IDs even when created in the same millisecond
let notificationIdCounter = 0;

export interface NotificationsState {
  notifications: Notification[];
  
  // Actions
  addNotification: (
    type: NotificationType,
    title: string,
    message: string,
    rewards?: DungeonRewards,
    duration?: number
  ) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationsStore = createStore<NotificationsState>((set, get) => {
  const store: NotificationsState = {
    notifications: [],

    addNotification: (type, title, message, rewards, duration = 5000) => {
      const id = `notification-${Date.now()}-${notificationIdCounter++}`;
      const notification: Notification = {
        id,
        type,
        title,
        message,
        rewards,
        timestamp: Date.now(),
        duration,
      };

      set((state) => ({
        notifications: [...state.notifications, notification],
      }));

      // Auto-remove after duration
      setTimeout(() => {
        get().removeNotification(id);
      }, duration);
    },

    removeNotification: (id) => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    },

    clearAll: () => {
      set({ notifications: [] });
    },
  };

  return store;
});

