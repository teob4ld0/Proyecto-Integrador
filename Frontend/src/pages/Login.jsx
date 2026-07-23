import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser, resendVerificationEmail, setIdToken } from '../services/api'
import BulletBackground from '../components/BulletBackground'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    try {
      const data = await loginUser(form)
      if (data.token) {
        setIdToken(data.token)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    const email = form.email.trim()
    if (!email) {
      setError('Ingresa tu email para reenviar la verificación.')
      return
    }

    setResending(true)
    setError('')
    setInfo('')

    try {
      const res = await resendVerificationEmail(email)
      setInfo(res.message || 'Correo de verificación reenviado.')
    } catch (err) {
      setError(err.message || 'No se pudo reenviar el correo de verificación.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="page-container">
      <BulletBackground />
      
      {/* Reutilizamos exactamente la misma cabecera del menú con sus estilos nuevos */}
      <div className="menu-header" style={{ marginBottom: '2rem' }}>
        <h1 className="menu-title">DANMAKREW</h1>
        <h2 className="menu-subtitle">NOMERCYGAMES</h2>
      </div>

      <div className="auth-card">
        <h2>Log In</h2>

        {error && <div className="message error">{error}</div>}
        {info && <div className="message success">{info}</div>}

        <form onSubmit={handleSubmit}>
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
              placeholder="Your password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          {/* Cambiamos a una clase dedicada para estilizar el botón según el nuevo formato */}
          <button type="submit" className="btn-login-submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Enter the Arena'}
          </button>

          <button
            type="button"
            className="btn-login-submit"
            onClick={handleResendVerification}
            disabled={resending}
            style={{ marginTop: '0.75rem', opacity: resending ? 0.7 : 1 }}
          >
            {resending ? 'Reenviando...' : 'Reenviar correo de verificación'}
          </button>
        </form>

        <div className="auth-link">
          Fresh meat? <Link to="/register">Create account</Link>
        </div>
      </div>
    </div>
  )
}