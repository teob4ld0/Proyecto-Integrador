import { useSearchParams } from 'react-router-dom'
import BulletBackground from '../components/BulletBackground'

/**
 * Placeholder page for Issue #8 - Mail Verification using Brevo.
 * 
 * Future implementation will:
 * - Read a verification token from the URL query params (?token=xxx)
 * - Call the backend to verify the email address
 * - Show success/error state
 */
export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  return (
    <div className="page-container">
      <BulletBackground />
      <div className="danma-title">DANMA</div>
      <div className="danma-subtitle">Bullet Hell Arena</div>

      <div className="auth-card">
        <div className="verify-container">
          <div className="icon">✉️</div>
          <h2>Email Verification</h2>
          <p>
            {token
              ? 'Verifying your email address... (not yet implemented)'
              : 'Check your inbox for a verification link after registering.'}
          </p>
          <p style={{ marginTop: '1.5rem', color: '#555', fontSize: '0.6rem' }}>
            Powered by Brevo — coming soon
          </p>
        </div>
      </div>
    </div>
  )
}
