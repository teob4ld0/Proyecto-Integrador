import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BulletBackground from '../components/BulletBackground';
import { createRoom, deleteRoom, getRoom, getRoomByCode, getUsersList, joinRoom, leaveRoom, roomCodeFromRoomId, updateRoom, getCurrentUser } from '../services/api';

const CHARACTER_COLORS = ['blue', 'red', 'green', 'yellow', 'purple', 'orange'];

const DIFFICULTY_META = {
  normal: { label: 'NORMAL', className: 'normal' },
  difficult: { label: 'DIFFICULT', className: 'difficult' },
  no_mercy: { label: 'NO MERCY', className: 'nomercy' },
};

function normalizeDifficulty(value) {
  if (value === 'no_mercy') return 'no_mercy';
  if (value === 'difficult' || value === 'dificult') return 'difficult';
  return 'normal';
}

function getRandomColor(exclude = '') {
  const filtered = CHARACTER_COLORS.filter((color) => color !== exclude);
  const pool = filtered.length > 0 ? filtered : CHARACTER_COLORS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function resolveRoomCode(roomData, fallbackCode = '') {
  const normalizedFallback = String(fallbackCode || '').trim().toUpperCase();
  if (normalizedFallback) return normalizedFallback;
  return roomCodeFromRoomId(roomData?.id);
}

function resolvePlayersCount(roomData) {
  const count = roomData?.player?.count;
  if (typeof count === 'number' && Number.isFinite(count)) return count;

  if (typeof roomData?.playersCount === 'number' && Number.isFinite(roomData.playersCount)) {
    return roomData.playersCount;
  }

  if (Array.isArray(roomData?.players)) return roomData.players.length;

  if (typeof roomData?.players === 'number' && Number.isFinite(roomData.players)) {
    return roomData.players;
  }

  return 1;
}

function normalizePlayerCharacters(roomData, fallbackCharacters = {}) {
  const players = Array.isArray(roomData?.players) ? roomData.players : [];
  const incomingCharacters = roomData?.playerCharacters && typeof roomData.playerCharacters === 'object'
    ? roomData.playerCharacters
    : {};
  const mergedCharacters = { ...(fallbackCharacters || {}), ...incomingCharacters };
  const normalizedCharacters = {};

  for (const playerId of players) {
    normalizedCharacters[playerId] = mergedCharacters[playerId] || getRandomColor();
  }

  return normalizedCharacters;
}

function getWsSignalUrl() {
  const wsEnv = (import.meta.env.VITE_WS_URL || '').trim();
  if (wsEnv) {
    return wsEnv.endsWith('/signal') ? wsEnv : `${wsEnv.replace(/\/$/, '')}/signal`;
  }

  const apiEnv = (import.meta.env.VITE_API_URL || '').trim();
  if (apiEnv) {
    try {
      const parsed = new URL(apiEnv);
      const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      const isLocalApiPort = parsed.port === '8080';
      const port = isLocalApiPort ? ':9001' : parsed.port ? `:${parsed.port}` : '';
      return `${protocol}//${parsed.hostname}${port}/signal`;
    } catch {
      // fall through to local default
    }
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:9001/signal`;
}

export default function CharacterSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('danma_token');
  const flowState = location.state || {};
  const initialIsHost = flowState.isHost !== false;
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lobbyCode, setLobbyCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [room, setRoom] = useState(null);
  const [roomError, setRoomError] = useState('');
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [playerName, setPlayerName] = useState(
    localStorage.getItem('danma_username') || 'PLAYER'
  );
  const [currentUserId, setCurrentUserId] = useState(
    localStorage.getItem('danma_userId') || ''
  );
  const [usernamesById, setUsernamesById] = useState({});
  const [activeRoomId, setActiveRoomId] = useState('');
  const [connectingPlayerIds, setConnectingPlayerIds] = useState([]);
  const leaveTriggeredRef = useRef(false);
  const wsRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const roomClosedRef = useRef(false);

  const players = resolvePlayersCount(room);
  const maxPlayers = 4;
  const occupiedSlots = Math.max(0, players - 1);
  const difficultyKey = normalizeDifficulty(room?.difficulty);
  const difficultyMeta = DIFFICULTY_META[difficultyKey];
  const roomPlayers = Array.isArray(room?.players) ? room.players : [];
  const hostId = room?.hostId || roomPlayers[0] || null;
  const joinerIds = useMemo(
    () => roomPlayers.filter((id) => id !== hostId),
    [hostId, roomPlayers],
  );
  const connectingJoinerIds = useMemo(
    () => connectingPlayerIds.filter((playerId) => !joinerIds.includes(playerId) && playerId !== hostId),
    [connectingPlayerIds, hostId, joinerIds],
  );
  const joinerSlots = useMemo(
    () => {
      const fill = [...joinerIds, ...connectingJoinerIds];
      return Array.from({ length: Math.max(0, maxPlayers - 1) }, (_, i) => fill[i] || null);
    },
    [joinerIds, connectingJoinerIds, maxPlayers],
  );

  const resolveDisplayName = (userId, fallback = 'PLAYER') => {
    if (!userId) return fallback;
    if (userId === currentUserId) return playerName;
    return usernamesById[userId] || fallback;
  };

  const getPlayerColor = (userId) => {
    if (!userId) return 'blue';
    const roomCharacters = room?.playerCharacters;
    if (roomCharacters && typeof roomCharacters === 'object') {
      return roomCharacters[userId] || 'blue';
    }
    return 'blue';
  };

  const setPlayerColorInRoom = (userId, color) => {
    if (!userId) return;
    setRoom((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        playerCharacters: {
          ...(prev.playerCharacters || {}),
          [userId]: color,
        },
      };
    });
  };

  const handleToggleCharacterForPlayer = (userId) => {
    if (!userId || userId !== currentUserId || !activeRoomId) return;
    const currentColor = getPlayerColor(userId);
    const nextColor = getRandomColor(currentColor);

    setPlayerColorInRoom(userId, nextColor);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'set-character-color',
        roomId: activeRoomId,
        color: nextColor,
      }));
    }
  };

  const leaveCurrentRoom = async (keepalive = false) => {
    if (!activeRoomId || !token || leaveTriggeredRef.current) return;
    leaveTriggeredRef.current = true;
    roomClosedRef.current = true;

    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    const isCurrentUserHost = room?.hostId
      ? room.hostId === currentUserId
      : flowState.isHost !== false;

    try {
      if (isCurrentUserHost) {
        await deleteRoom(activeRoomId, { keepalive });
      } else {
        await leaveRoom(activeRoomId, { keepalive });
      }
    } catch (err) {
      const message = (err?.message || '').toLowerCase();
      if (message.includes('room not found')) {
        return;
      }
      // Fallback: if role detection was stale, try the join-leave endpoint as non-host.
      if (isCurrentUserHost) {
        leaveRoom(activeRoomId, { keepalive }).catch(() => {});
      }
    }
  };

  // Fetch username if not in localStorage
  useEffect(() => {
    if (!localStorage.getItem('danma_username') && token) {
      getCurrentUser()
        .then((user) => {
          if (user.username) {
            localStorage.setItem('danma_username', user.username);
            setPlayerName(user.username);
          }
          if (user.id || user.userId) {
            const userId = user.id || user.userId;
            localStorage.setItem('danma_userId', userId);
            setCurrentUserId(userId);
          }
        })
        .catch(() => {});
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    getUsersList()
      .then((users) => {
        if (cancelled || !Array.isArray(users)) return;
        const map = {};
        for (const user of users) {
          if (user?.id && user?.username) {
            map[user.id] = user.username;
          }
        }
        setUsernamesById(map);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleToggleCharacterForPlayer(currentUserId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRoomId, currentUserId, room]);

  useEffect(() => {
    let activeWs;
    let cancelled = false;

    const bootstrapRoom = async () => {
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        setRoomError('');
        roomClosedRef.current = false;
        setConnectingPlayerIds([]);
        const isHost = flowState.isHost !== false;
        let roomData;
        let roomId = flowState.roomId || '';
        const roomCode = String(flowState.roomCode || '').trim().toUpperCase();
        const alreadyJoined = flowState.alreadyJoined === true;

        if (isHost) {
          if (roomId) {
            roomData = await getRoom(roomId);
          } else {
            roomData = await createRoom({
              name: 'NO MERCY LOBBY',
              map: 'classic',
              maxPlayers: 4,
              isPublic: !friendsOnly,
            });
            roomId = roomData.id;
          }
        } else {
          if (!roomId && roomCode) {
            const roomByCode = await getRoomByCode(roomCode);
            roomId = roomByCode.id;
          }

          if (!roomId) {
            throw new Error('Missing room id');
          }

          if (!alreadyJoined) {
            await joinRoom(roomId);
          }
          roomData = await getRoom(roomId);
        }

        if (cancelled) return;
        setRoom((prev) => ({
          ...roomData,
          playerCharacters: normalizePlayerCharacters(roomData, prev?.playerCharacters),
        }));
        setActiveRoomId(roomData.id);
        leaveTriggeredRef.current = false;
        setLobbyCode(resolveRoomCode(roomData, roomCode));
        setFriendsOnly(!roomData.isPublic);

        const wsUrl = `${getWsSignalUrl()}?token=${encodeURIComponent(token)}`;
        activeWs = new WebSocket(wsUrl);
        wsRef.current = activeWs;

        activeWs.onopen = () => {
          const type = isHost ? 'host-room' : 'join-room';
          activeWs.send(JSON.stringify({ type, roomId: roomData.id }));
        };

        activeWs.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'room-updated') {
              setRoom((prev) => {
                const updatedPlayers = Array.isArray(message.players)
                  ? message.players
                  : Array.isArray(prev?.players)
                    ? prev.players
                    : [];
                const updatedCount = typeof message.playersCount === 'number'
                  ? message.playersCount
                  : resolvePlayersCount({ players: updatedPlayers });
                const updatedCharacters = message.playerCharacters && typeof message.playerCharacters === 'object'
                  ? message.playerCharacters
                  : (prev?.playerCharacters || {});

                return {
                  ...(prev || {}),
                  players: updatedPlayers,
                  playersCount: updatedCount,
                  playerCharacters: normalizePlayerCharacters(
                    {
                      players: updatedPlayers,
                      playerCharacters: updatedCharacters,
                    },
                    prev?.playerCharacters,
                  ),
                  player: {
                    ...(prev?.player || {}),
                    count: updatedCount,
                  },
                };
              });
              if (Array.isArray(message.players)) {
                setConnectingPlayerIds((prev) => prev.filter((id) => !message.players.includes(id)));
              }
            }
            if (message.type === 'room-character-updated') {
              setRoom((prev) => {
                if (!prev) return prev;

                const updatedCharacters = message.playerCharacters && typeof message.playerCharacters === 'object'
                  ? message.playerCharacters
                  : {
                    ...(prev.playerCharacters || {}),
                    [message.userId]: message.color,
                  };

                return {
                  ...prev,
                  playerCharacters: updatedCharacters,
                };
              });
            }
            if (message.type === 'player-join-request') {
              if (message.userId) {
                setConnectingPlayerIds((prev) => {
                  if (prev.includes(message.userId)) return prev;
                  return [...prev, message.userId];
                });
              }
            }
            if (message.type === 'player-join-request' || message.type === 'room-joined') {
              getRoom(roomData.id).then((latest) => {
                if (!cancelled) {
                  setRoom((prev) => ({
                    ...latest,
                    playerCharacters: normalizePlayerCharacters(latest, prev?.playerCharacters),
                  }));
                  const latestPlayers = Array.isArray(latest?.players) ? latest.players : [];
                  setConnectingPlayerIds((prev) => prev.filter((id) => !latestPlayers.includes(id)));
                }
              }).catch(() => {});
            }
            if (message.type === 'host-disconnected') {
              roomClosedRef.current = true;
              if (refreshTimerRef.current) {
                clearInterval(refreshTimerRef.current);
                refreshTimerRef.current = null;
              }
              setRoomError(message.message || 'El host se salio de la sala.');
              setTimeout(() => {
                navigate('/join');
              }, 1200);
            }
            if (message.type === 'error') {
              setRoomError(message.message || 'Socket error');
            }
          } catch {
            // ignore malformed message
          }
        };

        activeWs.onclose = () => {
          // no-op: polling keeps UI updated while connected to the app
        };

        refreshTimerRef.current = setInterval(() => {
          if (roomClosedRef.current) return;
          getRoom(roomData.id)
            .then((latest) => {
              if (!cancelled) {
                setRoom((prev) => ({
                  ...latest,
                  playerCharacters: normalizePlayerCharacters(latest, prev?.playerCharacters),
                }));
                const latestPlayers = Array.isArray(latest?.players) ? latest.players : [];
                setConnectingPlayerIds((prev) => prev.filter((id) => !latestPlayers.includes(id)));
              }
            })
            .catch(() => {});

          if (activeWs && activeWs.readyState === WebSocket.OPEN) {
            activeWs.send(JSON.stringify({ type: 'ping' }));
          }
        }, 2000);
      } catch (err) {
        if (!cancelled) {
          setRoomError(err.message || 'Could not initialize room');
        }
      }
    };

    bootstrapRoom();

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (activeWs && activeWs.readyState === WebSocket.OPEN) {
        activeWs.close();
      }
      wsRef.current = null;
    };
  }, [flowState.alreadyJoined, flowState.isHost, flowState.roomCode, flowState.roomId, navigate, token]);

  useEffect(() => {
    if (!activeRoomId || !token) return;

    const handlePageExit = () => {
      leaveCurrentRoom(true);
    };

    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);

    return () => {
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
      leaveCurrentRoom(false);
    };
  }, [activeRoomId, currentUserId, flowState.isHost, room?.hostId, token]);

  const handleBack = async () => {
    await leaveCurrentRoom(false);
    navigate('/join');
  };

  const toggleSettings = () => {
    if (initialIsHost) setIsSettingsOpen(!isSettingsOpen);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(lobbyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  const handleToggleFriendsOnly = async () => {
    if (!room || !initialIsHost) return;
    const newValue = !friendsOnly;
    setFriendsOnly(newValue);
    try {
      const updated = await updateRoom(room.id, { isPublic: !newValue });
      setRoom((prev) => ({
        ...(prev || {}),
        ...updated,
        playerCharacters: normalizePlayerCharacters(updated, prev?.playerCharacters),
      }));
    } catch (err) {
      console.error('Failed to update room:', err);
      setFriendsOnly(!newValue); // revert on error
    }
  };

  const handleDifficultyChange = async (difficulty) => {
    if (!room || !initialIsHost || !difficulty) return;
    try {
      const updated = await updateRoom(room.id, { difficulty });
      setRoom((prev) => ({
        ...(prev || {}),
        ...updated,
        playerCharacters: normalizePlayerCharacters(updated, prev?.playerCharacters),
      }));
    } catch (err) {
      console.error('Failed to update difficulty:', err);
    }
  };

  return (
    <div className="cs-page-container">
      <BulletBackground />

      {/* TOP HEADER */}
      <header className="cs-header">
        <button className="cs-back-btn" onClick={handleBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
             <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>

        <div className={`cs-level-box ${difficultyMeta.className}`}>
          <span className={`cs-level-marker ${difficultyMeta.className}`}></span>
          <span className="cs-level-label">{difficultyMeta.label}</span>
        </div>

        <div className="cs-header-icons">
          {/* Box icon */}
          <button className="cs-icon-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </button>
          {/* Settings icon */}
          <button
            className="cs-icon-btn"
            onClick={toggleSettings}
            disabled={!initialIsHost}
            title={initialIsHost ? 'Room settings' : 'Only host can edit settings'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </header>

      {roomError && (
        <div className="message error" style={{ margin: '0 auto 1rem', maxWidth: '680px' }}>
          {roomError}
        </div>
      )}

      {/* MAIN GRID */}
      <div className="cs-main-grid">
        
        {/* SLOT 1 (Host - always leftmost) */}
        <div className="cs-slot">
          <div className="cs-slot-header">
            {hostId
              ? `${resolveDisplayName(hostId, 'HOST')} (HOST)`
              : 'HOST'}
          </div>
          <div className="cs-slot-body">
            <div
              className="cs-select-arrow up"
              onClick={hostId === currentUserId ? () => handleToggleCharacterForPlayer(hostId) : undefined}
              style={hostId === currentUserId ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
            ></div>
            <div className="cs-character-display">
              <div className={`cs-character-box ${getPlayerColor(hostId)}`}></div>
            </div>
            <div
              className="cs-select-arrow down"
              onClick={hostId === currentUserId ? () => handleToggleCharacterForPlayer(hostId) : undefined}
              style={hostId === currentUserId ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
            ></div>
          </div>
          <div className="cs-slot-footer">
            <div className="cs-equip-box"></div>
            <div className="cs-equip-box"></div>
            <div className="cs-equip-box"></div>
          </div>
        </div>

        {/* OTHER SLOTS (joiners fill left to right) */}
        {joinerSlots.map((joinerId, index) => {
          const isConnecting = Boolean(joinerId) && connectingJoinerIds.includes(joinerId);
          return (
          <div className="cs-slot" key={index}>
            <div className="cs-slot-header">
              {isConnecting
                ? 'Bitch Conecting...'
                : (joinerId
                  ? (joinerId === currentUserId
                    ? `${resolveDisplayName(joinerId)} (YOU)`
                    : resolveDisplayName(joinerId, `PLAYER ${index + 2}`))
                  : 'WAITING...')}
            </div>
            
            {!joinerId && (
              <div className="cs-slot-body empty">
                <button className="cs-invite-btn" disabled style={{ opacity: 0.6, cursor: 'default' }}>
                  OPEN SLOT
                </button>
              </div>
            )}

            {isConnecting && (
              <div className="cs-slot-body connecting">
                <div className="cs-spinner"></div>
              </div>
            )}

            {joinerId && !isConnecting && (
              <div className="cs-slot-body">
                <div
                  className="cs-select-arrow up"
                  onClick={joinerId === currentUserId ? () => handleToggleCharacterForPlayer(joinerId) : undefined}
                  style={joinerId === currentUserId ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
                ></div>
                <div className="cs-character-display">
                  <div className={`cs-character-box ${getPlayerColor(joinerId)}`}></div>
                </div>
                <div
                  className="cs-select-arrow down"
                  onClick={joinerId === currentUserId ? () => handleToggleCharacterForPlayer(joinerId) : undefined}
                  style={joinerId === currentUserId ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
                ></div>
              </div>
            )}

            <div className="cs-slot-footer">
              <div className="cs-equip-box"></div>
              <div className="cs-equip-box"></div>
              <div className="cs-equip-box"></div>
            </div>
          </div>
        );
        })}

      </div>

      {isSettingsOpen && <div className="cs-settings-overlay" onClick={toggleSettings}></div>}

      {/* SETTINGS SIDEBAR (Toggled by Gear Icon) */}
      <div className={`cs-settings-sidebar ${isSettingsOpen ? 'open' : ''}`}>
        <button className="cs-settings-close-btn" onClick={toggleSettings}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
             <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>

        <div className="cs-settings-row">
          <button className="cs-settings-btn">PLAYERS</button>
          <button className="cs-settings-btn">{Math.max(players, occupiedSlots + 1)}/{maxPlayers}</button>
        </div>

        <div className="cs-settings-column">
          <div className="cs-settings-label">DIFFICULTY</div>
          <div className="cs-settings-diff-grid">
            {Object.entries(DIFFICULTY_META).map(([value, meta]) => (
              <button
                key={value}
                className={`cs-settings-btn cs-diff-btn ${meta.className} ${difficultyKey === value ? 'active' : ''}`}
                onClick={() => handleDifficultyChange(value)}
                disabled={!initialIsHost}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cs-settings-row">
          <button className="cs-settings-btn">FRIENDS ONLY</button>
          <button 
            className={`cs-settings-btn ${friendsOnly ? 'active' : ''}`} 
            onClick={handleToggleFriendsOnly}
            disabled={!initialIsHost}
          >
            {friendsOnly ? '✓ ON' : '✗ OFF'}
          </button>
        </div>

        <div className="cs-settings-row">
          <button className="cs-settings-btn" style={{ cursor: 'default' }}>{lobbyCode}</button>
          <button className="cs-settings-btn" onClick={handleCopyCode}>
            {copied ? 'COPIED!' : 'COPY CODE'}
          </button>
        </div>
      </div>
    </div>
  );
}