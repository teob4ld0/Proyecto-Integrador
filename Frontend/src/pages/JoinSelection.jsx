import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BulletBackground from '../components/BulletBackground';
import { joinRoomByCode } from '../services/api';

export default function JoinSelection() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [loadingCodeJoin, setLoadingCodeJoin] = useState(false);
  const [error, setError] = useState('');

  const handleJoinByCode = async () => {
    const normalized = roomCode.trim().toUpperCase();
    if (!normalized) {
      setError('Ingresa un código de sala.');
      return;
    }

    if (normalized.length !== 6) {
      setError('El código debe tener 6 caracteres.');
      return;
    }

    setLoadingCodeJoin(true);
    setError('');

    try {
      const room = await joinRoomByCode(normalized);
      navigate('/character-selection', {
        state: {
          roomId: room.id,
          roomCode: normalized,
          isHost: false,
          alreadyJoined: true,
        },
      });
    } catch (err) {
      setError(err.message || 'No se pudo unir a la sala.');
    } finally {
      setLoadingCodeJoin(false);
    }
  };

  return (
    <div className="menu-page-container">
      {/* Fondo animado */}
      <BulletBackground />

      {/* Botón de volver (Te lleva al Dashboard anterior) */}
      <button className="back-arrow-btn" onClick={() => navigate('/dashboard')}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 19L3 12M3 12L10 5M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Cabecera unificada */}
      <div className="menu-header">
        <h1 className="menu-title">DANMAKREW</h1>
        <h2 className="menu-subtitle">NOMERCYGAMES</h2>
      </div>

      <div className="menu-buttons-container">
        {error && <div className="message error" style={{ marginBottom: '1rem' }}>{error}</div>}
        
        {/* Fila superior (CREATE y JOIN) */}
        <div className="menu-row">
          <button 
            className="menu-btn" 
            onClick={() => navigate('/character-selection', { state: { isHost: true } })} 
          >
            CREATE
          </button>

          <button 
            className="menu-btn" 
            onClick={() => navigate('/lobby-browser')}
          >
            JOIN
          </button>
        </div>

        {/* Fila inferior (CODE y el Input en forma de U) */}
        <div className="code-input-group">
          {/* El "botón" superior que dice CODE */}
          <button 
            className="code-btn" 
            onClick={handleJoinByCode}
            disabled={loadingCodeJoin}
          >
            {loadingCodeJoin ? 'JOINING...' : 'CODE'}
          </button>
          
          {/* El input con forma de U abajo */}
          <input 
            type="text" 
            className="code-input"
            value={roomCode}
            onChange={(e) => {
              setRoomCode(e.target.value.toUpperCase());
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleJoinByCode();
              }
            }}
            maxLength={6} /* Limite de caracteres de ejemplo */
            placeholder="..."
          />
        </div>

      </div>
    </div>
  );
}