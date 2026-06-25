import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPublicRooms, getUsersList, joinRoom } from '../services/api';
import '../styles/lobby-browser.css';

const DIFFICULTY_META = {
  normal: {
    label: 'NORMAL',
    className: 'normal',
  },
  difficult: {
    label: 'DIFFICULT',
    className: 'difficult',
  },
  no_mercy: {
    label: 'NO MERCY',
    className: 'nomercy',
  },
};

function normalizeDifficulty(value) {
  if (value === 'no_mercy') return 'no_mercy';
  if (value === 'difficult' || value === 'dificult') return 'difficult';
  return 'normal';
}

function resolvePlayersCount(lobby) {
  const count = lobby?.player?.count;
  if (typeof count === 'number' && Number.isFinite(count)) return count;

  if (typeof lobby?.playersCount === 'number' && Number.isFinite(lobby.playersCount)) {
    return lobby.playersCount;
  }

  if (Array.isArray(lobby?.players)) return lobby.players.length;

  if (typeof lobby?.players === 'number' && Number.isFinite(lobby.players)) {
    return lobby.players;
  }

  return 1;
}

export default function LobbyBrowser() {
  const navigate = useNavigate();
  const [lobbies, setLobbies] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [selectedLobbyId, setSelectedLobbyId] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRooms(true);

    const intervalId = setInterval(() => {
      fetchRooms(false);
    }, 2000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getUsersList()
      .then((users) => {
        if (cancelled || !Array.isArray(users)) return;
        const nextMap = {};
        for (const user of users) {
          if (user?.id && user?.username) {
            nextMap[user.id] = user.username;
          }
        }
        setUsersById(nextMap);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchRooms = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const rooms = await getPublicRooms();
      const onlyPublicRooms = Array.isArray(rooms)
        ? rooms.filter((room) => room?.isPublic !== false)
        : [];
      setLobbies(onlyPublicRooms);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
      setError('Error loading lobbies.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleJoinParty = async () => {
    if (selectedLobbyId && selectedLobby) {
      try {
        const result = await joinRoom(selectedLobbyId);
        console.log('Joined lobby successfully:', result);
        navigate('/character-selection', { state: { roomId: selectedLobbyId, isHost: false, alreadyJoined: true } });
      } catch (err) {
        console.error('Error joining lobby:', err);
        alert('Could not join room: ' + err.message);
      }
    }
  };

  const filteredLobbies = useMemo(() => {
    if (selectedDifficulty === 'all') return lobbies;
    return lobbies.filter((lobby) => normalizeDifficulty(lobby?.difficulty) === selectedDifficulty);
  }, [lobbies, selectedDifficulty]);

  useEffect(() => {
    if (!selectedLobbyId) return;
    const stillVisible = filteredLobbies.some((lobby) => lobby.id === selectedLobbyId);
    if (!stillVisible) {
      setSelectedLobbyId(null);
    }
  }, [filteredLobbies, selectedLobbyId]);

  const selectedLobby = filteredLobbies.find((lobby) => lobby.id === selectedLobbyId);

  const resolveUserName = (userId, fallback = 'PLAYER') => {
    if (!userId) return fallback;
    return usersById[userId] || fallback;
  };

  const resolvePlayerNames = (lobby) => {
    const players = Array.isArray(lobby?.players) ? lobby.players : [];
    if (!players.length) return 'NO PLAYERS';
    return players.map((id) => resolveUserName(id, 'PLAYER')).join(', ');
  };

  return (
    <div className="lobby-browser-container">
      
      {/* TOP HEADER */}
      <div className="lb-header">
        <button className="back-arrow-btn" style={{ position: 'relative', top: 0, left: 0 }} onClick={() => navigate('/join')}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 19L3 12M3 12L10 5M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button
          className={`lb-diff-btn normal ${selectedDifficulty === 'normal' ? 'active' : ''}`}
          onClick={() => setSelectedDifficulty((prev) => (prev === 'normal' ? 'all' : 'normal'))}
        >
          NORMAL
        </button>
        <button
          className={`lb-diff-btn difficult ${selectedDifficulty === 'difficult' ? 'active' : ''}`}
          onClick={() => setSelectedDifficulty((prev) => (prev === 'difficult' ? 'all' : 'difficult'))}
        >
          DIFFICULT
        </button>
        <button
          className={`lb-diff-btn nomercy ${selectedDifficulty === 'no_mercy' ? 'active' : ''}`}
          onClick={() => setSelectedDifficulty((prev) => (prev === 'no_mercy' ? 'all' : 'no_mercy'))}
        >
          NO MERCY
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="lb-main-content">
        
        {/* LEFT PANEL */}
        <div className="lb-left-panel">
          <div className="lb-list-container">
            {loading && <div className="lb-message">LOADING LOBBIES...</div>}
            {error && <div className="lb-message error">{error}</div>}
            {!loading && !error && filteredLobbies.length === 0 && (
              <div className="lb-message">NO PUBLIC LOBBIES FOUND</div>
            )}
            {filteredLobbies.map((lobby) => {
              const difficultyKey = normalizeDifficulty(lobby?.difficulty);
              const difficultyMeta = DIFFICULTY_META[difficultyKey];
              return (
              <div 
                key={lobby.id} 
                className={`lb-lobby-row ${selectedLobbyId === lobby.id ? 'selected' : ''}`}
                onClick={() => setSelectedLobbyId(lobby.id)}
              >
                <div className={`lb-box lvl ${difficultyMeta.className}`}>
                  <span className="lb-room-name">{lobby.name}</span>
                  <span className="lb-room-difficulty">{difficultyMeta.label}</span>
                </div>
                <div className="lb-box admin">{resolveUserName(lobby.hostId, 'HOST')}</div>
                <div className="lb-box players">{resolvePlayersCount(lobby)}/{lobby.maxPlayers}</div>
              </div>
              );
            })}
          </div>
          
          <div className="lb-join-container">
            <button 
              className="lb-join-btn" 
              disabled={!selectedLobby}
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
                <p>{resolvePlayerNames(selectedLobby)}</p>
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
