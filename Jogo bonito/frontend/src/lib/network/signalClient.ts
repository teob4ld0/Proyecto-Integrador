export interface CharacterClass {
  id: string;
  name: string;
  role: string;
  color: string; // Backend color string ('red' | 'blue' | 'green' | 'yellow')
  spriteUrl: string;
  description: string;
  stats: { attack: number; defense: number; speed: number; support: number };
}

export const CHARACTER_CLASSES: CharacterClass[] = [
  {
    id: 'attack',
    name: 'Ataque Mágico',
    role: 'Daño a Distancia',
    color: 'red',
    spriteUrl: '/assets/sprites/specialattack.png',
    description: 'Especialista en ráfagas mágicas de alto impacto a gran distancia.',
    stats: { attack: 95, defense: 40, speed: 75, support: 30 },
  },
  {
    id: 'defense',
    name: 'Defensa',
    role: 'Tanque / Escudo',
    color: 'blue',
    spriteUrl: '/assets/sprites/defence.png',
    description: 'Resistente con escudos protectores para absorber patrones de proyectiles.',
    stats: { attack: 45, defense: 95, speed: 50, support: 60 },
  },
  {
    id: 'healer',
    name: 'Curandero',
    role: 'Soporte / Sanación',
    color: 'green',
    spriteUrl: '/assets/sprites/healer.png',
    description: 'Soporte vital que regenera escudos y mantiene vivo al equipo.',
    stats: { attack: 30, defense: 60, speed: 70, support: 100 },
  },
  {
    id: 'physical',
    name: 'Ataque Físico',
    role: 'DPS Cuerpo a Cuerpo / Corto Alcance',
    color: 'yellow',
    spriteUrl: '/assets/sprites/physicalattack.png',
    description: 'Ataques veloces y contundentes a corta distancia con alta velocidad.',
    stats: { attack: 85, defense: 55, speed: 95, support: 20 },
  },
];

export type SignalMessage =
  | { type: 'room-hosted'; roomId: string }
  | { type: 'room-joined'; roomId: string; playerCharacters: Record<string, string> }
  | { type: 'room-updated'; players: string[]; playersCount: number; playerCharacters: Record<string, string> }
  | { type: 'room-character-updated'; userId: string; color: string; playerCharacters: Record<string, string> }
  | { type: 'player-join-request'; userId: string }
  | { type: 'host-disconnected'; message: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };

export class SignalWSClient {
  private ws: WebSocket | null = null;
  private pingInterval: any = null;
  private messageListeners: ((msg: SignalMessage) => void)[] = [];

  constructor(private token: string, private defaultPort: number = 9001) {}

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let url = '';
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL) {
        url = `${import.meta.env.VITE_WS_URL}/signal?token=${encodeURIComponent(this.token)}`;
      } else if (typeof window !== 'undefined') {
        const hostname = window.location.hostname || 'localhost';
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        url = `${protocol}//${hostname}:${this.defaultPort}/signal?token=${encodeURIComponent(this.token)}`;
      } else {
        url = `ws://localhost:${this.defaultPort}/signal?token=${encodeURIComponent(this.token)}`;
      }

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[SignalWS] Conectado exitosamente a:', url);
        this.startHeartbeat();
        resolve();
      };

      this.ws.onerror = (err) => {
        console.error('[SignalWS] Error de conexión:', err);
        reject(err);
      };

      this.ws.onclose = () => {
        console.log('[SignalWS] Conexión cerrada');
        this.stopHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: SignalMessage = JSON.parse(event.data);
          this.notifyListeners(msg);
        } catch (e) {
          console.error('[SignalWS] Error parseando mensaje JSON:', e);
        }
      };
    });
  }

  public hostRoom(roomId: string): void {
    this.send({ type: 'host-room', roomId });
  }

  public joinRoom(roomId: string): void {
    this.send({ type: 'join-room', roomId });
  }

  public setCharacter(color: string, roomId: string): void {
    this.send({ type: 'set-character-color', color, roomId });
  }

  public onMessage(callback: (msg: SignalMessage) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== callback);
    };
  }

  private send(payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private notifyListeners(msg: SignalMessage): void {
    for (const listener of this.messageListeners) {
      listener(msg);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
