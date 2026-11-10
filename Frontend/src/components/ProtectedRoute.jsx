import { Navigate, useLocation } from 'react-router-dom';
import { getIdToken, setIdToken, setStoredUserId } from '../services/api';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = getIdToken();

  // Permitir acceso sin login para desarrollo, sandbox, pruebas y seleccion de personajes offline
  const isDevBypass =
    location.pathname === '/dev' ||
    location.pathname === '/sandbox' ||
    location.pathname === '/test' ||
    location.pathname === '/character-selection' ||
    location.pathname === '/join' ||
    location.pathname === '/game' ||
    location.search.includes('dev=true') ||
    location.search.includes('test=true') ||
    location.search.includes('sandbox=true') ||
    location.search.includes('offline=true');

  if (isDevBypass) {
    if (!token) {
      setIdToken('guest-offline-token');
      setStoredUserId('player-local-host');
    }
    return children;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
