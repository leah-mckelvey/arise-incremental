import { useStore } from '@ts-query/react';
import { gameStore, getEffectiveHunterStats, useArtifactsStore } from '../store/gameStore';
import { useHunterQuery, useResearchQuery } from '../queries/gameQueries';
import { calculateGatherAmount, calculateGatherXp } from '../lib/calculations/resourceCalculations';
import { Box, Heading, Button, Text } from '@ts-query/ui-react';

export const GatheringActions = () => {
  // Get functions directly from the store
  const gatherResource = gameStore.getState().gatherResource;
  const { data: hunter } = useHunterQuery();
  const { data: research } = useResearchQuery();
  // Subscribe to artifacts store to re-render when artifacts change
  useStore(useArtifactsStore, (state) => state.equipped);

  if (!hunter || !research) return null;

  // effectiveStats will now update when artifacts change because we're subscribed to artifacts store
  const effectiveStats = getEffectiveHunterStats();

  // Calculate actual gather amounts using the same function as the actual gathering
  const essenceAmount = calculateGatherAmount('essence', effectiveStats, research).toFixed(1);
  const crystalsAmount = calculateGatherAmount('crystals', effectiveStats, research).toFixed(1);
  const goldAmount = calculateGatherAmount('gold', effectiveStats, research).toFixed(1);

  // XP calculation using the same function as actual gathering
  const essenceXp = calculateGatherXp('essence', effectiveStats).toFixed(2);
  const crystalsXp = calculateGatherXp('crystals', effectiveStats).toFixed(2);
  const goldXp = calculateGatherXp('gold', effectiveStats).toFixed(2);

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
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
        }}
      >
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
            <span style={{ fontSize: '12px', opacity: 0.9 }}>
              +{essenceAmount} | +{essenceXp} XP
            </span>
          </Button>
          <Text
            fontSize="11px"
            style={{
              color: 'var(--text-secondary)',
              marginTop: '4px',
              textAlign: 'center',
            }}
          >
            👁️ SENSE: {hunter.stats.sense}
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
            <span style={{ fontSize: '12px', opacity: 0.9 }}>
              +{crystalsAmount} | +{crystalsXp} XP
            </span>
          </Button>
          <Text
            fontSize="11px"
            style={{
              color: 'var(--text-secondary)',
              marginTop: '4px',
              textAlign: 'center',
            }}
          >
            🧠 INT: {hunter.stats.intelligence}
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
            <span style={{ fontSize: '12px', opacity: 0.9 }}>
              +{goldAmount} | +{goldXp} XP
            </span>
          </Button>
          <Text
            fontSize="11px"
            style={{
              color: 'var(--text-secondary)',
              marginTop: '4px',
              textAlign: 'center',
            }}
          >
            ⚡ AGI: {hunter.stats.agility}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
