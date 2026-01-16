import { useGameStore } from '../store/gameStore';

export const GatheringActions = () => {
  const addResource = useGameStore((state) => state.addResource);

  const buttonStyle = {
    padding: '12px 24px',
    background: '#6b9d7a',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'background 0.2s',
  };

  return (
    <div style={{ 
      background: '#f0e8d8', 
      padding: '20px', 
      borderRadius: '8px',
      marginBottom: '20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ margin: '0 0 15px 0', color: '#5a4a3a' }}>Gather Resources</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
        <button
          style={buttonStyle}
          onClick={() => addResource('catnip', 1)}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#7eb08d')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#6b9d7a')}
        >
          🌾 Gather Catnip
        </button>
        <button
          style={buttonStyle}
          onClick={() => addResource('wood', 1)}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#7eb08d')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#6b9d7a')}
        >
          🪵 Chop Wood
        </button>
        <button
          style={buttonStyle}
          onClick={() => addResource('minerals', 1)}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#7eb08d')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#6b9d7a')}
        >
          ⛰️ Mine Minerals
        </button>
      </div>
    </div>
  );
};
