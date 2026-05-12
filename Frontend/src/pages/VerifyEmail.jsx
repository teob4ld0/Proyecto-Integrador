import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

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

    // Leemos la variable que pusiste en el .env del frontend
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

    // Disparamos al backend
    fetch(`${apiUrl}/auth/verify-email?userId=${userId}&token=${token}&email=${email}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus('¡Cuenta verificada con éxito! Redirigiendo a la arena...');
          // Esperamos 3 segundos y lo mandamos al login
          setTimeout(() => navigate('/login'), 3000);
        } else {
          const errorText = await res.text();
          setStatus(`No se pudo verificar: ${errorText}`);
        }
      })
      .catch((err) => {
        console.error("Fallo catastrófico:", err);
        setStatus('Error de conexión con el servidor. ¿Está el backend encendido?');
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