import { useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { verifyEmail } from '../services/api'
import BulletBackground from '../components/BulletBackground'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const userId = searchParams.get('userId')
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!userId || !token || !email) {
      setStatus('error')
      setMessage('Enlace de verificación inválido.')
      return
    }

    verifyEmail({ userId, token, email })
      .then((res) => {
        setStatus('success')
        setMessage(typeof res === 'string' ? res : 'Correo verificado exitosamente.')
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.message || 'Error al verificar el correo.')
      })
  }, [userId, token, email])

  return (
    <div className="page-container">
      <BulletBackground />
      <div className="danma-title">DANMA</div>
      <div className="danma-subtitle">Bullet Hell Arena</div>

      <div className="auth-card">
        <div className="verify-container">
          <div className="icon">{status === 'success' ? '✅' : status === 'error' ? '❌' : '⏳'}</div>
          <h2>Email Verification</h2>
          {status === 'loading' && <p>Verificando tu correo...</p>}
          {status !== 'loading' && <p>{message}</p>}
          {status === 'success' && (
            <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/login')}>
              Ir a Login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
