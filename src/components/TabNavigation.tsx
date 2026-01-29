import { Box, Button } from '@ts-query/ui-react';

export type TabId =
  | 'hunter'
  | 'buildings'
  | 'research'
  | 'artifacts'
  | 'dungeons'
  | 'allies'
  | 'shadows';

export interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
}

const tabs: Tab[] = [
  { id: 'hunter', label: 'Hunter', icon: '⚔️' },
  { id: 'buildings', label: 'Buildings', icon: '🏗️' },
  { id: 'research', label: 'Research', icon: '🔬' },
  { id: 'artifacts', label: 'Artifacts', icon: '💍' },
  { id: 'dungeons', label: 'Dungeons', icon: '🏰' },
  { id: 'allies', label: 'Allies', icon: '👥' },
  { id: 'shadows', label: 'Shadows', icon: '👻' },
];

export const TabNavigation = ({ activeTab, onTabChange }: TabNavigationProps) => {
  return (
    <Box
      mb={5}
      style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        background: 'var(--bg-secondary)',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            size="md"
            style={{
              background: isActive ? 'var(--accent-teal)' : 'var(--bg-tertiary)',
              color: isActive ? '#000' : 'var(--text-primary)',
              border: isActive ? '2px solid var(--accent-teal)' : '2px solid var(--border-color)',
              fontWeight: 'bold',
              fontSize: '16px',
              padding: '12px 20px',
              boxShadow: isActive ? '0 0 15px var(--border-glow)' : 'none',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
            }}
          >
            {tab.icon} {tab.label}
          </Button>
        );
      })}
    </Box>
  );
};
