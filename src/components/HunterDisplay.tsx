import { useHunterQuery } from '../queries/gameQueries';
import { allocateStat, getEffectiveHunterStats } from '../store/gameStore';
import { useStore } from '@ts-query/react';
import { useArtifactsStore } from '../store/gameStore';
import { calculateEquippedStatBonuses } from '../lib/calculations/artifactCalculations';
import type { HunterStats } from '../store/types';
import { Box, Heading, Text, Button, Stack } from '@ts-query/ui-react';

export const HunterDisplay = () => {
  const { data: hunter } = useHunterQuery();
  const equipped = useStore(useArtifactsStore, (state) => state.equipped);

  if (!hunter) return null;

  const artifactBonuses = calculateEquippedStatBonuses(equipped);
  const effectiveStats = getEffectiveHunterStats();

  const formatNumber = (num: number) => {
    return Math.floor(num).toLocaleString();
  };

  const xpPercentage = (hunter.xp / hunter.xpToNextLevel) * 100;

  const getRankColor = (rank: string) => {
    switch (rank) {
      case 'E': return '#8B4513';
      case 'D': return '#CD7F32';
      case 'C': return '#C0C0C0';
      case 'B': return '#FFD700';
      case 'A': return '#00CED1';
      case 'S': return '#9370DB';
      case 'National': return '#FF1493';
      default: return '#666';
    }
  };

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
        ⚔️ Hunter: {hunter.name}
      </Heading>

      {/* Level and Rank */}
      <Box mb={4} style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Box>
          <Text fontSize="24px" fontWeight="bold" style={{ color: 'var(--text-primary)' }}>
            Level {hunter.level}
          </Text>
        </Box>
        <Box
          p={2}
          rounded="4px"
          style={{
            background: getRankColor(hunter.rank),
            color: 'white',
            fontWeight: 'bold',
            fontSize: '18px',
            boxShadow: `0 0 15px ${getRankColor(hunter.rank)}80`,
          }}
        >
          {hunter.rank} {hunter.class}
        </Box>
      </Box>

      {/* XP Bar */}
      <Box mb={4}>
        <Box mb={1} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text fontSize="14px" fontWeight="bold" style={{ color: 'var(--text-primary)' }}>
            ✨ Experience
          </Text>
          <Text fontSize="14px" style={{ color: 'var(--text-secondary)' }}>
            {formatNumber(hunter.xp)} / {formatNumber(hunter.xpToNextLevel)}
          </Text>
        </Box>
        <Box
          style={{
            width: '100%',
            height: '24px',
            background: 'var(--bg-tertiary)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
          }}
        >
          <Box
            style={{
              width: `${xpPercentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent-teal) 0%, var(--accent-purple) 100%)',
              transition: 'width 0.3s ease',
              boxShadow: '0 0 10px var(--accent-teal)',
            }}
          />
        </Box>
      </Box>

      {/* HP and Mana */}
      <Box mb={4} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Box
          p={2.5}
          bg="var(--bg-tertiary)"
          rounded="4px"
          style={{ border: '1px solid var(--border-color)' }}
        >
          <Text fontSize="14px" fontWeight="bold" style={{ color: 'var(--danger)' }}>
            ❤️ HP: {formatNumber(hunter.hp)} / {formatNumber(hunter.maxHp)}
          </Text>
        </Box>
        <Box
          p={2.5}
          bg="var(--bg-tertiary)"
          rounded="4px"
          style={{ border: '1px solid var(--border-color)' }}
        >
          <Text fontSize="14px" fontWeight="bold" style={{ color: 'var(--accent-teal)' }}>
            💧 Mana: {formatNumber(hunter.mana)} / {formatNumber(hunter.maxMana)}
          </Text>
        </Box>
      </Box>

      {/* Stats */}
      <Box mb={3}>
        <Text
          fontSize="16px"
          fontWeight="bold"
          style={{
            marginBottom: '10px',
            color: 'var(--text-primary)',
          }}
        >
          📊 Stats {hunter.statPoints > 0 && (
            <span style={{ color: 'var(--accent-teal)' }}>
              ({hunter.statPoints} points available)
            </span>
          )}
        </Text>
        <Stack gap={2}>
          {(Object.keys(hunter.stats) as Array<keyof HunterStats>).map((stat) => {
            const baseStat = hunter.stats[stat];
            const effectiveStat = effectiveStats[stat];
            const bonus = artifactBonuses[stat] || 0;
            const hasBonus = bonus > 0;

            return (
              <Box
                key={stat}
                p={2.5}
                bg="var(--bg-tertiary)"
                rounded="4px"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--border-color)',
                }}
              >
                <Box>
                  <Text
                    fontWeight="bold"
                    style={{
                      textTransform: 'capitalize',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {stat === 'strength' && '💪'}
                    {stat === 'agility' && '⚡'}
                    {stat === 'intelligence' && '🧠'}
                    {stat === 'vitality' && '❤️'}
                    {stat === 'sense' && '👁️'}
                    {stat === 'authority' && '👑'}
                    {' '}{stat}: <span style={{ color: 'var(--accent-teal)' }}>{baseStat}</span>
                    {hasBonus && (
                      <span style={{ color: 'var(--accent-gold)', fontSize: '12px' }}>
                        {' '}→ {effectiveStat} (+{bonus}%)
                      </span>
                    )}
                  </Text>
                </Box>
                <Button
                  onClick={() => allocateStat(stat)}
                  disabled={hunter.statPoints <= 0}
                  style={{
                    background: hunter.statPoints > 0 ? 'var(--accent-teal)' : 'var(--bg-tertiary)',
                    color: hunter.statPoints > 0 ? '#000' : 'var(--text-dim)',
                    border: hunter.statPoints > 0 ? '1px solid var(--accent-teal)' : '1px solid var(--border-color)',
                    fontWeight: 'bold',
                  }}
                  size="sm"
                >
                  +
                </Button>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
};

