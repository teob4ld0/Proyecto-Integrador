import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BulletBackground from '../components/BulletBackground';

export default function JoinSelection() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');

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
        
        {/* Fila superior (CREATE y JOIN) */}
        <div className="menu-row">
          <button 
            className="menu-btn" 
            onClick={() => navigate('/character-selection')} 
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
            onClick={() => console.log('Backend: Lógica para unirse usando el código:', roomCode)}
          >
            CODE
          </button>
          
          {/* El input con forma de U abajo */}
          <input 
            type="text" 
            className="code-input"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6} /* Limite de caracteres de ejemplo */
            placeholder="..."
          />
        </div>

      </div>
    </div>
  );
}