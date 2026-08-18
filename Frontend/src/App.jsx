import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import JoinSelection from './pages/JoinSelection'
import CharacterSelection from './pages/CharacterSelection'
import LobbyBrowser from './pages/LobbyBrowser'
import Game from './pages/Game'
import OrientationGuard from './components/OrientationGuard'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  useEffect(() => {
    const tryAutoFullscreenInLandscape = () => {
      if (typeof window === 'undefined') return;
      const isLandscape = window.innerWidth > window.innerHeight && window.innerHeight <= 700;
      if (isLandscape && !document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };

    window.addEventListener('orientationchange', tryAutoFullscreenInLandscape);
    window.addEventListener('resize', tryAutoFullscreenInLandscape);
    window.addEventListener('touchstart', tryAutoFullscreenInLandscape, { passive: true });
    window.addEventListener('pointerdown', tryAutoFullscreenInLandscape, { passive: true });
    window.addEventListener('click', tryAutoFullscreenInLandscape, { passive: true });

    return () => {
      window.removeEventListener('orientationchange', tryAutoFullscreenInLandscape);
      window.removeEventListener('resize', tryAutoFullscreenInLandscape);
      window.removeEventListener('touchstart', tryAutoFullscreenInLandscape);
      window.removeEventListener('pointerdown', tryAutoFullscreenInLandscape);
      window.removeEventListener('click', tryAutoFullscreenInLandscape);
    };
  }, []);

  return (
    <>
      <OrientationGuard />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        
        {/* Rutas protegidas (Requieren login y token válido) */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/join" element={<ProtectedRoute><JoinSelection /></ProtectedRoute>} />
        <Route path="/character-selection" element={<ProtectedRoute><CharacterSelection /></ProtectedRoute>} />
        <Route path="/lobby-browser" element={<ProtectedRoute><LobbyBrowser /></ProtectedRoute>} />
        <Route path="/game" element={<ProtectedRoute><Game /></ProtectedRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App