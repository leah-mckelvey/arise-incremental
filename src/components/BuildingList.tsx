import { useBuildingsQuery, useResourcesQuery } from '../queries/gameQueries';
import { useGameStore, getBuildingCost, canAffordBuilding } from '../store/gameStore';
import type { Resources, Building } from '../store/gameStore';

export const BuildingList = () => {
  const { data: buildings } = useBuildingsQuery();
  const { data: resources } = useResourcesQuery();
  const purchaseBuilding = useGameStore((state) => state.purchaseBuilding);

  if (!buildings || !resources) return null;

  const formatNumber = (num: number) => {
    return Math.floor(num).toLocaleString();
  };

  const renderCost = (cost: Resources) => {
    const parts = [];
    if (cost.catnip > 0) parts.push(`🌾 ${formatNumber(cost.catnip)}`);
    if (cost.wood > 0) parts.push(`🪵 ${formatNumber(cost.wood)}`);
    if (cost.minerals > 0) parts.push(`⛰️ ${formatNumber(cost.minerals)}`);
    if (cost.science > 0) parts.push(`🔬 ${formatNumber(cost.science)}`);
    return parts.join(' ');
  };

  const renderProduction = (building: Building) => {
    if (!building.produces || !building.perSecond) return null;
    const parts = [];
    if (building.produces.catnip) parts.push(`🌾 +${building.produces.catnip * building.perSecond}/s`);
    if (building.produces.wood) parts.push(`🪵 +${building.produces.wood * building.perSecond}/s`);
    if (building.produces.minerals) parts.push(`⛰️ +${building.produces.minerals * building.perSecond}/s`);
    if (building.produces.science) parts.push(`🔬 +${building.produces.science * building.perSecond}/s`);
    return parts.length > 0 ? `Produces: ${parts.join(', ')}` : null;
  };

  return (
    <div style={{ 
      background: '#f0e8d8', 
      padding: '20px', 
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ margin: '0 0 15px 0', color: '#5a4a3a' }}>Buildings</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {Object.values(buildings).map((building) => {
          const cost = getBuildingCost(building);
          const canAfford = canAffordBuilding(resources, building);
          
          return (
            <div
              key={building.id}
              style={{
                background: '#fff',
                padding: '15px',
                borderRadius: '4px',
                border: canAfford ? '2px solid #4a9d5f' : '2px solid #ccc',
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <div>
                  <strong style={{ fontSize: '18px' }}>{building.name}</strong>
                  <span style={{ marginLeft: '10px', color: '#666' }}>
                    (Owned: {building.count})
                  </span>
                </div>
                <button
                  onClick={() => purchaseBuilding(building.id)}
                  disabled={!canAfford}
                  style={{
                    padding: '8px 16px',
                    background: canAfford ? '#4a9d5f' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  Build
                </button>
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                <div>Cost: {renderCost(cost)}</div>
                {renderProduction(building) && (
                  <div style={{ color: '#4a9d5f', marginTop: '4px' }}>
                    {renderProduction(building)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
