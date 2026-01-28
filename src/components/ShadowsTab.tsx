import { useStore } from '@ts-query/react';
import { Box, Heading, Text } from '@ts-query/ui-react';
import { useShadowsStore } from '../store/shadowsStore';
import { useHunterStore } from '../store/hunterStore';
import { useDungeonsStore } from '../store/dungeonsStore';
import { calculateMaxPartySlots } from '../lib/calculations/partyCalculations';

export const ShadowsTab = () => {
  const shadows = useStore(useShadowsStore, (state) => state.shadows);
  const necromancerUnlocked = useStore(useShadowsStore, (state) => state.necromancerUnlocked);
  const authority = useStore(useHunterStore, (state) => state.hunter.stats.authority);
  const maxPartySlots = calculateMaxPartySlots(authority);
  const dungeons = useStore(useDungeonsStore, (state) => state.dungeons);

  // Group shadows by origin dungeon
  const shadowsByDungeon = shadows.reduce(
    (acc, shadow) => {
      if (!acc[shadow.originDungeonId]) {
        acc[shadow.originDungeonId] = [];
      }
      acc[shadow.originDungeonId].push(shadow);
      return acc;
    },
    {} as Record<string, typeof shadows>
  );

  const getDungeonName = (dungeonId: string) => {
    const dungeon = dungeons.find((d) => d.id === dungeonId);
    return dungeon?.name || 'Unknown Dungeon';
  };

  const getXpPercentage = (shadow: (typeof shadows)[0]) => {
    return (shadow.xp / shadow.xpToNextLevel) * 100;
  };

  if (!necromancerUnlocked) {
    return (
      <Box>
        <Heading level={2} style={{ color: 'var(--text-primary)', marginBottom: '20px' }}>
          👻 Shadow Army
        </Heading>
        <Box
          style={{
            padding: '40px',
            background: 'var(--bg-secondary)',
            border: '2px dashed var(--accent-purple)',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <Text style={{ fontSize: '24px', marginBottom: '15px' }}>🔒</Text>
          <Text
            style={{
              fontSize: '18px',
              color: 'var(--accent-purple)',
              marginBottom: '10px',
              fontWeight: 'bold',
            }}
          >
            Necromancer Class Locked
          </Text>
          <Text style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Reach level 40 to unlock the Necromancer class and extract shadows from defeated
            enemies!
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Heading level={2} style={{ color: 'var(--text-primary)', marginBottom: '20px' }}>
        👻 Shadow Army
      </Heading>

      {/* Stats Overview */}
      <Box
        style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '2px solid var(--accent-purple)',
          borderRadius: '8px',
          marginBottom: '30px',
        }}
      >
        <Heading level={3} style={{ color: 'var(--accent-purple)', marginBottom: '15px' }}>
          📊 Overview
        </Heading>
        <Box style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
          <Box>
            <Text style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Shadows</Text>
            <Text style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-purple)' }}>
              {shadows.length}
            </Text>
          </Box>
          <Box>
            <Text style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Max Party Size</Text>
            <Text style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-teal)' }}>
              {maxPartySlots}
            </Text>
            <Text style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              (Authority: {authority})
            </Text>
          </Box>
          <Box>
            <Text style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Average Level</Text>
            <Text style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
              {shadows.length > 0
                ? (shadows.reduce((sum, s) => sum + s.level, 0) / shadows.length).toFixed(1)
                : '0'}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Shadows List */}
      {shadows.length === 0 ? (
        <Box
          style={{
            padding: '40px',
            background: 'var(--bg-secondary)',
            border: '2px dashed var(--border-color)',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <Text style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            No shadows extracted yet
          </Text>
          <Text style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Complete solo dungeons to extract shadows from defeated enemies!
          </Text>
        </Box>
      ) : (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(shadowsByDungeon).map(([dungeonId, dungeonShadows]) => (
            <Box key={dungeonId}>
              <Heading level={4} style={{ color: 'var(--accent-purple)', marginBottom: '10px' }}>
                {getDungeonName(dungeonId)}
              </Heading>
              <Box
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '15px',
                }}
              >
                {dungeonShadows.map((shadow) => (
                  <Box
                    key={shadow.id}
                    style={{
                      padding: '15px',
                      background: 'var(--bg-secondary)',
                      border: '2px solid var(--accent-purple)',
                      borderRadius: '8px',
                    }}
                  >
                    <Box
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '10px',
                      }}
                    >
                      <Box>
                        <Text
                          style={{
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: 'var(--accent-purple)',
                          }}
                        >
                          {shadow.name}
                        </Text>
                        <Text style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                          Level {shadow.level}
                        </Text>
                      </Box>
                      <Text
                        style={{
                          fontSize: '12px',
                          color: 'var(--accent-purple)',
                          fontWeight: 'bold',
                        }}
                      >
                        👻 SHADOW
                      </Text>
                    </Box>

                    {/* XP Progress Bar */}
                    <Box style={{ marginBottom: '10px' }}>
                      <Box
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '5px',
                        }}
                      >
                        <Text style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          XP Progress
                        </Text>
                        <Text style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {shadow.xp.toLocaleString()} / {shadow.xpToNextLevel.toLocaleString()}
                        </Text>
                      </Box>
                      <Box
                        style={{
                          width: '100%',
                          height: '8px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          style={{
                            width: `${getXpPercentage(shadow)}%`,
                            height: '100%',
                            background:
                              'linear-gradient(90deg, var(--accent-purple), var(--accent-blue))',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </Box>
                    </Box>

                    <Text
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                      }}
                    >
                      Levels up from {getDungeonName(dungeonId)} runs
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
