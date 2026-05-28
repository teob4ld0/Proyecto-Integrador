import { useNavigate } from 'react-router-dom';
import BulletBackground from '../components/BulletBackground';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="menu-page-container">
      {/* Fondo animado */}
      <BulletBackground />

      {/* Títulos con el degradado en los bordes y la tipografía de NoMercyGames */}
      <div className="menu-header">
        <h1 className="menu-title">DANMAKREW</h1>
        <h2 className="menu-subtitle">NOMERCYGAMES</h2>
      </div>

      {/* Contenedor de los botones */}
      <div className="menu-buttons-container">
        
        {/* Fila superior (LOG IN y SIGN IN) */}
        <div className="menu-row">
          <button 
            className="menu-btn" 
            onClick={() => navigate('/login')}
          >
            LOG IN
          </button>

          <button 
            className="menu-btn" 
            onClick={() => navigate('/register')}
          >
            SIGN IN
          </button>
        </div>

        {/* Fila inferior (GTFO) */}
        <div className="menu-row">
          <button 
            className="menu-btn" 
            onClick={() => console.log('Backend: Conectar acción de salir/cerrar juego')}
          >
            GTFO ;]
          </button>
        </div>

      </div>
    </div>
  );
}