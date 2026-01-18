import { useResearchQuery, useResourcesQuery } from '../queries/gameQueries';
import { purchaseResearch } from '../store/gameStore';
import { Box, Heading, Text, Button, Stack } from '@ts-query/ui-react';

export const ResearchTab = () => {
  const { data: research } = useResearchQuery();
  const { data: resources } = useResourcesQuery();

  if (!research || !resources) return null;

  const canResearch = (researchId: string): boolean => {
    const tech = research[researchId];
    if (!tech || tech.researched) return false;
    if (resources.knowledge < tech.cost) return false;

    // Check prerequisites
    if (tech.requires) {
      return tech.requires.every((reqId) => research[reqId]?.researched);
    }

    return true;
  };

  const isLocked = (researchId: string): boolean => {
    const tech = research[researchId];
    if (!tech || tech.researched) return false;

    if (tech.requires) {
      return !tech.requires.every((reqId) => research[reqId]?.researched);
    }

    return false;
  };

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
        🔬 Research & Technology
      </Heading>
      <Text style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
        Unlock powerful upgrades and synergies using Knowledge Points
      </Text>

      <Stack gap={2.5}>
        {Object.values(research).map((tech) => {
          const canAfford = canResearch(tech.id);
          const locked = isLocked(tech.id);
          const researched = tech.researched;

          return (
            <Box
              key={tech.id}
              bg="var(--bg-tertiary)"
              p={3.75}
              rounded="4px"
              style={{
                border: researched
                  ? '2px solid var(--success)'
                  : canAfford
                  ? '2px solid var(--accent-teal)'
                  : locked
                  ? '2px solid var(--text-dim)'
                  : '2px solid var(--border-color)',
                boxShadow: canAfford && !researched
                  ? '0 0 15px var(--border-glow)'
                  : 'none',
                opacity: locked ? 0.5 : 1,
              }}
            >
              <Box
                mb={2}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Text
                    fontSize="18px"
                    fontWeight="bold"
                    style={{ color: researched ? 'var(--success)' : 'var(--text-primary)' }}
                  >
                    {tech.name} {researched && '✓'}
                  </Text>
                </Box>
                {!researched && (
                  <Button
                    onClick={() => purchaseResearch(tech.id)}
                    disabled={!canAfford || locked}
                    size="sm"
                    style={{
                      background: canAfford ? 'var(--accent-teal)' : 'var(--bg-tertiary)',
                      color: canAfford ? '#000' : 'var(--text-dim)',
                      border: canAfford ? '1px solid var(--accent-teal)' : '1px solid var(--border-color)',
                      fontWeight: 'bold',
                    }}
                  >
                    Research
                  </Button>
                )}
              </Box>

              <Text
                fontSize="14px"
                style={{
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                  marginBottom: '8px',
                }}
              >
                {tech.description}
              </Text>

              <Box style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <Text fontSize="13px" style={{ color: 'var(--accent-purple)' }}>
                  <strong>Cost:</strong> 📚 {tech.cost} Knowledge
                </Text>

                {tech.requires && tech.requires.length > 0 && (
                  <Text fontSize="13px" style={{ color: 'var(--text-dim)' }}>
                    <strong>Requires:</strong> {tech.requires.map(id => research[id]?.name).join(', ')}
                  </Text>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

