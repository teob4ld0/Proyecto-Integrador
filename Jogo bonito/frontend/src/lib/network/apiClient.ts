export interface RoomData {
  id: string;
  name: string;
  hostId: string;
  map: string;
  maxPlayers: number;
  players: string[];
  playersCount: number;
  hasPassword: boolean;
  isPublic: boolean;
  createdAt: string;
  difficulty: 'normal' | 'difficult' | 'no_mercy' | string;
  playerCharacters?: Record<string, string>;
}

export interface UserData {
  id: string;
  username: string;
  email: string;
}

export function getBaseApiUrl(): string {
  // 1. Variable de entorno si existe
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // 2. Detección dinámica de host (funciona en red local, IP, ngrok o localhost)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${hostname}:8080`;
  }
  return 'http://localhost:8080';
}

export class APIClient {
  private static tokenKey = 'danmakrew_auth_token';

  public static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.tokenKey) || sessionStorage.getItem(this.tokenKey);
  }

  public static setToken(token: string, persistent = true): void {
    if (typeof window === 'undefined') return;
    if (persistent) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      sessionStorage.setItem(this.tokenKey, token);
    }
  }

  public static clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.tokenKey);
  }

  private static async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const baseUrl = getBaseApiUrl();
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || `Error HTTP ${res.status}`);
    }

    return data as T;
  }

  // Auth Endpoints
  public static async login(email: string, password: string): Promise<{ token: string; username: string; userId: string }> {
    const res = await this.request<{ token: string; username: string; userId: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  public static async register(username: string, email: string, password: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  public static async getMe(): Promise<UserData> {
    return this.request<UserData>('/api/auth/me');
  }

  // Rooms Endpoints
  public static async listRooms(): Promise<RoomData[]> {
    return this.request<RoomData[]>('/api/rooms');
  }

  public static async getRoom(roomId: string): Promise<RoomData> {
    return this.request<RoomData>(`/api/rooms/${roomId}`);
  }

  public static async getRoomByCode(code: string): Promise<RoomData> {
    return this.request<RoomData>(`/api/rooms/by-code/${code}`);
  }

  public static async createRoom(params: {
    name: string;
    difficulty?: 'normal' | 'difficult' | 'no_mercy';
    maxPlayers?: number;
    password?: string;
    isPublic?: boolean;
  }): Promise<RoomData> {
    return this.request<RoomData>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  public static async joinRoom(roomId: string, password?: string): Promise<{ room: RoomData }> {
    return this.request<{ room: RoomData }>(`/api/rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  public static async leaveRoom(roomId: string): Promise<{ room: RoomData }> {
    return this.request<{ room: RoomData }>(`/api/rooms/${roomId}/join`, {
      method: 'DELETE',
    });
  }

  public static async deleteRoom(roomId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/rooms/${roomId}`, {
      method: 'DELETE',
    });
  }
}
