import { useStore } from '@ts-query/react';
import { Box, Text } from '@ts-query/ui-react';
import { useNotificationsStore } from '../store/notificationsStore';
import type { Notification } from '../store/types';

export function NotificationDisplay() {
  const notifications = useStore(useNotificationsStore, (state) => state.notifications);
  const removeNotification = useNotificationsStore.getState().removeNotification;

  const getNotificationStyle = (type: Notification['type']) => {
    const baseStyle = {
      padding: '20px',
      borderRadius: '12px',
      marginBottom: '15px',
      minWidth: '350px',
      maxWidth: '450px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 217, 255, 0.3)',
      border: '2px solid',
      animation: 'slideInRight 0.3s ease-out, fadeOut 0.3s ease-in 4.7s',
      cursor: 'pointer',
    };

    const typeStyles: Record<Notification['type'], { background: string; borderColor: string }> = {
      dungeon_complete: {
        background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.15), rgba(138, 43, 226, 0.15))',
        borderColor: 'var(--accent-teal)',
      },
      level_up: {
        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 140, 0, 0.15))',
        borderColor: 'var(--accent-gold)',
      },
      unlock: {
        background: 'linear-gradient(135deg, rgba(0, 255, 127, 0.15), rgba(0, 191, 255, 0.15))',
        borderColor: 'var(--accent-green)',
      },
      craft: {
        background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.15), rgba(255, 0, 255, 0.15))',
        borderColor: 'var(--accent-purple)',
      },
      error: {
        background: 'linear-gradient(135deg, rgba(255, 0, 0, 0.15), rgba(139, 0, 0, 0.15))',
        borderColor: 'var(--danger)',
      },
    };

    return { ...baseStyle, ...typeStyles[type] };
  };

  const getIcon = (type: Notification['type']) => {
    const icons: Record<Notification['type'], string> = {
      dungeon_complete: '🏆',
      level_up: '⭐',
      unlock: '🔓',
      craft: '⚒️',
      error: '❌',
    };
    return icons[type];
  };

  const formatReward = (resource: string, amount: number) => {
    const icons: Record<string, string> = {
      essence: '✨',
      crystals: '💎',
      gold: '💰',
      souls: '👻',
      attraction: '❤️',
      gems: '💚',
      knowledge: '📚',
      experience: '⭐',
    };
    return `${icons[resource] || '•'} ${amount.toLocaleString()}`;
  };

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
      `}</style>

      <Box
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        {notifications.map((notification) => (
          <Box
            key={notification.id}
            onClick={() => removeNotification(notification.id)}
            style={{
              ...getNotificationStyle(notification.type),
              pointerEvents: 'auto',
            }}
          >
            {/* Header */}
            <Box style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <Text style={{ fontSize: '32px' }}>{getIcon(notification.type)}</Text>
              <Box>
                <Text style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  {notification.title}
                </Text>
                <Text style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {notification.message}
                </Text>
              </Box>
            </Box>

            {/* Rewards */}
            {notification.rewards && (
              <Box
                style={{
                  marginTop: '15px',
                  padding: '12px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '8px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                }}
              >
                {Object.entries(notification.rewards).map(([resource, amount]) => {
                  if (amount === 0) return null;
                  return (
                    <Text
                      key={resource}
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        fontWeight: '600',
                      }}
                    >
                      {formatReward(resource, amount)}
                    </Text>
                  );
                })}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </>
  );
}

