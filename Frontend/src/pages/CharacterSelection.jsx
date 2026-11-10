import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BulletBackground from '../components/BulletBackground';
import { createRoom, deleteRoom, getRoom, getRoomByCode, getUsersList, joinRoom, leaveRoom, roomCodeFromRoomId, updateRoom, getCurrentUser, getIdToken, setCharacterColor, setPlayerReady, getStoredUserId, setStoredUserId } from '../services/api';

const CHARACTER_ROLE = ['Special_Attack', 'Support', 'Tank', 'DPS'];

const DIFFICULTY_META = {
  normal: {
    label: 'NORMAL',
    className: 'normal',
    worlds: ['Moonlit Forest', 'Scarlet Riverside', 'Celestial Observatory'],
  },
  difficult: {
    label: 'DIFFICULT',
    className: 'difficult',
    worlds: ['Infernal Peaks', 'Abyssal Depths', 'Storm Citadel'],
  },
  no_mercy: {
    label: 'NO MERCY',
    className: 'nomercy',
    worlds: ['Void Sanctum', 'Shattered Realm', 'Oblivion Edge'],
  },
};

const STAGE_TITLES = ['Danmaku Vanguard', 'Crimson Crossfire', 'Final Spell Duel'];

function clampLevelNum(value, fallback = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.min(3, Math.floor(num)));
}

function normalizeDifficulty(value) {
  if (value === 'no_mercy') return 'no_mercy';
  if (value === 'difficult' || value === 'dificult') return 'difficult';
  return 'normal';
}

function getNextRole(currentRole, direction = 'down', takenByOthers = []) {
  const takenSet = new Set(Array.isArray(takenByOthers) ? takenByOthers.filter(Boolean) : []);
  const currentIndex = CHARACTER_ROLE.indexOf(currentRole);
  const validIndex = currentIndex >= 0 ? currentIndex : 0;
  const step = direction === 'down' ? 1 : -1;

  for (let offset = 1; offset <= CHARACTER_ROLE.length; offset++) {
    const idx = (validIndex + step * offset + CHARACTER_ROLE.length * 2) % CHARACTER_ROLE.length;
    const candidate = CHARACTER_ROLE[idx];
    if (!takenSet.has(candidate)) {
      return candidate;
    }
  }

  return CHARACTER_ROLE[(validIndex + step + CHARACTER_ROLE.length) % CHARACTER_ROLE.length];
}

function getRandomRole(exclude = '') {
  const filtered = CHARACTER_ROLE.filter((role) => role !== exclude);
  const pool = filtered.length > 0 ? filtered : CHARACTER_ROLE;
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
  const usedRoles = new Set();

  for (const playerId of players) {
    const candidate = mergedCharacters[playerId];
    if (candidate && CHARACTER_ROLE.includes(candidate) && !usedRoles.has(candidate)) {
      normalizedCharacters[playerId] = candidate;
      usedRoles.add(candidate);
    } else {
      const freeRole = CHARACTER_ROLE.find((r) => !usedRoles.has(r)) || 'Special_Attack';
      normalizedCharacters[playerId] = freeRole;
      usedRoles.add(freeRole);
    }
  }

  return normalizedCharacters;
}

function normalizePlayerReady(roomData, fallbackReady = {}) {
  const players = Array.isArray(roomData?.players) ? roomData.players : [];
  const incomingReady = roomData?.playerReady && typeof roomData.playerReady === 'object'
    ? roomData.playerReady
    : {};
  const mergedReady = { ...(fallbackReady || {}), ...incomingReady };
  const normalizedReady = {};

  for (const playerId of players) {
    normalizedReady[playerId] = Boolean(mergedReady[playerId]);
  }

  return normalizedReady;
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
  const token = getIdToken();
  const flowState = location.state || {};
  const initialIsHost = flowState.isHost !== false;
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lobbyCode, setLobbyCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [room, setRoom] = useState(null);
  const [roomError, setRoomError] = useState('');
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [playerName, setPlayerName] = useState('PLAYER');
  const [currentUserId, setCurrentUserId] = useState(() => getStoredUserId());
  const [usernamesById, setUsernamesById] = useState({});
  const [activeRoomId, setActiveRoomId] = useState('');
  const [connectingPlayerIds, setConnectingPlayerIds] = useState([]);
  const [launchCountdown, setLaunchCountdown] = useState(null);
  const activeRoomIdRef = useRef('');
  const roomRef = useRef(null);
  const currentUserIdRef = useRef(currentUserId);
  const usernamesByIdRef = useRef(usernamesById);
  const creatingRoomPromiseRef = useRef(null);
  const leaveTriggeredRef = useRef(false);
  const isGameStartingRef = useRef(false);
  const wsRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const launchTimerRef = useRef(null);
  const roomClosedRef = useRef(false);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    usernamesByIdRef.current = usernamesById;
  }, [usernamesById]);

  const cancelLaunchCountdown = () => {
    if (launchTimerRef.current) {
      clearInterval(launchTimerRef.current);
      launchTimerRef.current = null;
    }
    isGameStartingRef.current = false;
    setLaunchCountdown(null);
  };

  const triggerGameLaunch = (overridePayload = {}) => {
    if (isGameStartingRef.current) return;
    isGameStartingRef.current = true;
    if (launchTimerRef.current) clearInterval(launchTimerRef.current);

    let count = 3;
    setLaunchCountdown(count);
    launchTimerRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(launchTimerRef.current);
        launchTimerRef.current = null;

        const latestRoom = roomRef.current || {};
        const myId = currentUserIdRef.current || getStoredUserId() || 'player-local-host';
        const mergedCharacters = {
          ...(latestRoom.playerCharacters || {}),
          ...(overridePayload.playerCharacters || {}),
        };
        const selectedRole = mergedCharacters[myId] || 'Tank';
        const targetRoomId = overridePayload.roomId || latestRoom.id || activeRoomIdRef.current || 'local-room';
        const targetDifficulty = normalizeDifficulty(overridePayload.difficulty || latestRoom.difficulty || 'normal');
        const targetWorld = clampLevelNum(overridePayload.world ?? latestRoom.world ?? 1, 1);
        const targetStage = clampLevelNum(overridePayload.stage ?? latestRoom.stage ?? 1, 1);
        const targetUsernames = {
          ...usernamesByIdRef.current,
          ...(myId && playerName ? { [myId]: playerName } : {}),
        };

        try {
          sessionStorage.setItem('danma_current_room_id', targetRoomId);
          sessionStorage.setItem(
            'danma_game_session',
            JSON.stringify({
              roomId: targetRoomId,
              userId: myId,
              role: selectedRole,
              difficulty: targetDifficulty,
              world: targetWorld,
              stage: targetStage,
              playerCharacters: mergedCharacters,
              usernamesById: targetUsernames,
            })
          );
        } catch {
          // ignore storage errors
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
          wsRef.current = null;
        }

        navigate('/game', {
          state: {
            roomId: targetRoomId,
            userId: myId,
            role: selectedRole,
            difficulty: targetDifficulty,
            world: targetWorld,
            stage: targetStage,
            playerCharacters: mergedCharacters,
            usernamesById: targetUsernames,
            token: token || getIdToken(),
          },
        });
      } else {
        setLaunchCountdown(count);
      }
    }, 1000);
  };

  const players = resolvePlayersCount(room);
  const maxPlayers = 4;
  const occupiedSlots = Math.max(0, players - 1);
  const difficultyKey = normalizeDifficulty(room?.difficulty);
  const difficultyMeta = DIFFICULTY_META[difficultyKey];
  const selectedWorld = clampLevelNum(room?.world, 1);
  const selectedStage = clampLevelNum(room?.stage, 1);
  const currentWorldName = difficultyMeta.worlds[selectedWorld - 1] || difficultyMeta.worlds[0];
  const currentStageTitle = STAGE_TITLES[selectedStage - 1] || STAGE_TITLES[0];
  const roomPlayers = Array.isArray(room?.players) ? room.players : [];
  const hostId = room?.hostId || roomPlayers[0] || null;
  const canEditSettings = hostId && currentUserId ? hostId === currentUserId : initialIsHost;
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
    if (!userId) return 'Special_Attack';
    const roomCharacters = room?.playerCharacters;
    if (roomCharacters && typeof roomCharacters === 'object') {
      return roomCharacters[userId] || 'Special_Attack';
    }
    return 'Special_Attack';
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
        playerReady: {
          ...(prev.playerReady || {}),
          [userId]: false,
        },
      };
    });
  };

  const handleToggleCharacterForPlayer = (userId, direction = 'down') => {
    if (!userId || userId !== currentUserId || !activeRoomId) return;
    const currentColor = getPlayerColor(userId);
    const takenByOthers = Object.entries(room?.playerCharacters || {})
      .filter(([pid]) => pid !== userId && roomPlayers.includes(pid))
      .map(([, r]) => r);
    const nextColor = getNextRole(currentColor, direction, takenByOthers);
    if (nextColor === currentColor) return;

    cancelLaunchCountdown();
    setPlayerColorInRoom(userId, nextColor);

    if (String(activeRoomId).startsWith('demo-')) {
      return;
    }

    // Send WebSocket notification immediately to all peers in the room
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'set-character-color',
        roomId: activeRoomId,
        color: nextColor,
      }));
    }

    // If we were ready, cancel ready on character change
    if (room?.playerReady?.[userId]) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'set-ready', roomId: activeRoomId, isReady: false }));
      }
    }

    // Use HTTP endpoint — more reliable than WS for persistent state changes
    setCharacterColor(activeRoomId, nextColor).catch(() => {
      // Revert optimistic update on failure
      setPlayerColorInRoom(userId, currentColor);
    });
  };

  const handleToggleReady = () => {
    if (!activeRoomId || !currentUserId) return;
    const currentReady = Boolean(room?.playerReady?.[currentUserId]);
    const nextReady = !currentReady;

    if (!nextReady) {
      cancelLaunchCountdown();
    }

    // Optimistic update
    setRoom((prev) => {
      const nextPlayerReady = {
        ...(prev?.playerReady || {}),
        [currentUserId]: nextReady,
      };
      return {
        ...(prev || {}),
        playerReady: nextPlayerReady,
      };
    });

    if (String(activeRoomId).startsWith('demo-')) {
      if (nextReady) {
        triggerGameLaunch({
          roomId: activeRoomId,
          playerCharacters: {
            ...(room?.playerCharacters || {}),
            [currentUserId]: getPlayerColor(currentUserId),
          },
          difficulty: room?.difficulty || 'normal',
          world: room?.world || 1,
          stage: room?.stage || 1,
        });
      }
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'set-ready',
        roomId: activeRoomId,
        isReady: nextReady,
      }));
    }

    setPlayerReady(activeRoomId, nextReady)
      .then((res) => {
        if (res?.allReady) {
          triggerGameLaunch({
            roomId: activeRoomId,
            playerCharacters: res.playerCharacters || roomRef.current?.playerCharacters,
            difficulty: res.difficulty || roomRef.current?.difficulty || 'normal',
            world: res.world ?? roomRef.current?.world ?? 1,
            stage: res.stage ?? roomRef.current?.stage ?? 1,
          });
        }
      })
      .catch(() => {
        // Revert on error
        setRoom((prev) => ({
          ...(prev || {}),
          playerReady: {
            ...(prev?.playerReady || {}),
            [currentUserId]: currentReady,
          },
        }));
      });
  };

  const leaveCurrentRoom = async (keepalive = false) => {
    const targetRoomId = activeRoomId || activeRoomIdRef.current;
    if (!targetRoomId || !token || leaveTriggeredRef.current || isGameStartingRef.current) return;
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
        await deleteRoom(targetRoomId, { keepalive });
      } else {
        await leaveRoom(targetRoomId, { keepalive });
      }
    } catch (err) {
      const message = (err?.message || '').toLowerCase();
      if (message.includes('room not found')) {
        return;
      }
      // Fallback: if role detection was stale, try the join-leave endpoint as non-host.
      if (isCurrentUserHost) {
        leaveRoom(targetRoomId, { keepalive }).catch(() => {});
      }
    }
  };

  // Current user identity is kept in memory only.
  useEffect(() => {
    if (!token) return;

    getCurrentUser()
      .then((user) => {
        if (user?.username) setPlayerName(user.username);
        const id = user?.id || user?.userId;
        if (id) {
          setCurrentUserId(id);
          setStoredUserId(id);
        }
      })
      .catch(() => {});
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
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleToggleCharacterForPlayer(currentUserId, 'up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleToggleCharacterForPlayer(currentUserId, 'down');
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
        let roomId = flowState.roomId || activeRoomIdRef.current || '';
        const roomCode = String(flowState.roomCode || '').trim().toUpperCase();
        const alreadyJoined = flowState.alreadyJoined === true;

        if (isHost) {
          if (roomId) {
            roomData = await getRoom(roomId);
          } else {
            if (!creatingRoomPromiseRef.current) {
              creatingRoomPromiseRef.current = createRoom({
                name: 'NO MERCY LOBBY',
                map: 'classic',
                maxPlayers: 4,
                isPublic: !friendsOnly,
              });
            }
            roomData = await creatingRoomPromiseRef.current;
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
        activeRoomIdRef.current = roomData.id;
        setRoom((prev) => ({
          ...roomData,
          playerCharacters: normalizePlayerCharacters(roomData, prev?.playerCharacters),
          playerReady: normalizePlayerReady(roomData, prev?.playerReady),
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
                const updatedReady = message.playerReady && typeof message.playerReady === 'object'
                  ? message.playerReady
                  : (prev?.playerReady || {});

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
                  playerReady: normalizePlayerReady(
                    {
                      players: updatedPlayers,
                      playerReady: updatedReady,
                    },
                    prev?.playerReady,
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
                const updatedReady = message.playerReady && typeof message.playerReady === 'object'
                  ? message.playerReady
                  : {
                    ...(prev.playerReady || {}),
                    [message.userId]: false,
                  };

                return {
                  ...prev,
                  playerCharacters: updatedCharacters,
                  playerReady: updatedReady,
                };
              });
            }
            if (message.type === 'room-ready-updated') {
              if (!message.allReady) {
                cancelLaunchCountdown();
              }
              setRoom((prev) => {
                if (!prev) return prev;
                const updatedReady = message.playerReady && typeof message.playerReady === 'object'
                  ? message.playerReady
                  : {
                    ...(prev.playerReady || {}),
                    [message.userId]: Boolean(message.isReady),
                  };
                return {
                  ...prev,
                  playerCharacters: message.playerCharacters || prev.playerCharacters,
                  playerReady: updatedReady,
                };
              });
            }
            if (message.type === 'room-settings-updated') {
              setRoom((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  difficulty: message.difficulty ?? prev.difficulty,
                  world: message.world ?? prev.world,
                  stage: message.stage ?? prev.stage,
                  isPublic: message.isPublic !== undefined ? message.isPublic : prev.isPublic,
                };
              });
              if (message.isPublic !== undefined) {
                setFriendsOnly(!message.isPublic);
              }
            }
            if (message.type === 'game-start') {
              triggerGameLaunch({
                roomId: message.roomId || roomData.id,
                playerCharacters: message.playerCharacters,
                difficulty: message.difficulty || roomRef.current?.difficulty || roomData.difficulty || 'normal',
                world: message.world ?? roomRef.current?.world ?? roomData.world ?? 1,
                stage: message.stage ?? roomRef.current?.stage ?? roomData.stage ?? 1,
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
                    playerReady: normalizePlayerReady(latest, prev?.playerReady),
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
              if (launchTimerRef.current) {
                clearInterval(launchTimerRef.current);
                launchTimerRef.current = null;
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
          if (roomClosedRef.current || isGameStartingRef.current) return;
          getRoom(roomData.id)
            .then((latest) => {
              if (!cancelled) {
                const normalizedChars = normalizePlayerCharacters(latest, roomRef.current?.playerCharacters);
                const normalizedRdy = normalizePlayerReady(latest, roomRef.current?.playerReady);
                setRoom((prev) => ({
                  ...latest,
                  playerCharacters: normalizedChars,
                  playerReady: normalizedRdy,
                }));
                const latestPlayers = Array.isArray(latest?.players) ? latest.players : [];
                setConnectingPlayerIds((prev) => prev.filter((id) => !latestPlayers.includes(id)));

                const everyoneReady =
                  latestPlayers.length > 0 && latestPlayers.every((pid) => normalizedRdy[pid] === true);
                if (latest?.status === 'in_game' || everyoneReady) {
                  triggerGameLaunch({
                    roomId: latest.id,
                    playerCharacters: normalizedChars,
                    difficulty: latest.difficulty || 'normal',
                    world: latest.world || 1,
                    stage: latest.stage || 1,
                  });
                }
              }
            })
            .catch(() => {});

          if (activeWs && activeWs.readyState === WebSocket.OPEN) {
            activeWs.send(JSON.stringify({ type: 'ping' }));
          }
        }, 2000);
      } catch (err) {
        console.warn('Backend unavailable, running Demo Room for UI testing:', err);
        if (!cancelled) {
          const demoRoom = {
            id: 'demo-room-01',
            name: 'NO MERCY LOBBY',
            difficulty: 'normal',
            world: 1,
            stage: 1,
            hostId: 'demo-host',
            players: ['demo-host', 'player-2'],
            playerCharacters: { 'demo-host': 'Tank', 'player-2': 'DPS' },
            playerReady: { 'demo-host': false, 'player-2': true },
            isPublic: true,
          };
          activeRoomIdRef.current = demoRoom.id;
          setRoom(demoRoom);
          setActiveRoomId(demoRoom.id);
          setLobbyCode('DEMO01');
          setCurrentUserId('demo-host');
          setPlayerName('PLAYER 1');
          setUsernamesById((prev) => ({ ...prev, 'player-2': 'ALLY BOT' }));
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
      if (launchTimerRef.current) {
        clearInterval(launchTimerRef.current);
        launchTimerRef.current = null;
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
    if (canEditSettings) setIsSettingsOpen((prev) => !prev);
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
    if (!room || !canEditSettings) return;
    const newValue = !friendsOnly;
    setFriendsOnly(newValue);
    if (String(room.id).startsWith('demo-')) {
      setRoom((prev) => ({ ...(prev || {}), isPublic: !newValue }));
      return;
    }
    try {
      const updated = await updateRoom(room.id, { isPublic: !newValue });
      setRoom((prev) => ({
        ...(prev || {}),
        ...updated,
        playerCharacters: normalizePlayerCharacters(updated, prev?.playerCharacters),
        playerReady: normalizePlayerReady(updated, prev?.playerReady),
      }));
    } catch (err) {
      console.error('Failed to update room:', err);
      setFriendsOnly(!newValue); // revert on error
    }
  };

  const handleDifficultyChange = async (difficulty) => {
    if (!room || !canEditSettings || !difficulty) return;
    const prevDifficulty = room.difficulty;
    setRoom((prev) => ({ ...(prev || {}), difficulty }));
    if (String(room.id).startsWith('demo-')) return;
    try {
      const updated = await updateRoom(room.id, { difficulty });
      setRoom((prev) => ({
        ...(prev || {}),
        ...updated,
        playerCharacters: normalizePlayerCharacters(updated, prev?.playerCharacters),
        playerReady: normalizePlayerReady(updated, prev?.playerReady),
      }));
    } catch (err) {
      console.error('Failed to update difficulty:', err);
      setRoom((prev) => ({ ...(prev || {}), difficulty: prevDifficulty }));
    }
  };

  const handleLevelChange = async (world, stage) => {
    if (!room || !canEditSettings) return;
    const nextWorld = clampLevelNum(world, 1);
    const nextStage = clampLevelNum(stage, 1);
    const prevWorld = room.world || 1;
    const prevStage = room.stage || 1;
    setRoom((prev) => ({ ...(prev || {}), world: nextWorld, stage: nextStage }));
    if (String(room.id).startsWith('demo-')) return;
    try {
      const updated = await updateRoom(room.id, { world: nextWorld, stage: nextStage });
      setRoom((prev) => ({
        ...(prev || {}),
        ...updated,
        playerCharacters: normalizePlayerCharacters(updated, prev?.playerCharacters),
        playerReady: normalizePlayerReady(updated, prev?.playerReady),
      }));
    } catch (err) {
      console.error('Failed to update level:', err);
      setRoom((prev) => ({ ...(prev || {}), world: prevWorld, stage: prevStage }));
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

        <button
          type="button"
          className={`cs-level-box ${difficultyMeta.className} ${canEditSettings ? 'clickable' : ''}`}
          onClick={canEditSettings ? toggleSettings : undefined}
          title={canEditSettings ? 'Haz clic para elegir dificultad y nivel' : `${difficultyMeta.label} · Nivel ${selectedWorld}-${selectedStage}`}
        >
          <span className={`cs-level-marker ${difficultyMeta.className}`}></span>
          <div className="cs-level-box-text">
            <span className="cs-level-label">
              {difficultyMeta.label} · LVL {selectedWorld}-{selectedStage}
              {canEditSettings ? ' ▾' : ''}
            </span>
            <span className="cs-level-sublabel">
              {currentWorldName} — {currentStageTitle}
            </span>
          </div>
        </button>

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
            disabled={!canEditSettings}
            title={canEditSettings ? 'Elegir Dificultad y Nivel' : 'Solo el host puede cambiar la configuración'}
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
        {(() => {
          const isHostReady = Boolean(hostId && room?.playerReady?.[hostId]);
          return (
            <div className={`cs-slot ${isHostReady ? 'is-ready' : ''}`}>
              <div className="cs-slot-header">
                <div>
                  {hostId
                    ? `${resolveDisplayName(hostId, 'HOST')} (HOST)`
                    : 'HOST'}
                  {hostId && (
                    <div>
                      <span className={`cs-slot-ready-tag ${isHostReady ? 'ready' : 'not-ready'}`}>
                        {isHostReady ? 'READY' : 'NOT READY'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="cs-slot-body">
                <div
                  className="cs-select-arrow up"
                  onClick={hostId === currentUserId ? () => handleToggleCharacterForPlayer(hostId, 'up') : undefined}
                  style={hostId === currentUserId ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
                ></div>
                <div className="cs-character-display">
                  <div className={`cs-character-box ${getPlayerColor(hostId)}`}>
                    {getPlayerColor(hostId) === 'Special_Attack' ? 'SP.ATK' : getPlayerColor(hostId).toUpperCase()}
                  </div>
                </div>
                <div
                  className="cs-select-arrow down"
                  onClick={hostId === currentUserId ? () => handleToggleCharacterForPlayer(hostId, 'down') : undefined}
                  style={hostId === currentUserId ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
                ></div>
              </div>
              <div className="cs-slot-footer">
                <div className="cs-equip-box"></div>
                <div className="cs-equip-box"></div>
                <div className="cs-equip-box"></div>
              </div>
            </div>
          );
        })()}

        {/* OTHER SLOTS (joiners fill left to right) */}
        {joinerSlots.map((joinerId, index) => {
          const isConnecting = Boolean(joinerId) && connectingJoinerIds.includes(joinerId);
          const isJoinerReady = Boolean(joinerId && room?.playerReady?.[joinerId]);
          return (
          <div className={`cs-slot ${isJoinerReady ? 'is-ready' : ''}`} key={index}>
            <div className="cs-slot-header">
              <div>
                {isConnecting
                  ? 'Connecting...'
                  : (joinerId
                    ? (joinerId === currentUserId
                      ? `${resolveDisplayName(joinerId)} (YOU)`
                      : resolveDisplayName(joinerId, `PLAYER ${index + 2}`))
                    : 'WAITING...')}
                {joinerId && !isConnecting && (
                  <div>
                    <span className={`cs-slot-ready-tag ${isJoinerReady ? 'ready' : 'not-ready'}`}>
                      {isJoinerReady ? 'READY' : 'NOT READY'}
                    </span>
                  </div>
                )}
              </div>
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
                  onClick={joinerId === currentUserId ? () => handleToggleCharacterForPlayer(joinerId, 'up') : undefined}
                  style={joinerId === currentUserId ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
                ></div>
                <div className="cs-character-display">
                  <div className={`cs-character-box ${getPlayerColor(joinerId)}`}>
                    {getPlayerColor(joinerId) === 'Special_Attack' ? 'SP.ATK' : getPlayerColor(joinerId).toUpperCase()}
                  </div>
                </div>
                <div
                  className="cs-select-arrow down"
                  onClick={joinerId === currentUserId ? () => handleToggleCharacterForPlayer(joinerId, 'down') : undefined}
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

      {/* BOTTOM ACTION BAR / READY BUTTON */}
      <div className="cs-bottom-bar">
        <button
          className={`cs-main-ready-btn ${Boolean(room?.playerReady?.[currentUserId]) ? 'active' : ''}`}
          onClick={handleToggleReady}
          disabled={!activeRoomId || !currentUserId}
        >
          {Boolean(room?.playerReady?.[currentUserId]) ? '✓ READY (CANCEL)' : 'READY UP'}
        </button>
        <div className="cs-ready-status-text">
          {roomPlayers.filter((id) => Boolean(room?.playerReady?.[id])).length}/{Math.max(1, roomPlayers.length)} JUGADORES LISTOS
        </div>
      </div>

      {/* LAUNCH COUNTDOWN OVERLAY */}
      {launchCountdown !== null && (
        <div className="cs-launch-overlay">
          <div className="cs-launch-card">
            <div className="cs-launch-title">¡TODOS LOS JUGADORES LISTOS!</div>
            <div className="cs-launch-countdown">{launchCountdown}</div>
            <div style={{ color: '#00f0ff', fontSize: '0.78rem', marginTop: '0.9rem', letterSpacing: '0.08em' }}>
              {difficultyMeta.label} · NIVEL {selectedWorld}-{selectedStage} ({currentWorldName})
            </div>
            <div style={{ color: '#aaa', fontSize: '0.72rem', marginTop: '0.5rem', letterSpacing: '0.08em' }}>
              CARGANDO ARENA DE COMBATE...
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && <div className="cs-settings-overlay" onClick={toggleSettings}></div>}

      {/* SETTINGS SIDEBAR (Toggled by Top Difficulty Banner or Gear Icon) */}
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
          <div className="cs-settings-label">1. DIFFICULTY</div>
          <div className="cs-settings-diff-grid">
            {Object.entries(DIFFICULTY_META).map(([value, meta]) => (
              <button
                key={value}
                className={`cs-settings-btn cs-diff-btn ${meta.className} ${difficultyKey === value ? 'active' : ''}`}
                onClick={() => handleDifficultyChange(value)}
                disabled={!canEditSettings}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cs-settings-column">
          <div className="cs-settings-label-row">
            <span className="cs-settings-label">2. SELECT LEVEL ({difficultyMeta.label})</span>
            <span className="cs-test-level-pill">TEST ARENA</span>
          </div>
          <div className="cs-level-matrix">
            {[1, 2, 3].map((w) => (
              <div key={w} className="cs-world-row">
                <div className="cs-world-row-title">
                  W{w} · {difficultyMeta.worlds[w - 1]}
                </div>
                <div className="cs-stage-cells">
                  {[1, 2, 3].map((s) => {
                    const isSelected = selectedWorld === w && selectedStage === s;
                    return (
                      <button
                        key={`${w}-${s}`}
                        type="button"
                        className={`cs-stage-cell-btn ${difficultyMeta.className} ${isSelected ? 'active' : ''}`}
                        onClick={() => handleLevelChange(w, s)}
                        disabled={!canEditSettings}
                        title={`Mundo ${w} - Nivel ${s}: ${difficultyMeta.worlds[w - 1]} (${STAGE_TITLES[s - 1]})`}
                      >
                        <span className="cs-stage-code">{w}-{s}</span>
                        <span className="cs-stage-sub">STG {s}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cs-settings-row">
          <button className="cs-settings-btn">FRIENDS ONLY</button>
          <button 
            className={`cs-settings-btn ${friendsOnly ? 'active' : ''}`} 
            onClick={handleToggleFriendsOnly}
            disabled={!canEditSettings}
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