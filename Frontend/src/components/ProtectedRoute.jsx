import { Navigate } from 'react-router-dom';
import { getIdToken } from '../services/api';

export default function ProtectedRoute({ children }) {
  const token = getIdToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
