import { gameStore } from '../store/gameStore';
import { useHunterQuery } from '../queries/gameQueries';
import { Box, Heading, Button, Text } from '@ts-query/ui-react';

export const GatheringActions = () => {
  // Get functions directly from the store
  const gatherResource = gameStore.getState().gatherResource;
  const { data: hunter } = useHunterQuery();

  if (!hunter) return null;

  // Calculate stat bonuses for display
  const essenceBonus = Math.floor(hunter.stats.intelligence * 0.1);
  const crystalsBonus = Math.floor(hunter.stats.agility * 0.1);
  const goldBonus = Math.floor(hunter.stats.strength * 0.1);

  return (
    <Box
      bg="var(--bg-secondary)"
      p={5}
      rounded="8px"
      mb={5}
      style={{
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 217, 255, 0.1)',
        border: '1px solid var(--border-color)',
      }}
    >
      <Heading level={3} style={{ marginBottom: '15px', color: 'var(--accent-teal)' }}>
        ⚒️ Hunt & Gather
      </Heading>
      <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        <Box>
          <Button
            onClick={() => gatherResource('essence')}
            size="md"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: '1px solid #667eea',
              fontWeight: 'bold',
              width: '100%',
            }}
          >
            🔮 Gather Essence
            <br />
            <span style={{ fontSize: '12px', opacity: 0.9 }}>+{1 + essenceBonus} | +5 XP</span>
          </Button>
          <Text
            fontSize="11px"
            style={{
              color: 'var(--text-secondary)',
              marginTop: '4px',
              textAlign: 'center',
            }}
          >
            🧠 INT bonus: +{essenceBonus}
          </Text>
        </Box>

        <Box>
          <Button
            onClick={() => gatherResource('crystals')}
            size="md"
            style={{
              background: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
              color: '#fff',
              border: '1px solid #00d9ff',
              fontWeight: 'bold',
              width: '100%',
            }}
          >
            💎 Mine Crystals
            <br />
            <span style={{ fontSize: '12px', opacity: 0.9 }}>+{1 + crystalsBonus} | +8 XP</span>
          </Button>
          <Text
            fontSize="11px"
            style={{
              color: 'var(--text-secondary)',
              marginTop: '4px',
              textAlign: 'center',
            }}
          >
            ⚡ AGI bonus: +{crystalsBonus}
          </Text>
        </Box>

        <Box>
          <Button
            onClick={() => gatherResource('gold')}
            size="md"
            style={{
              background: 'linear-gradient(135deg, #ffd700 0%, #cc9900 100%)',
              color: '#000',
              border: '1px solid #ffd700',
              fontWeight: 'bold',
              width: '100%',
            }}
          >
            💰 Collect Gold
            <br />
            <span style={{ fontSize: '12px', opacity: 0.9 }}>+{1 + goldBonus} | +12 XP</span>
          </Button>
          <Text
            fontSize="11px"
            style={{
              color: 'var(--text-secondary)',
              marginTop: '4px',
              textAlign: 'center',
            }}
          >
            💪 STR bonus: +{goldBonus}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
