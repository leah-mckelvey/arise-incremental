import { useStore } from '@ts-query/react';
import { Box, Heading, Text, Button } from '@ts-query/ui-react';
import { useAlliesStore } from '../store/alliesStore';
import { useHunterStore } from '../store/hunterStore';
import { useDungeonsStore } from '../store/dungeonsStore';
import { gameStore, recruitGenericAlly } from '../store/gameStore';
import { calculateMaxPartySlots } from '../lib/calculations/partyCalculations';
import { recruitableAllies } from '../data/recruitableAllies';

export const AlliesTab = () => {
  const allies = useStore(useAlliesStore, (state) => state.allies);
  const authority = useStore(useHunterStore, (state) => state.hunter.stats.authority);
  const hunterLevel = useStore(useHunterStore, (state) => state.hunter.level);
  const attraction = useStore(gameStore, (state) => state.resources.attraction);
  const maxPartySlots = calculateMaxPartySlots(authority);
  const dungeons = useStore(useDungeonsStore, (state) => state.dungeons);

  const handleRecruitGeneric = (recruitableAlly: (typeof recruitableAllies)[0]) => {
    const currentAttraction = gameStore.getState().resources.attraction;
    if (currentAttraction < recruitableAlly.attractionCost) {
      console.warn(`Not enough attraction to recruit ${recruitableAlly.name}`);
      return;
    }

    // Call coordinated function with optimistic update
    recruitGenericAlly(recruitableAlly.name, recruitableAlly.rank, recruitableAlly.attractionCost);
  };

  // Group allies by origin dungeon
  const alliesByDungeon = allies.reduce(
    (acc, ally) => {
      if (!acc[ally.originDungeonId]) {
        acc[ally.originDungeonId] = [];
      }
      acc[ally.originDungeonId].push(ally);
      return acc;
    },
    {} as Record<string, typeof allies>
  );

  const getDungeonName = (dungeonId: string) => {
    if (dungeonId === 'recruited') {
      return '🎯 Recruited with Attraction';
    }
    const dungeon = dungeons.find((d) => d.id === dungeonId);
    return dungeon?.name || 'Unknown Dungeon';
  };

  const getXpPercentage = (ally: (typeof allies)[0]) => {
    return (ally.xp / ally.xpToNextLevel) * 100;
  };

  return (
    <Box>
      <Heading level={2} style={{ color: 'var(--text-primary)', marginBottom: '20px' }}>
        👥 Allies
      </Heading>

      {/* Stats Overview */}
      <Box
        style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '2px solid var(--accent-pink)',
          borderRadius: '8px',
          marginBottom: '30px',
        }}
      >
        <Heading level={3} style={{ color: 'var(--accent-pink)', marginBottom: '15px' }}>
          📊 Overview
        </Heading>
        <Box style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
          <Box>
            <Text style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Allies</Text>
            <Text style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-pink)' }}>
              {allies.length}
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
              {allies.length > 0
                ? (allies.reduce((sum, a) => sum + a.level, 0) / allies.length).toFixed(1)
                : '0'}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Recruitment Section */}
      <Box
        style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '2px solid var(--accent-teal)',
          borderRadius: '8px',
          marginBottom: '30px',
        }}
      >
        <Heading level={3} style={{ color: 'var(--accent-teal)', marginBottom: '15px' }}>
          🎯 Recruit Allies
        </Heading>
        <Text style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
          Spend attraction to recruit generic hunters. You can recruit multiple of each rank.
        </Text>
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '10px',
          }}
        >
          {recruitableAllies.map((recruitableAlly) => {
            const canAfford = attraction >= recruitableAlly.attractionCost;
            const meetsLevel =
              !recruitableAlly.requiredLevel || hunterLevel >= recruitableAlly.requiredLevel;
            const canRecruit = canAfford && meetsLevel;

            return (
              <Box
                key={recruitableAlly.id}
                style={{
                  padding: '12px',
                  background: 'var(--bg-tertiary)',
                  border: `2px solid ${canRecruit ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                  borderRadius: '6px',
                  opacity: canRecruit ? 1 : 0.6,
                }}
              >
                <Text
                  style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: 'var(--accent-teal)',
                    marginBottom: '5px',
                  }}
                >
                  {recruitableAlly.name}
                </Text>
                <Text
                  style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}
                >
                  {recruitableAlly.description}
                </Text>
                <Text
                  style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}
                >
                  Cost: {recruitableAlly.attractionCost} 💫
                </Text>
                {recruitableAlly.requiredLevel && (
                  <Text
                    style={{
                      fontSize: '11px',
                      color: meetsLevel ? 'var(--accent-green)' : 'var(--accent-red)',
                      marginBottom: '8px',
                    }}
                  >
                    Requires Level {recruitableAlly.requiredLevel}
                  </Text>
                )}
                <Button
                  onClick={() => handleRecruitGeneric(recruitableAlly)}
                  disabled={!canRecruit}
                  style={{
                    width: '100%',
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: canRecruit ? 'var(--accent-teal)' : 'var(--bg-tertiary)',
                    color: canRecruit ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: canRecruit ? 'pointer' : 'not-allowed',
                  }}
                >
                  Recruit
                </Button>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Allies List */}
      {allies.length === 0 ? (
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
            No allies recruited yet
          </Text>
          <Text style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Recruit generic allies above or complete alliance dungeons for named hunters!
          </Text>
        </Box>
      ) : (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(alliesByDungeon).map(([dungeonId, dungeonAllies]) => (
            <Box key={dungeonId}>
              <Heading level={4} style={{ color: 'var(--accent-pink)', marginBottom: '10px' }}>
                {getDungeonName(dungeonId)}
              </Heading>
              <Box
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '15px',
                }}
              >
                {dungeonAllies.map((ally) => (
                  <Box
                    key={ally.id}
                    style={{
                      padding: '15px',
                      background: 'var(--bg-secondary)',
                      border: '2px solid var(--accent-pink)',
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
                            color: 'var(--accent-pink)',
                          }}
                        >
                          {ally.name}
                        </Text>
                        <Text style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                          Level {ally.level}
                        </Text>
                      </Box>
                      <Text
                        style={{
                          fontSize: '12px',
                          color: 'var(--accent-teal)',
                          fontWeight: 'bold',
                        }}
                      >
                        👥 ALLY
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
                          {ally.xp.toLocaleString()} / {ally.xpToNextLevel.toLocaleString()}
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
                            width: `${getXpPercentage(ally)}%`,
                            height: '100%',
                            background:
                              'linear-gradient(90deg, var(--accent-pink), var(--accent-purple))',
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
