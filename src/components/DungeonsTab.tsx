import { useState, useEffect } from 'react';
import { useStore } from '@ts-query/react';
import { Box, Heading, Text, Button } from '@ts-query/ui-react';
import { useDungeonsStore } from '../store/dungeonsStore';
import { useHunterStore } from '../store/hunterStore';
import { startDungeon, cancelDungeon } from '../store/gameStore';
import type { Dungeon } from '../store/types';

export function DungeonsTab() {
  const dungeons = useStore(useDungeonsStore, (state) => state.dungeons);
  const activeDungeon = useStore(useDungeonsStore, (state) => state.activeDungeon);
  const hunterLevel = useStore(useHunterStore, (state) => state.hunter.level);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Update current time every 100ms for progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const activeDungeonData = activeDungeon
    ? dungeons.find((d) => d.id === activeDungeon.dungeonId)
    : null;

  const getProgress = () => {
    if (!activeDungeon) return 0;
    const elapsed = currentTime - activeDungeon.startTime;
    const total = activeDungeon.endTime - activeDungeon.startTime;
    return Math.min(100, (elapsed / total) * 100);
  };

  const getTimeRemaining = () => {
    if (!activeDungeon) return 0;
    const remaining = Math.max(0, activeDungeon.endTime - currentTime);
    return Math.ceil(remaining / 1000);
  };

  const canEnterDungeon = (dungeon: Dungeon) => {
    return dungeon.unlocked && hunterLevel >= dungeon.requiredLevel && !activeDungeon;
  };

  const getRankColor = (rank: string) => {
    const colors: Record<string, string> = {
      E: '#9d9d9d',
      D: '#1eff00',
      C: '#0070dd',
      B: '#a335ee',
      A: '#ff8000',
      S: '#e6cc80',
    };
    return colors[rank] || '#fff';
  };

  const soloDungeons = dungeons.filter((d) => d.type === 'solo');
  const allianceDungeons = dungeons.filter((d) => d.type === 'alliance');

  const renderDungeon = (dungeon: Dungeon) => {
    const isLocked = !dungeon.unlocked;
    const levelTooLow = hunterLevel < dungeon.requiredLevel;
    const canEnter = canEnterDungeon(dungeon);

    return (
      <Box
        key={dungeon.id}
        style={{
          padding: '15px',
          background: 'var(--bg-secondary)',
          border: `2px solid ${getRankColor(dungeon.rank)}`,
          borderRadius: '8px',
          opacity: isLocked ? 0.5 : 1,
        }}
      >
        <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Text style={{ fontSize: '18px', fontWeight: 'bold', color: getRankColor(dungeon.rank) }}>
              {dungeon.name}
            </Text>
            <Text style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '5px' }}>
              {dungeon.description}
            </Text>
            <Text style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px' }}>
              {dungeon.rank}-Rank • {dungeon.duration}s • Level {dungeon.requiredLevel}+
            </Text>
          </Box>
          <Button
            onClick={() => startDungeon(dungeon.id)}
            disabled={!canEnter}
            style={{
              background: canEnter ? 'var(--accent-teal)' : 'var(--bg-tertiary)',
              color: canEnter ? '#000' : 'var(--text-secondary)',
              border: `1px solid ${canEnter ? 'var(--accent-teal)' : 'var(--border-color)'}`,
              fontWeight: 'bold',
              minWidth: '100px',
            }}
          >
            {isLocked ? '🔒 Locked' : levelTooLow ? `Lv ${dungeon.requiredLevel}` : 'Enter'}
          </Button>
        </Box>

        {/* Rewards */}
        <Box style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {dungeon.rewards.essence > 0 && (
            <Text style={{ fontSize: '12px', color: 'var(--accent-purple)' }}>
              ✨ {dungeon.rewards.essence.toLocaleString()}
            </Text>
          )}
          {dungeon.rewards.crystals > 0 && (
            <Text style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>
              💎 {dungeon.rewards.crystals.toLocaleString()}
            </Text>
          )}
          {dungeon.rewards.gold > 0 && (
            <Text style={{ fontSize: '12px', color: 'var(--accent-gold)' }}>
              💰 {dungeon.rewards.gold.toLocaleString()}
            </Text>
          )}
          {dungeon.rewards.souls > 0 && (
            <Text style={{ fontSize: '12px', color: 'var(--accent-red)' }}>
              👻 {dungeon.rewards.souls.toLocaleString()}
            </Text>
          )}
          {dungeon.rewards.attraction > 0 && (
            <Text style={{ fontSize: '12px', color: 'var(--accent-pink)' }}>
              ❤️ {dungeon.rewards.attraction.toLocaleString()}
            </Text>
          )}
          {dungeon.rewards.gems > 0 && (
            <Text style={{ fontSize: '12px', color: 'var(--accent-green)' }}>
              💚 {dungeon.rewards.gems.toLocaleString()}
            </Text>
          )}
          {dungeon.rewards.knowledge > 0 && (
            <Text style={{ fontSize: '12px', color: 'var(--accent-teal)' }}>
              📚 {dungeon.rewards.knowledge.toLocaleString()}
            </Text>
          )}
          {dungeon.rewards.experience > 0 && (
            <Text style={{ fontSize: '12px', color: 'var(--accent-gold)' }}>
              ⭐ {dungeon.rewards.experience.toLocaleString()} XP
            </Text>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box>
      <Heading level={2} style={{ color: 'var(--text-primary)', marginBottom: '20px' }}>
        🏰 Dungeons
      </Heading>

      {/* Active Dungeon Progress */}
      {activeDungeon && activeDungeonData && (
        <Box
          style={{
            padding: '20px',
            background: 'var(--bg-secondary)',
            border: '2px solid var(--accent-teal)',
            borderRadius: '8px',
            marginBottom: '30px',
          }}
        >
          <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <Box>
              <Text style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent-teal)' }}>
                ⚔️ {activeDungeonData.name}
              </Text>
              <Text style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                Time Remaining: {getTimeRemaining()}s
              </Text>
            </Box>
            <Button
              onClick={cancelDungeon}
              style={{
                background: 'var(--danger)',
                color: '#fff',
                border: '1px solid var(--danger)',
                fontWeight: 'bold',
              }}
            >
              ❌ Cancel
            </Button>
          </Box>

          {/* Progress Bar */}
          <Box
            style={{
              width: '100%',
              height: '30px',
              background: 'var(--bg-tertiary)',
              borderRadius: '15px',
              overflow: 'hidden',
              border: '2px solid var(--border-color)',
            }}
          >
            <Box
              style={{
                width: `${getProgress()}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent-teal), var(--accent-blue))',
                transition: 'width 0.1s linear',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: '14px', fontWeight: 'bold', color: '#000' }}>
                {getProgress().toFixed(1)}%
              </Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Solo Dungeons */}
      <Box style={{ marginBottom: '30px' }}>
        <Heading level={3} style={{ color: 'var(--accent-purple)', marginBottom: '15px' }}>
          🏛️ Solo Leveling Dungeons
        </Heading>
        <Text style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
          Train alone and grow stronger. Grants massive XP and resources.
        </Text>
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {soloDungeons.map(renderDungeon)}
        </Box>
      </Box>

      {/* Alliance Dungeons */}
      <Box>
        <Heading level={3} style={{ color: 'var(--accent-pink)', marginBottom: '15px' }}>
          ⚔️ Alliance Dungeons
        </Heading>
        <Text style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
          Help other hunters and build your reputation. Unlocks shadow extraction.
        </Text>
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {allianceDungeons.map(renderDungeon)}
        </Box>
      </Box>
    </Box>
  );
}

