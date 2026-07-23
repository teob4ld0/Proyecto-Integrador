import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../services/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verificando tu espíritu de pelea...');
  const hasFetched = useRef(false); // <--- El escudo contra el doble disparo de React

  useEffect(() => {
    // Si ya hicimos la petición, no la vuelvas a hacer
    if (hasFetched.current) return;
    hasFetched.current = true;

    // Extraemos los datos del enlace que te mandó Gmail
    const userId = searchParams.get('userId');
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!userId || !token || !email) {
      setStatus('Enlace incompleto. Vuelve a revisar tu correo.');
      return;
    }

    // Reutilizamos el cliente API para evitar desfasajes de URL/base path.
    verifyEmail({ userId, token, email })
      .then(() => {
        setStatus('¡Cuenta verificada con éxito! Redirigiendo a la arena...');
        setTimeout(() => navigate('/login'), 3000);
      })
      .catch((err) => {
        console.error('Fallo al verificar email:', err);
        setStatus(`No se pudo verificar: ${err.message || 'Error desconocido.'}`);
      });
  }, [searchParams, navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white', backgroundColor: '#1a1a1a' }}>
      <div style={{ textAlign: 'center', padding: '20px', border: '1px solid #ff2d55', borderRadius: '10px' }}>
        <h2>{status}</h2>
      </div>
    </div>
  );
}