import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BulletBackground from '../components/BulletBackground';

export default function Register() {
  const navigate = useNavigate();
  
  // Estado puramente visual para que el formulario funcione en el frontend
  const [form, setForm] = useState({ username: '', email: '', password: '' });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Le dejamos la tarea al del backend
    console.log('Backend: Hacer fetch a la API de registro con:', form);
    
    // Simulamos que se registró y lo mandamos a la pantalla de Log In
    navigate('/login');
  };

  return (
    <div className="menu-page-container">
      <BulletBackground />

      {/* Botón de volver al Home */}
      <button className="back-arrow-btn" onClick={() => navigate('/')}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 19L3 12M3 12L10 5M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Cabecera unificada con el Home y el Login */}
      <div className="menu-header" style={{ marginBottom: '2rem' }}>
        <h1 className="menu-title">DANMAKREW</h1>
        <h2 className="menu-subtitle">NOMERCYGAMES</h2>
      </div>

      <div className="auth-card">
        <h2>Sign In</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="3-11 characters"
              value={form.username}
              onChange={handleChange}
              required
              minLength={3}
              maxLength={11}
              pattern="^[a-zA-Z0-9_]+$"
              title="Letters, numbers and underscores only"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="player@danma.gg"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Min 6 characters"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          {/* El botón estético que usa la nueva clase del CSS */}
          <button type="submit" className="btn-login-submit">
            Create Account
          </button>
        </form>

        <div className="auth-link">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}