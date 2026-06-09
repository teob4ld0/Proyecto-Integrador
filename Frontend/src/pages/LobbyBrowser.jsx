import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPublicRooms, joinRoom } from '../services/api';
import '../styles/lobby-browser.css';

export default function LobbyBrowser() {
  const navigate = useNavigate();
  const [lobbies, setLobbies] = useState([]);
  const [selectedLobbyId, setSelectedLobbyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const rooms = await getPublicRooms();
      setLobbies(rooms);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
      setError('Error loading lobbies.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinParty = async () => {
    if (selectedLobbyId) {
      try {
        const result = await joinRoom(selectedLobbyId);
        console.log('Joined lobby successfully:', result);
        navigate('/character-selection');
      } catch (err) {
        console.error('Error joining lobby:', err);
        alert('Could not join room: ' + err.message);
      }
    }
  };

  const selectedLobby = lobbies.find(l => l.id === selectedLobbyId);

  return (
    <div className="lobby-browser-container">
      
      {/* TOP HEADER */}
      <div className="lb-header">
        <button className="back-arrow-btn" style={{ position: 'relative', top: 0, left: 0 }} onClick={() => navigate('/join')}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 19L3 12M3 12L10 5M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button className="lb-diff-btn normal">NORMAL</button>
        <button className="lb-diff-btn dificult">DIFICULT</button>
        <button className="lb-diff-btn nomercy">NO MERCY</button>
      </div>

      {/* MAIN CONTENT */}
      <div className="lb-main-content">
        
        {/* LEFT PANEL */}
        <div className="lb-left-panel">
          <div className="lb-list-container">
            {loading && <div className="lb-message">LOADING LOBBIES...</div>}
            {error && <div className="lb-message error">{error}</div>}
            {!loading && !error && lobbies.length === 0 && (
              <div className="lb-message">NO PUBLIC LOBBIES FOUND</div>
            )}
            {lobbies.map(lobby => (
              <div 
                key={lobby.id} 
                className={`lb-lobby-row ${selectedLobbyId === lobby.id ? 'selected' : ''}`}
                onClick={() => setSelectedLobbyId(lobby.id)}
              >
                <div className="lb-box lvl">{lobby.name}</div>
                <div className="lb-box admin">{lobby.hostId ? lobby.hostId.substring(0, 8) : 'Host'}</div>
                <div className="lb-box players">{lobby.players}/{lobby.maxPlayers}</div>
              </div>
            ))}
          </div>
          
          <div className="lb-join-container">
            <button 
              className="lb-join-btn" 
              disabled={!selectedLobbyId}
              onClick={handleJoinParty}
            >
              JOIN PARTY
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="lb-right-panel">
          <div className="lb-info-box">
            <h3>REQUIREMENTS</h3>
            <div className="lb-info-content">
              {selectedLobbyId ? (
                <p>- LEVEL 10+<br/>- GOOD CONNECTION<br/>- READY TO DIE</p>
              ) : (
                <p>SELECT A LOBBY</p>
              )}
            </div>
          </div>
          
          <div className="lb-info-box">
            <h3>REWARDS</h3>
            <div className="lb-info-content">
              {selectedLobbyId ? (
                <p>- +500 EXP<br/>- NEON CRYSTALS<br/>- RARE SKINS</p>
              ) : (
                <p>SELECT A LOBBY</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
