const API_BASE = '/api';

export async function registerUser({ username, email, password }) {
  const res = await fetch(`${API_BASE}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_BASE}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
