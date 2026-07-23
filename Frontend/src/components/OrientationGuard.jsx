import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 1024;

function isPortraitMobileViewport() {
  return window.innerWidth <= MOBILE_BREAKPOINT && window.innerHeight > window.innerWidth;
}

export default function OrientationGuard() {
  const [isPortraitMobile, setIsPortraitMobile] = useState(() => isPortraitMobileViewport());

  useEffect(() => {
    const handleViewportChange = () => {
      setIsPortraitMobile(isPortraitMobileViewport());
    };

    handleViewportChange();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    if (window.screen?.orientation?.lock) {
      window.screen.orientation.lock('landscape').catch(() => {});
    }

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, []);

  if (!isPortraitMobile) return null;

  return (
    <div className="orientation-lock-overlay" role="alert" aria-live="assertive">
      <div className="orientation-lock-card">
        <h2>Rotate Device</h2>
        <p>Danmakrew is optimized for horizontal mode on mobile.</p>
      </div>
    </div>
  );
}
