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

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/join" element={<JoinSelection />} />
      
      {/* 2. Agregar la nueva ruta del lobby de personajes */}
      <Route path="/character-selection" element={<CharacterSelection />} />
      <Route path="/lobby-browser" element={<LobbyBrowser />} />
      <Route path="/game" element={<Game />} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App