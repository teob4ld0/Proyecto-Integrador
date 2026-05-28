import { useNavigate } from 'react-router-dom';
import BulletBackground from '../components/BulletBackground';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="menu-page-container">
      {/* Fondo animado que ya tenés */}
      <BulletBackground />

      {/* Botón de volver (Flecha arriba a la izquierda) */}
      <button className="back-arrow-btn" onClick={() => navigate('/')}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 19L3 12M3 12L10 5M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Títulos centrales */}
      <div className="menu-header">
        <h1 className="menu-title">DANMAKREW</h1>
        <h2 className="menu-subtitle">NOMERCYGAMES</h2>
      </div>

      {/* Contenedor de botones */}
      <div className="menu-buttons-container">
        {/* Fila superior (Shop e Inventory) */}
        <div className="menu-row">
          <button className="menu-btn" onClick={() => console.log('Ir a Shop')}>
            {/* Ícono de carrito */}
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.70711 15.2929C4.07714 15.9229 4.52331 17 5.41421 17H17M17 17C15.8954 17 15 17.8954 15 19C15 20.1046 15.8954 21 17 21C18.1046 21 19 20.1046 19 19C19 17.8954 18.1046 17 17 17ZM9 19C9 20.1046 8.10457 21 7 21C5.89543 21 5 20.1046 5 19C5 17.8954 5.89543 17 7 17C8.10457 17 9 17.8954 9 19Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            SHOP
          </button>

          <button className="menu-btn" onClick={() => console.log('Ir a Inventory')}>
            {/* Ícono de caja/inventario */}
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 8L12 13L3 8M21 8L12 3L3 8M21 8V16L12 21M3 8V16L12 21M12 13V21M7.5 5.5L16.5 10.5M7.5 18.5L16.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            INVENTORY
          </button>
        </div>

        {/* Fila inferior (Play) */}
        <div className="menu-row">
          <button className="menu-btn" onClick={() => console.log('Play!')}>
            PLAY
          </button>
        </div>
      </div>
    </div>
  );
}