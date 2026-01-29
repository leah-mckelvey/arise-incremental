import { Box, Text } from '@ts-query/ui-react';

interface OwnedBadgeProps {
  count: number;
}

export const OwnedBadge = ({ count }: OwnedBadgeProps) => {
  return (
    <Box
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)',
        padding: '6px 12px',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      }}
    >
      <Text
        as="span"
        style={{
          fontSize: '12px',
          fontWeight: '600',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Owned
      </Text>
      <Text
        as="span"
        style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: 'var(--accent-teal)',
          fontFamily: 'monospace',
          textShadow: '0 0 10px rgba(0, 217, 255, 0.5)',
        }}
      >
        {count}
      </Text>
    </Box>
  );
};
