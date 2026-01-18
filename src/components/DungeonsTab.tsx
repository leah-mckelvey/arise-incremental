import { useState, useEffect } from 'react';
import { useStore } from '@ts-query/react';
import { Box, Heading, Text, Button } from '@ts-query/ui-react';
import { useDungeonsStore } from '../store/dungeonsStore';
import { useHunterStore } from '../store/hunterStore';
import { useAlliesStore } from '../store/alliesStore';
import { useShadowsStore } from '../store/shadowsStore';
import { startDungeon, cancelDungeon } from '../store/gameStore';
import type { Dungeon } from '../store/types';
import { calculateMaxPartySlots } from '../lib/calculations/partyCalculations';

export function DungeonsTab() {
  const dungeons = useStore(useDungeonsStore, (state) => state.dungeons);
  const activeDungeons = useStore(useDungeonsStore, (state) => state.activeDungeons);
  const hunterLevel = useStore(useHunterStore, (state) => state.hunter.level);
  const authority = useStore(useHunterStore, (state) => state.hunter.stats.authority);
  const maxPartySlots = calculateMaxPartySlots(authority);
  const allies = useStore(useAlliesStore, (state) => state.allies);
  const shadows = useStore(useShadowsStore, (state) => state.shadows);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null);
  const [selectedParty, setSelectedParty] = useState<string[]>([]);

  // Update current time every 100ms for progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const getProgress = (activeDungeon: { startTime: number; endTime: number }) => {
    const elapsed = currentTime - activeDungeon.startTime;
    const total = activeDungeon.endTime - activeDungeon.startTime;
    return Math.min(100, (elapsed / total) * 100);
  };

  const getTimeRemaining = (activeDungeon: { endTime: number }) => {
    const remaining = Math.max(0, activeDungeon.endTime - currentTime);
    return Math.ceil(remaining / 1000);
  };

  // Get list of companion IDs that are currently busy in other dungeons
  const getBusyCompanionIds = () => {
    const busyIds: string[] = [];
    activeDungeons.forEach((ad) => {
      if (ad.partyIds) {
        busyIds.push(...ad.partyIds);
      }
    });
    return busyIds;
  };

  // Check if Sung Jinwoo is currently allocated to a dungeon
  const isSungJinwooBusy = () => {
    return getBusyCompanionIds().includes('sung-jinwoo');
  };

  // Check if there are any available NAMED companions for this dungeon type
  // Named companions are those from dungeon drops (have originDungeonId that's not 'recruited')
  const hasAvailableNamedCompanions = (dungeon: Dungeon) => {
    const busyIds = getBusyCompanionIds();

    if (dungeon.type === 'alliance') {
      // Check for named allies (not generic recruited ones)
      return allies.some((a) => a.originDungeonId !== 'recruited' && !busyIds.includes(a.id));
    } else {
      // Check for named shadows (not generic recruited ones)
      return shadows.some((s) => s.originDungeonId !== 'recruited' && !busyIds.includes(s.id));
    }
  };

  const canEnterDungeon = (dungeon: Dungeon) => {
    if (!dungeon.unlocked || hunterLevel < dungeon.requiredLevel) {
      return false;
    }

    // Can enter if Sung Jinwoo is free OR there's at least one available NAMED companion
    return !isSungJinwooBusy() || hasAvailableNamedCompanions(dungeon);
  };

  const getEnterButtonText = (dungeon: Dungeon) => {
    if (!dungeon.unlocked) return '🔒 Locked';
    if (hunterLevel < dungeon.requiredLevel) return `Lv ${dungeon.requiredLevel}`;
    if (!canEnterDungeon(dungeon)) return '👥 No one available';
    return 'Enter';
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

  const getAvailableCompanions = (dungeon: Dungeon) => {
    // Any ally can go to alliance dungeons, any shadow can go to solo dungeons
    // But filter out companions that are currently busy in other dungeons
    const busyIds = getBusyCompanionIds();

    if (dungeon.type === 'alliance') {
      return allies.filter((a) => !busyIds.includes(a.id));
    } else {
      return shadows.filter((s) => !busyIds.includes(s.id));
    }
  };

  const handleOpenPartySelection = (dungeon: Dungeon) => {
    setSelectedDungeon(dungeon);
    setSelectedParty([]);
  };

  const handleToggleCompanion = (companionId: string) => {
    if (selectedParty.includes(companionId)) {
      setSelectedParty(selectedParty.filter((id) => id !== companionId));
    } else if (selectedParty.length < maxPartySlots) {
      setSelectedParty([...selectedParty, companionId]);
    }
  };

  const handleStartDungeon = () => {
    if (selectedDungeon) {
      // Check if there's at least one named character in the party
      const namedCompanionsInParty = selectedParty.filter(id => {
        if (selectedDungeon.type === 'alliance') {
          const ally = allies.find(a => a.id === id);
          return ally && ally.originDungeonId !== 'recruited';
        } else {
          const shadow = shadows.find(s => s.id === id);
          return shadow && shadow.originDungeonId !== 'recruited';
        }
      });

      // If no named companions selected and Sung Jinwoo is available, he goes
      // Otherwise, the selected named companions lead the party
      const isSungJinwooAvailable = !isSungJinwooBusy();
      const finalParty = namedCompanionsInParty.length > 0
        ? selectedParty
        : (isSungJinwooAvailable ? ['sung-jinwoo', ...selectedParty] : selectedParty);

      // Validate that we have a valid leader (Sung Jinwoo or at least one named companion)
      const hasValidLeader = finalParty.includes('sung-jinwoo') || namedCompanionsInParty.length > 0;
      if (!hasValidLeader) {
        console.warn('Cannot start dungeon without a valid leader');
        return;
      }

      startDungeon(selectedDungeon.id, finalParty);
      setSelectedDungeon(null);
      setSelectedParty([]);
    }
  };

  const handleCancelPartySelection = () => {
    setSelectedDungeon(null);
    setSelectedParty([]);
  };

  const renderDungeon = (dungeon: Dungeon) => {
    const isLocked = !dungeon.unlocked;
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
            onClick={() => handleOpenPartySelection(dungeon)}
            disabled={!canEnter}
            style={{
              background: canEnter ? 'var(--accent-teal)' : 'var(--bg-tertiary)',
              color: canEnter ? '#000' : 'var(--text-secondary)',
              border: `1px solid ${canEnter ? 'var(--accent-teal)' : 'var(--border-color)'}`,
              fontWeight: 'bold',
              minWidth: '140px',
            }}
          >
            {getEnterButtonText(dungeon)}
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

      {/* Active Dungeons Progress */}
      {activeDungeons.length > 0 && (
        <Box style={{ marginBottom: '30px' }}>
          <Heading level={3} style={{ color: 'var(--accent-teal)', marginBottom: '15px' }}>
            ⚔️ Active Dungeons ({activeDungeons.length})
          </Heading>
          {activeDungeons.map((activeDungeon) => {
            const dungeonData = dungeons.find((d) => d.id === activeDungeon.dungeonId);
            if (!dungeonData) return null;

            return (
              <Box
                key={activeDungeon.id}
                style={{
                  padding: '15px',
                  background: 'var(--bg-secondary)',
                  border: '2px solid var(--accent-teal)',
                  borderRadius: '8px',
                  marginBottom: '10px',
                }}
              >
                <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <Box>
                    <Text style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-teal)' }}>
                      {dungeonData.name}
                    </Text>
                    <Text style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      Time Remaining: {getTimeRemaining(activeDungeon)}s
                      {activeDungeon.partyIds && activeDungeon.partyIds.length > 0 && (
                        <span>
                          {' • '}
                          {activeDungeon.partyIds.includes('sung-jinwoo')
                            ? activeDungeon.partyIds.length === 1
                              ? '⚔️ Sung Jinwoo (Solo)'
                              : `⚔️ Sung Jinwoo + ${activeDungeon.partyIds.length - 1} companion${activeDungeon.partyIds.length > 2 ? 's' : ''}`
                            : `👥 ${activeDungeon.partyIds.length} companion${activeDungeon.partyIds.length > 1 ? 's' : ''}`
                          }
                        </span>
                      )}
                    </Text>
                  </Box>
                  <Button
                    onClick={() => cancelDungeon(activeDungeon.id)}
                    style={{
                      background: 'var(--danger)',
                      color: '#fff',
                      border: '1px solid var(--danger)',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      padding: '5px 10px',
                    }}
                  >
                    ❌ Cancel
                  </Button>
                </Box>

                {/* Progress Bar */}
                <Box
                  style={{
                    width: '100%',
                    height: '20px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <Box
                    style={{
                      width: `${getProgress(activeDungeon)}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--accent-teal), var(--accent-blue))',
                      transition: 'width 0.1s linear',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>
                      {getProgress(activeDungeon).toFixed(1)}%
                    </Text>
                  </Box>
                </Box>
              </Box>
            );
          })}
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

      {/* Party Selection Modal */}
      {selectedDungeon && (
        <Box
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleCancelPartySelection}
        >
          <Box
            style={{
              background: 'var(--bg-primary)',
              border: '2px solid var(--accent-teal)',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <Heading level={3} style={{ color: 'var(--accent-teal)', marginBottom: '15px' }}>
              Select Party for {selectedDungeon.name}
            </Heading>

            {/* Sung Jinwoo Status */}
            <Box
              style={{
                padding: '15px',
                background: isSungJinwooBusy() ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                border: `2px solid ${isSungJinwooBusy() ? 'var(--border-color)' : 'var(--accent-gold)'}`,
                borderRadius: '8px',
                marginBottom: '20px',
              }}
            >
              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Text style={{ fontSize: '16px', fontWeight: 'bold', color: isSungJinwooBusy() ? 'var(--text-secondary)' : 'var(--accent-gold)' }}>
                    ⚔️ Sung Jinwoo (Main Character)
                  </Text>
                  <Text style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {isSungJinwooBusy() ? '🏰 Currently in a dungeon' : '✅ Available to lead'}
                  </Text>
                </Box>
                <Text style={{ fontSize: '12px', color: isSungJinwooBusy() ? 'var(--text-secondary)' : 'var(--accent-gold)', fontWeight: 'bold' }}>
                  {isSungJinwooBusy() ? 'BUSY' : 'READY'}
                </Text>
              </Box>
            </Box>

            <Text style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '15px', fontStyle: 'italic' }}>
              {isSungJinwooBusy()
                ? '⚠️ Sung Jinwoo is busy. Select a named companion to lead this party.'
                : 'Sung Jinwoo will lead if no named companions are selected.'
              }
            </Text>

            <Text style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Party Size: {selectedParty.length} / {maxPartySlots} companions
            </Text>
            <Text style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Authority: {authority} (Max Companion Slots: {maxPartySlots})
            </Text>

            {/* Available Companions */}
            {(() => {
              const availableCompanions = getAvailableCompanions(selectedDungeon);
              const namedCompanions = availableCompanions.filter(c => c.originDungeonId !== 'recruited');
              const genericCompanions = availableCompanions.filter(c => c.originDungeonId === 'recruited');

              return (
                <>
                  {/* Named Companions (Can Lead) */}
                  {namedCompanions.length > 0 && (
                    <>
                      <Text style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: '10px' }}>
                        ⭐ Named {selectedDungeon.type === 'alliance' ? 'Allies' : 'Shadows'} (Can Lead)
                      </Text>
                      <Box style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                        {namedCompanions.map((companion) => {
                          const isSelected = selectedParty.includes(companion.id);
                          const canSelect = isSelected || selectedParty.length < maxPartySlots;

                          return (
                            <Box
                              key={companion.id}
                              onClick={() => canSelect && handleToggleCompanion(companion.id)}
                              style={{
                                padding: '15px',
                                background: isSelected ? 'var(--accent-gold)' : 'var(--bg-secondary)',
                                border: `2px solid ${isSelected ? 'var(--accent-gold)' : 'var(--border-color)'}`,
                                borderRadius: '8px',
                                cursor: canSelect ? 'pointer' : 'not-allowed',
                                opacity: canSelect ? 1 : 0.5,
                                transition: 'all 0.2s',
                              }}
                            >
                              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                  <Text style={{ fontSize: '16px', fontWeight: 'bold', color: isSelected ? '#000' : 'var(--text-primary)' }}>
                                    {isSelected ? '✓ ' : ''}⭐ {companion.name}
                                  </Text>
                                  <Text style={{ fontSize: '14px', color: isSelected ? '#000' : 'var(--text-secondary)' }}>
                                    Level {companion.level}
                                  </Text>
                                </Box>
                                <Text style={{ fontSize: '12px', color: isSelected ? '#000' : 'var(--accent-gold)', fontWeight: 'bold' }}>
                                  LEADER
                                </Text>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </>
                  )}

                  {/* Generic Companions (Support Only) */}
                  {genericCompanions.length > 0 && (
                    <>
                      <Text style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-teal)', marginBottom: '10px' }}>
                        🎯 Generic {selectedDungeon.type === 'alliance' ? 'Allies' : 'Shadows'} (Support)
                      </Text>
                      <Box style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                        {genericCompanions.map((companion) => {
                          const isSelected = selectedParty.includes(companion.id);
                          const canSelect = isSelected || selectedParty.length < maxPartySlots;

                          return (
                            <Box
                              key={companion.id}
                              onClick={() => canSelect && handleToggleCompanion(companion.id)}
                              style={{
                                padding: '15px',
                                background: isSelected ? 'var(--accent-teal)' : 'var(--bg-secondary)',
                                border: `2px solid ${isSelected ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                                borderRadius: '8px',
                                cursor: canSelect ? 'pointer' : 'not-allowed',
                                opacity: canSelect ? 1 : 0.5,
                                transition: 'all 0.2s',
                              }}
                            >
                              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                  <Text style={{ fontSize: '16px', fontWeight: 'bold', color: isSelected ? '#000' : 'var(--text-primary)' }}>
                                    {isSelected ? '✓ ' : ''}{companion.name}
                                  </Text>
                                  <Text style={{ fontSize: '14px', color: isSelected ? '#000' : 'var(--text-secondary)' }}>
                                    Level {companion.level}
                                  </Text>
                                </Box>
                                <Text style={{ fontSize: '12px', color: isSelected ? '#000' : 'var(--accent-teal)', fontWeight: 'bold' }}>
                                  SUPPORT
                                </Text>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </>
                  )}

                  {/* No companions message */}
                  {availableCompanions.length === 0 && (
                    <Box
                      style={{
                        padding: '30px',
                        background: 'var(--bg-secondary)',
                        border: '2px dashed var(--border-color)',
                        borderRadius: '8px',
                        textAlign: 'center',
                        marginBottom: '20px',
                      }}
                    >
                      <Text style={{ color: 'var(--text-secondary)' }}>
                        No {selectedDungeon.type === 'alliance' ? 'allies' : 'shadows'} available for this dungeon yet.
                      </Text>
                      <Text style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px' }}>
                        Complete this dungeon to recruit {selectedDungeon.type === 'alliance' ? 'allies' : 'shadows'}!
                      </Text>
                    </Box>
                  )}
                </>
              );
            })()}

            {/* Action Buttons */}
            <Box style={{ display: 'flex', gap: '10px' }}>
              {(() => {
                const namedInParty = selectedParty.filter(id => {
                  if (selectedDungeon.type === 'alliance') {
                    const ally = allies.find(a => a.id === id);
                    return ally && ally.originDungeonId !== 'recruited';
                  } else {
                    const shadow = shadows.find(s => s.id === id);
                    return shadow && shadow.originDungeonId !== 'recruited';
                  }
                });

                const isSungJinwooAvailable = !isSungJinwooBusy();
                const hasValidLeader = isSungJinwooAvailable || namedInParty.length > 0;

                let buttonText = '';
                if (namedInParty.length === 0) {
                  // Sung Jinwoo would lead
                  if (!isSungJinwooAvailable) {
                    buttonText = '⚔️ Sung Jinwoo is Busy';
                  } else {
                    buttonText = selectedParty.length === 0
                      ? '⚔️ Start Solo (Sung Jinwoo)'
                      : `⚔️ Sung Jinwoo + ${selectedParty.length} support`;
                  }
                } else {
                  // Named companions lead
                  const supportCount = selectedParty.length - namedInParty.length;
                  if (supportCount === 0) {
                    buttonText = `⚔️ Start with ${namedInParty.length} leader${namedInParty.length > 1 ? 's' : ''}`;
                  } else {
                    buttonText = `⚔️ ${namedInParty.length} leader${namedInParty.length > 1 ? 's' : ''} + ${supportCount} support`;
                  }
                }

                return (
                  <Button
                    onClick={handleStartDungeon}
                    disabled={!hasValidLeader}
                    style={{
                      flex: 1,
                      background: hasValidLeader ? 'var(--accent-teal)' : 'var(--bg-tertiary)',
                      color: hasValidLeader ? '#000' : 'var(--text-dim)',
                      border: hasValidLeader ? '1px solid var(--accent-teal)' : '1px solid var(--border-color)',
                      fontWeight: 'bold',
                      padding: '12px',
                    }}
                  >
                    {buttonText}
                  </Button>
                );
              })()}

              <Button
                onClick={handleCancelPartySelection}
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  fontWeight: 'bold',
                  padding: '12px',
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

