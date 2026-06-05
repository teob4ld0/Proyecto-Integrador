let apiEnv = import.meta.env.VITE_API_URL;
if (apiEnv && apiEnv.endsWith('/')) apiEnv = apiEnv.slice(0, -1);
const API_BASE = apiEnv 
  ? (apiEnv.endsWith('/api') ? apiEnv : `${apiEnv}/api`)
  : '/api';

export async function registerUser({ username, email, password }) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({ username, email, password }),
  });

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

export async function loginUser({ email, password }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({ email, password }),
  });

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

export async function verifyEmail({ userId, token, email }) {
  const res = await fetch(
    `${API_BASE}/auth/verify-email?userId=${userId}&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`,
    {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    }
  );

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

export function logout() {
  localStorage.removeItem('danma_token');
}

// ==========================================
// ROOMS API
// ==========================================

export async function getPublicRooms() {
  const res = await fetch(`${API_BASE}/rooms`, {
    headers: {
      'ngrok-skip-browser-warning': 'true'
    }
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

export async function joinRoom(roomId, password = '') {
  const token = localStorage.getItem('danma_token');
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/rooms/${roomId}/join`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ password })
  });

  const data = await res.text();

  if (!res.ok) {
    let message;
    try {
      const json = JSON.parse(data);
      message = json.message || data;
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
