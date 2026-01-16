import { useResourcesQuery, useAllResourceRatesQuery } from '../queries/gameQueries';

export const ResourceDisplay = () => {
  const { data: resources } = useResourcesQuery();
  const { data: rates } = useAllResourceRatesQuery();

  if (!resources || !rates) return null;

  const formatNumber = (num: number) => {
    return Math.floor(num).toLocaleString();
  };

  const formatRate = (rate: number) => {
    return rate > 0 ? `(+${rate.toFixed(2)}/s)` : '';
  };

  return (
    <div style={{ 
      background: '#f0e8d8', 
      padding: '20px', 
      borderRadius: '8px',
      marginBottom: '20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ margin: '0 0 15px 0', color: '#5a4a3a' }}>Resources</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ padding: '10px', background: '#fff', borderRadius: '4px' }}>
          <strong>🌾 Catnip:</strong> {formatNumber(resources.catnip)} {formatRate(rates.catnip)}
        </div>
        <div style={{ padding: '10px', background: '#fff', borderRadius: '4px' }}>
          <strong>🪵 Wood:</strong> {formatNumber(resources.wood)} {formatRate(rates.wood)}
        </div>
        <div style={{ padding: '10px', background: '#fff', borderRadius: '4px' }}>
          <strong>⛰️ Minerals:</strong> {formatNumber(resources.minerals)} {formatRate(rates.minerals)}
        </div>
        <div style={{ padding: '10px', background: '#fff', borderRadius: '4px' }}>
          <strong>🔬 Science:</strong> {formatNumber(resources.science)} {formatRate(rates.science)}
        </div>
      </div>
    </div>
  );
};
