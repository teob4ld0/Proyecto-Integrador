let apiEnv = import.meta.env.VITE_API_URL;
if (apiEnv && apiEnv.endsWith('/')) apiEnv = apiEnv.slice(0, -1);
const API_BASE = apiEnv 
  ? (apiEnv.endsWith('/api') ? apiEnv : `${apiEnv}/api`)
  : '/api';

const HEADERS_JSON = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

function authHeaders() {
  const token = localStorage.getItem('danma_token');
  const headers = { ...HEADERS_JSON };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handleResponse(res) {
  const data = await res.text();
  if (!res.ok) {
    let message;
    try {
      const json = JSON.parse(data);
      message = json.message || json.title || data;
    } catch {
      message = data;
    }
    throw new Error(message);
  }
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

// ==========================================
// AUTH API
// ==========================================

export async function registerUser({ username, email, password }) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: HEADERS_JSON,
    body: JSON.stringify({ username, email, password }),
  });
  return handleResponse(res);
}

export async function loginUser({ email, password }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: HEADERS_JSON,
    body: JSON.stringify({ email, password }),
  });
  const data = await handleResponse(res);
  // Guardar username y userId en localStorage
  if (data.username) localStorage.setItem('danma_username', data.username);
  if (data.userId) localStorage.setItem('danma_userId', data.userId);
  return data;
}

export async function getCurrentUser() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function verifyEmail({ userId, token, email }) {
  const res = await fetch(
    `${API_BASE}/auth/verify-email?userId=${userId}&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`,
    {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    }
  );
  return handleResponse(res);
}

export function logout() {
  localStorage.removeItem('danma_token');
  localStorage.removeItem('danma_username');
  localStorage.removeItem('danma_userId');
}

// ==========================================
// ROOMS API
// ==========================================

export async function getPublicRooms() {
  const res = await fetch(`${API_BASE}/rooms`, {
    headers: { 'ngrok-skip-browser-warning': 'true' }
  });
  
  const data = await res.text();
  if (!res.ok) {
    throw new Error('Failed to fetch rooms');
  }
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function createRoom({
  name = 'NO MERCY LOBBY',
  map = 'classic',
  maxPlayers = 4,
  password,
  isPublic = true,
} = {}) {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, map, maxPlayers, password, isPublic }),
  });
  return handleResponse(res);
}

export async function getRoom(roomId) {
  const res = await fetch(`${API_BASE}/rooms/${roomId}`, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  return handleResponse(res);
}

export async function updateRoom(roomId, settings) {
  const res = await fetch(`${API_BASE}/rooms/${roomId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(settings),
  });
  return handleResponse(res);
}

export async function getRoomByCode(code) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  const res = await fetch(`${API_BASE}/rooms/by-code/${encodeURIComponent(normalizedCode)}`, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  return handleResponse(res);
}

export async function joinRoom(roomId, password = '') {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/join`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ password })
  });
  return handleResponse(res);
}

export async function joinRoomByCode(code, password = '') {
  const room = await getRoomByCode(code);
  await joinRoom(room.id, password);
  return room;
}
