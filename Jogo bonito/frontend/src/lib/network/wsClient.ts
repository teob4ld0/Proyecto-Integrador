export interface ServerPlayer {
  id: string;
  x: number;
  y: number;
  angle: number;
  characterColor?: string;
}

export interface ServerBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color?: string | number;
}

export interface GameSnapshot {
  type: 'snapshot';
  tick: number;
  players: ServerPlayer[];
  bullets: ServerBullet[];
}

export type GameServerMessage =
  | { type: 'joined'; playerId: string; initialState: GameSnapshot }
  | GameSnapshot
  | { type: 'player-disconnected'; playerId: string }
  | { type: 'player-left'; playerId: string }
  | { type: 'error'; message: string };

export class GameWSClient {
  private socket: WebSocket | null = null;
  private onSnapshotCallback: ((snapshot: GameSnapshot) => void) | null = null;
  private onJoinedCallback: ((playerId: string, initialState: GameSnapshot) => void) | null = null;
  private myPlayerId: string = '';

  constructor(private token: string, private defaultPort: number = 9001) {}

  public connect(
    roomId: string,
    onJoined: (playerId: string, initialState: GameSnapshot) => void,
    onSnapshot: (snapshot: GameSnapshot) => void
  ): Promise<void> {
    this.onJoinedCallback = onJoined;
    this.onSnapshotCallback = onSnapshot;

    return new Promise((resolve, reject) => {
      let url = '';
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL) {
        url = `${import.meta.env.VITE_WS_URL}/game?token=${encodeURIComponent(this.token)}`;
      } else if (typeof window !== 'undefined') {
        const hostname = window.location.hostname || 'localhost';
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        url = `${protocol}//${hostname}:${this.defaultPort}/game?token=${encodeURIComponent(this.token)}`;
      } else {
        url = `ws://localhost:${this.defaultPort}/game?token=${encodeURIComponent(this.token)}`;
      }

      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('[GameWS] Conectado al servidor de juego en:', url);
        this.send({ type: 'join-game', roomId });
        resolve();
      };

      this.socket.onerror = (err) => {
        console.error('[GameWS] Error de conexión:', err);
        reject(err);
      };

      this.socket.onclose = () => {
        console.log('[GameWS] Conexión de juego cerrada');
      };

      this.socket.onmessage = (event) => {
        try {
          const msg: GameServerMessage = JSON.parse(event.data);
          if (msg.type === 'joined') {
            this.myPlayerId = msg.playerId;
            if (this.onJoinedCallback) {
              this.onJoinedCallback(msg.playerId, msg.initialState);
            }
          } else if (msg.type === 'snapshot') {
            if (this.onSnapshotCallback) {
              this.onSnapshotCallback(msg);
            }
          }
        } catch (e) {
          console.error('[GameWS] Error leyendo snapshot del juego:', e);
        }
      };
    });
  }

  public sendInput(dx: number, dy: number, action: string | null = null): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const clampedDx = Math.max(-1, Math.min(1, dx));
      const clampedDy = Math.max(-1, Math.min(1, dy));
      this.socket.send(
        JSON.stringify({
          type: 'input',
          dx: clampedDx,
          dy: clampedDy,
          action: action === null ? null : undefined,
        })
      );
    }
  }

  private send(payload: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  public getPlayerId(): string {
    return this.myPlayerId;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
