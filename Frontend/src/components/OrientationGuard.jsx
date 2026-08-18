import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const MOBILE_BREAKPOINT = 1024;

function isPortraitMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT && window.innerHeight > window.innerWidth;
}

export default function OrientationGuard() {
  const location = useLocation();
  const [isPortraitMobile, setIsPortraitMobile] = useState(() => isPortraitMobileViewport());

  // Solo activar guard de rotación en el juego activo (/game) para permitir menús tanto en vertical como en horizontal
  const isGameRoute = location.pathname === '/game';

  useEffect(() => {
    const handleViewportChange = () => {
      setIsPortraitMobile(isPortraitMobileViewport());
    };

    handleViewportChange();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, []);

  if (!isGameRoute || !isPortraitMobile) return null;

  return (
    <div className="orientation-lock-overlay" role="alert" aria-live="assertive">
      <div className="orientation-lock-card">
        <h2>GIRÁ TU DISPOSITIVO</h2>
        <p>La partida de juego está optimizada para modo horizontal (Landscape).</p>
      </div>
    </div>
  );
}
