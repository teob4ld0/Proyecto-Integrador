import { Link } from 'react-router-dom'
import BulletBackground from '../components/BulletBackground'

export default function Home() {
  const token = localStorage.getItem('danma_token')

  const handleLogout = () => {
    localStorage.removeItem('danma_token')
    window.location.reload()
  }

  return (
    <div className="page-container">
      <BulletBackground />
      <div className="home-container">
        <div className="danma-title">DANMA</div>
        <div className="danma-subtitle">Bullet Hell Arena</div>

        <div className="home-nav">
          {token ? (
            <>
              <button
                onClick={handleLogout}
                className="btn-primary"
                style={{ width: 'auto', padding: '0.8rem 2rem' }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Log In</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
