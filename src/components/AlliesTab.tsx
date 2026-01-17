import { Box, Heading, Text } from '@ts-query/ui-react';

export const AlliesTab = () => {
  return (
    <Box
      bg="var(--bg-secondary)"
      p={5}
      rounded="8px"
      style={{
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 217, 255, 0.1)',
        border: '1px solid var(--border-color)',
      }}
    >
      <Heading level={3} style={{ marginBottom: '15px', color: 'var(--accent-teal)' }}>
        👥 Allies
      </Heading>
      <Text style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
        Allies system coming soon... Recruit powerful hunters to join your shadow army!
      </Text>
    </Box>
  );
};

