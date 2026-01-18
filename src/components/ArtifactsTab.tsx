import { useStore } from '@ts-query/react';
import { Box, Heading, Text, Button, Stack } from '@ts-query/ui-react';
import { useArtifactsStore, useHunterStore, gameStore, craftArtifact, craftArtifactBulk, equipArtifact, unequipArtifact, upgradeArtifact, upgradeArtifactBulk, destroyArtifact, destroyArtifactsUnderRank } from '../store/gameStore';
import type { ArtifactRank, ArtifactSlot, Artifact } from '../store/types';
import { canCraftRank, calculateCraftCost, canBlacksmithCraftRank, getMaxCraftableRank } from '../lib/calculations/artifactCalculations';
import { getTierColor, calculateTierDropRates } from '../lib/lootGenerator';
import { availableUpgrades, calculateUpgradeCost } from '../data/initialArtifacts';
import React, { useState, useEffect } from 'react';

export const ArtifactsTab = () => {
  const equipped = useStore(useArtifactsStore, (state) => state.equipped);
  const inventory = useStore(useArtifactsStore, (state) => state.inventory);
  const blacksmithLevel = useStore(useArtifactsStore, (state) => state.blacksmithLevel);
  const blacksmithXp = useStore(useArtifactsStore, (state) => state.blacksmithXp);
  const blacksmithXpToNextLevel = useStore(useArtifactsStore, (state) => state.blacksmithXpToNextLevel);
  const hunter = useStore(useHunterStore, (state) => state.hunter);
  const resources = useStore(gameStore, (state) => state.resources);

  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [craftBulkAmount, setCraftBulkAmount] = useState<1 | 5 | 10 | 100>(1);
  const [upgradeBulkAmount, setUpgradeBulkAmount] = useState<1 | 5 | 10 | 100>(1);

  // Clear selected artifact if it no longer exists in inventory or equipped
  useEffect(() => {
    if (selectedArtifact) {
      const stillExists =
        inventory.find(a => a.id === selectedArtifact.id) ||
        Object.values(equipped).find(a => a?.id === selectedArtifact.id);

      if (!stillExists) {
        setSelectedArtifact(null);
      }
    }
  }, [selectedArtifact, inventory, equipped]);

  const slots: Array<{ slot: ArtifactSlot; name: string; icon: string }> = [
    { slot: 'weapon', name: 'Weapon', icon: '⚔️' },
    { slot: 'head', name: 'Head', icon: '👑' },
    { slot: 'chest', name: 'Chest', icon: '🛡️' },
    { slot: 'hands', name: 'Hands', icon: '🧤' },
    { slot: 'legs', name: 'Legs', icon: '👖' },
    { slot: 'feet', name: 'Feet', icon: '👟' },
    { slot: 'neck', name: 'Neck', icon: '📿' },
    { slot: 'ears', name: 'Ears', icon: '👂' },
    { slot: 'wrist', name: 'Wrist', icon: '⌚' },
    { slot: 'ring1', name: 'Ring 1', icon: '💍' },
    { slot: 'ring2', name: 'Ring 2', icon: '💍' },
  ];

  const ranks: ArtifactRank[] = ['E', 'D', 'C', 'B', 'A', 'S'];

  const handleCraft = (rank: ArtifactRank, slot: ArtifactSlot) => {
    if (!canCraftRank(hunter.rank, rank)) {
      alert(`You need to be ${rank} hunter to craft this artifact!`);
      return;
    }
    if (!canBlacksmithCraftRank(blacksmithLevel, rank)) {
      alert(`Your blacksmith needs to be higher level to craft ${rank}-rank artifacts!`);
      return;
    }
    if (craftBulkAmount === 1) {
      craftArtifact(rank, slot);
    } else {
      craftArtifactBulk(rank, slot, craftBulkAmount);
    }
  };

  const formatStatBonus = (stats: Record<string, number | undefined>) => {
    return Object.entries(stats)
      .filter(([, value]) => value && value > 0)
      .map(([stat, value]) => `${stat}: +${value}%`)
      .join(', ');
  };

  const calculateTotalStats = (artifact: Artifact) => {
    const total: Record<string, number> = { ...artifact.baseStats };

    artifact.upgrades.forEach((upgrade) => {
      Object.entries(upgrade.statBonus).forEach(([stat, value]) => {
        if (value) {
          total[stat] = (total[stat] || 0) + value;
        }
      });
    });

    return total;
  };

  return (
    <Box>
      {/* Blacksmith Info */}
      <Box
        bg="var(--bg-secondary)"
        p={4}
        rounded="8px"
        mb={4}
        style={{
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          border: '1px solid var(--border-color)',
        }}
      >
        <Heading level={3} style={{ color: 'var(--accent-gold)' }}>
          🔨 Blacksmith
        </Heading>
        <Text style={{ color: 'var(--text-primary)' }}>
          Level {blacksmithLevel} | XP: {Math.floor(blacksmithXp)} / {blacksmithXpToNextLevel}
        </Text>
        <Text style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Max Craftable: {getMaxCraftableRank(blacksmithLevel)}-rank (Hunter: {hunter.rank})
        </Text>
        <Box mt={2} p={2} bg="var(--bg-primary)" rounded="4px">
          <Text style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>
            🎲 Tier Drop Rates:
          </Text>
          {(Object.entries(calculateTierDropRates(blacksmithLevel)) as Array<[string, number]>).map(([tier, rate]) => (
            <Text key={tier} style={{ color: getTierColor(tier as 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary'), fontSize: '11px' }}>
              {tier}: {rate.toFixed(1)}%
            </Text>
          ))}
        </Box>
      </Box>

      {/* Equipped Artifacts */}
      <Box
        bg="var(--bg-secondary)"
        p={4}
        rounded="8px"
        mb={4}
        style={{
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          border: '1px solid var(--border-color)',
        }}
      >
        <Heading level={3} style={{ color: 'var(--accent-teal)', marginBottom: '15px' }}>
          💍 Equipped Artifacts
        </Heading>
        <Stack gap={2}>
          {slots.map(({ slot, name, icon }) => {
            const artifact = equipped[slot];
            return (
              <Box
                key={slot}
                p={3}
                bg="var(--bg-primary)"
                rounded="4px"
                style={{
                  border: artifact ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Text style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
                    {icon} {name}
                  </Text>
                  {artifact ? (
                    <>
                      <Text style={{ color: getTierColor(artifact.tier), fontSize: '14px', fontWeight: 'bold' }}>
                        {artifact.name}
                      </Text>
                      <Text style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {artifact.tier} {artifact.rank}-Rank
                      </Text>
                      <Text style={{ color: 'var(--accent-teal)', fontSize: '12px' }}>
                        {formatStatBonus(calculateTotalStats(artifact))}
                      </Text>
                      {artifact.upgrades.length > 0 && (
                        <Text style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                          Base: {formatStatBonus(artifact.baseStats)} | +{artifact.upgrades.length} upgrades
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Empty</Text>
                  )}
                </Box>
                {artifact && (
                  <Box style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      onClick={() => setSelectedArtifact(artifact)}
                      size="sm"
                      disabled={artifact.upgrades.length >= artifact.maxUpgrades}
                      style={{
                        background: artifact.upgrades.length < artifact.maxUpgrades ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        color: artifact.upgrades.length < artifact.maxUpgrades ? '#000' : 'var(--text-dim)',
                      }}
                    >
                      Upgrade ({artifact.upgrades.length}/{artifact.maxUpgrades})
                    </Button>
                    <Button
                      onClick={() => unequipArtifact(slot)}
                      size="sm"
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      Unequip
                    </Button>
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Inventory */}
      {inventory.length > 0 && (
        <Box
          bg="var(--bg-secondary)"
          p={4}
          rounded="8px"
          mb={4}
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--border-color)',
          }}
        >
          <Heading level={3} style={{ color: 'var(--accent-purple)', marginBottom: '15px' }}>
            🎒 Inventory
          </Heading>
          <Stack gap={2}>
            {inventory.map((artifact) => (
              <Box
                key={artifact.id}
                p={3}
                bg="var(--bg-primary)"
                rounded="4px"
                style={{
                  border: `2px solid ${getTierColor(artifact.tier)}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box style={{ flex: 1 }}>
                  <Text style={{ color: getTierColor(artifact.tier), fontWeight: 'bold', fontSize: '15px' }}>
                    {artifact.name}
                  </Text>
                  <Text style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {artifact.tier} {artifact.rank}-Rank {artifact.slot}
                  </Text>
                  <Text style={{ color: 'var(--accent-teal)', fontSize: '12px' }}>
                    {formatStatBonus(calculateTotalStats(artifact))}
                  </Text>
                  {artifact.upgrades.length > 0 && (
                    <Text style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                      Base: {formatStatBonus(artifact.baseStats)} | Upgrades: {artifact.upgrades.map(u => u.name).join(', ')}
                    </Text>
                  )}
                </Box>
                <Box style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    onClick={() => setSelectedArtifact(artifact)}
                    size="sm"
                    disabled={artifact.upgrades.length >= artifact.maxUpgrades}
                    style={{
                      background: artifact.upgrades.length < artifact.maxUpgrades ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: artifact.upgrades.length < artifact.maxUpgrades ? '#000' : 'var(--text-dim)',
                    }}
                  >
                    Upgrade ({artifact.upgrades.length}/{artifact.maxUpgrades})
                  </Button>
                  <Button
                    onClick={() => equipArtifact(artifact)}
                    size="sm"
                    style={{
                      background: 'var(--accent-teal)',
                      border: '1px solid var(--accent-teal)',
                      color: '#000',
                    }}
                  >
                    Equip
                  </Button>
                  <Button
                    onClick={() => destroyArtifact(artifact.id)}
                    size="sm"
                    style={{
                      background: '#8b0000',
                      border: '1px solid #ff0000',
                      color: '#fff',
                    }}
                  >
                    💥 Destroy
                  </Button>
                </Box>
              </Box>
            ))}
          </Stack>

          {/* Bulk Destroy Options */}
          {inventory.length > 0 && (
            <Box mt={3} p={3} bg="var(--bg-primary)" rounded="4px" style={{ border: '1px solid #8b0000' }}>
              <Text style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '10px' }}>
                💥 Bulk Destroy
              </Text>
              <Box style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(['E', 'D', 'C', 'B', 'A'] as ArtifactRank[]).map((rank) => {
                  const count = inventory.filter((a) => {
                    const rankOrder: ArtifactRank[] = ['E', 'D', 'C', 'B', 'A', 'S'];
                    return rankOrder.indexOf(a.rank) <= rankOrder.indexOf(rank);
                  }).length;

                  return (
                    <Button
                      key={rank}
                      onClick={() => {
                        if (window.confirm(`Destroy all artifacts ≤${rank}-Rank? (${count} items)`)) {
                          destroyArtifactsUnderRank(rank);
                        }
                      }}
                      disabled={count === 0}
                      size="sm"
                      style={{
                        background: count > 0 ? '#8b0000' : 'var(--bg-tertiary)',
                        border: '1px solid #ff0000',
                        color: count > 0 ? '#fff' : 'var(--text-dim)',
                        opacity: count > 0 ? 1 : 0.5,
                      }}
                    >
                      ≤{rank}-Rank ({count})
                    </Button>
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Crafting */}
      <Box
        bg="var(--bg-secondary)"
        p={4}
        rounded="8px"
        style={{
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          border: '1px solid var(--border-color)',
        }}
      >
        <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <Heading level={3} style={{ color: 'var(--accent-gold)' }}>
            ⚒️ Craft Artifacts
          </Heading>
          <Box style={{ display: 'flex', gap: '8px' }}>
            {([1, 5, 10, 100] as const).map((amount) => (
              <Button
                key={amount}
                onClick={() => setCraftBulkAmount(amount)}
                size="sm"
                style={{
                  background: craftBulkAmount === amount ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                  color: craftBulkAmount === amount ? '#000' : 'var(--text-secondary)',
                  border: `1px solid ${craftBulkAmount === amount ? 'var(--accent-gold)' : 'var(--border-color)'}`,
                  fontWeight: 'bold',
                  minWidth: '50px',
                }}
              >
                x{amount}
              </Button>
            ))}
          </Box>
        </Box>
        <Text style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '14px' }}>
          Select a rank and slot to craft an artifact
        </Text>
        {ranks.map((rank) => {
          const canCraftHunter = canCraftRank(hunter.rank, rank);
          const canCraftBlacksmith = canBlacksmithCraftRank(blacksmithLevel, rank);
          const canCraft = canCraftHunter && canCraftBlacksmith;
          const lockReason = !canCraftHunter ? '(Hunter rank too low)' : !canCraftBlacksmith ? '(Blacksmith level too low)' : '';
          return (
            <Box key={rank} mb={3}>
              <Heading level={4} style={{ color: canCraft ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                {rank}-Rank Artifacts {lockReason}
              </Heading>
              <Box style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {slots.map(({ slot, name, icon }) => {
                  const cost = calculateCraftCost(rank, slot);
                  const canAfford = Object.entries(cost).every(
                    ([resource, amount]) => resources[resource as keyof typeof resources] >= amount
                  );
                  return (
                    <Button
                      key={slot}
                      onClick={() => handleCraft(rank, slot)}
                      disabled={!canCraft || !canAfford}
                      size="sm"
                      style={{
                        background: canCraft && canAfford ? 'var(--accent-gold)' : 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        color: canCraft && canAfford ? '#000' : 'var(--text-secondary)',
                        opacity: canCraft && canAfford ? 1 : 0.5,
                      }}
                    >
                      {icon} {name}
                    </Button>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Upgrade Modal */}
      {selectedArtifact && (() => {
        // Get fresh artifact from store (could be in inventory or equipped)
        const freshArtifact =
          inventory.find(a => a.id === selectedArtifact.id) ||
          Object.values(equipped).find(a => a?.id === selectedArtifact.id);

        // If artifact no longer exists, just return null (don't update state during render)
        if (!freshArtifact) {
          return null;
        }

        return (
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
            onClick={() => setSelectedArtifact(null)}
          >
            <Box
              bg="var(--bg-secondary)"
              p={5}
              rounded="8px"
              style={{
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
                border: `2px solid ${getTierColor(freshArtifact.tier)}`,
              }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <Box>
                  <Heading level={3} style={{ color: getTierColor(freshArtifact.tier) }}>
                    ⚒️ Upgrade: {freshArtifact.name}
                  </Heading>
                  <Text style={{ color: 'var(--text-secondary)' }}>
                    {freshArtifact.tier} {freshArtifact.rank}-Rank {freshArtifact.slot} | Upgrades: {freshArtifact.upgrades.length}/{freshArtifact.maxUpgrades}
                  </Text>
                </Box>
                <Box style={{ display: 'flex', gap: '8px' }}>
                  {([1, 5, 10, 100] as const).map((amount) => (
                    <Button
                      key={amount}
                      onClick={() => setUpgradeBulkAmount(amount)}
                      size="sm"
                      style={{
                        background: upgradeBulkAmount === amount ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                        color: upgradeBulkAmount === amount ? '#000' : 'var(--text-secondary)',
                        border: `1px solid ${upgradeBulkAmount === amount ? 'var(--accent-gold)' : 'var(--border-color)'}`,
                        fontWeight: 'bold',
                        minWidth: '50px',
                      }}
                    >
                      x{amount}
                    </Button>
                  ))}
                </Box>
              </Box>

              <Stack gap={2}>
                {Object.values(availableUpgrades).map((upgrade) => {
                  const cost = calculateUpgradeCost(freshArtifact.rank, freshArtifact.upgrades.length);
                  const canAfford = Object.entries(cost).every(
                    ([resource, amount]) => resources[resource as keyof typeof resources] >= amount
                  );
                  const isFull = freshArtifact.upgrades.length >= freshArtifact.maxUpgrades;

                  return (
                    <Box
                      key={upgrade.id}
                      p={3}
                      bg="var(--bg-primary)"
                      rounded="4px"
                      style={{
                        border: '1px solid var(--border-color)',
                        opacity: isFull || !canAfford ? 0.5 : 1,
                      }}
                    >
                      <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Text style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
                            {upgrade.name}
                          </Text>
                          <Text style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {upgrade.description}
                          </Text>
                          <Text style={{ color: 'var(--accent-teal)', fontSize: '12px' }}>
                            {formatStatBonus(upgrade.statBonus)}
                          </Text>
                          <Text style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                            Cost: {Object.entries(cost).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ')}
                          </Text>
                        </Box>
                        <Button
                          onClick={() => {
                            if (upgradeBulkAmount === 1) {
                              upgradeArtifact(freshArtifact.id, upgrade.id);
                            } else {
                              upgradeArtifactBulk(freshArtifact.id, upgrade.id, upgradeBulkAmount);
                            }
                            // Don't close modal - let it refresh with new upgrade count
                          }}
                          disabled={isFull || !canAfford}
                          size="sm"
                          style={{
                            background: canAfford && !isFull ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            color: canAfford && !isFull ? '#000' : 'var(--text-dim)',
                          }}
                        >
                          {upgradeBulkAmount === 1 ? 'Apply' : `Apply x${upgradeBulkAmount}`}
                        </Button>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>

              <Button
                onClick={() => setSelectedArtifact(null)}
                style={{
                  marginTop: '20px',
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                Close
              </Button>
            </Box>
          </Box>
        );
      })()}
    </Box>
  );
};

