export interface ServerPlayer {
  id: string;
  x: number;
  y: number;
  angle?: number;
  isReady?: boolean;
  character?: string | null;
  characterColor?: string;
  hp?: number;
  maxHp?: number;
  sp?: number;
  maxSp?: number;
  defensePercent?: number;
  focus?: boolean;
}

export interface ServerBullet {
  id: string | number;
  x: number;
  y: number;
  radius: number;
  ownerId?: string;
  type?: 'normal' | 'laser';
  vx?: number;
  vy?: number;
  color?: string | number;
}

export interface ServerLaser {
  id: string;
  ownerId?: string;
  direction?: 'left' | 'right';
  sourceX: number;
  sourceY: number;
  targetY: number;
  state: 'charging' | 'firing' | 'fading';
  timer: number;
  chargeDuration: number;
  fireDuration: number;
  fadeDuration: number;
  maxWidth: number;
  color: number;
}

export interface ServerBoss {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  phase?: number;
  remainingStocks?: number;
  spellcardName?: string;
  spellcard?: string;
  isSpellCard?: boolean;
  isActive?: boolean;
  isDefeated?: boolean;
  isRefilling?: boolean;
  isLockedForBeam?: boolean;
}

export interface ServerEnemy {
  id: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
}

export interface ServerItem {
  id: string;
  x: number;
  y: number;
  type: 'power' | 'point' | 'bomb_frag' | 'life_frag' | string;
}

export interface ServerCampaign {
  difficulty: string;
  difficultyLabel: string;
  world: number;
  stage: number;
  stageState: string;
  campaignComplete: boolean;
  bannerText: string;
  bannerSubtext: string;
  clearTitle: string;
  clearSubtext: string;
  worldName?: string;
  stageTitle?: string;
}

export interface ServerBeamStruggle {
  active: boolean;
  isAligning?: boolean;
  winner?: 'player' | 'boss' | null;
  timer: number;
  maxTimer: number;
  balance: number;
  resolutionTimer?: number;
  clashX: number;
  clashY: number;
  playerTipX?: number;
  bossTipX?: number;
  vortexX?: number;
  vortexY?: number;
}

export interface GameSnapshot {
  type: 'snapshot';
  tick: number;
  timestamp?: number;
  phase?: string;
  countdownMs?: number;
  stageTime?: number;
  players: ServerPlayer[];
  bullets: ServerBullet[];
  lasers?: ServerLaser[];
  walls?: any[];
  enemies?: ServerEnemy[];
  items?: ServerItem[];
  boss?: ServerBoss;
  campaign?: ServerCampaign;
  struggle?: ServerBeamStruggle;
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
  private inputSequence = 0;
  private connectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(private token: string, private defaultPort: number = 9001) {}

  public connect(
    roomId: string,
    onJoined: (playerId: string, initialState: GameSnapshot) => void,
    onSnapshot: (snapshot: GameSnapshot) => void
  ): Promise<void> {
    this.onJoinedCallback = onJoined;
    this.onSnapshotCallback = onSnapshot;

    return new Promise((resolve, reject) => {
      if (!roomId) {
        reject(new Error('roomId invalido para iniciar la partida'));
        return;
      }

      let settled = false;
      const failConnect = (reason: unknown) => {
        if (settled) return;
        settled = true;
        if (this.connectTimeoutId) {
          clearTimeout(this.connectTimeoutId);
          this.connectTimeoutId = null;
        }
        reject(reason instanceof Error ? reason : new Error(String(reason ?? 'Error de conexion')));
      };
      const finishConnect = () => {
        if (settled) return;
        settled = true;
        if (this.connectTimeoutId) {
          clearTimeout(this.connectTimeoutId);
          this.connectTimeoutId = null;
        }
        resolve();
      };

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
      this.connectTimeoutId = setTimeout(() => {
        failConnect(new Error('Timeout esperando confirmacion del servidor de juego'));
      }, 8000);

      this.socket.onopen = () => {
        console.log('[GameWS] Conectado al servidor de juego en:', url);
        this.inputSequence = 0;
        this.send({ type: 'join-game', roomId });
      };

      this.socket.onerror = (err) => {
        console.error('[GameWS] Error de conexión:', err);
        failConnect(new Error('No se pudo abrir el WebSocket del juego'));
      };

      this.socket.onclose = () => {
        console.log('[GameWS] Conexión de juego cerrada');
        if (!settled) {
          failConnect(new Error('Conexion cerrada antes de completar el join de la sala'));
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const msg: GameServerMessage = JSON.parse(event.data);
          if (msg.type === 'joined') {
            this.myPlayerId = msg.playerId;
            if (this.onJoinedCallback) {
              this.onJoinedCallback(msg.playerId, msg.initialState);
            }
            finishConnect();
          } else if (msg.type === 'snapshot') {
            if (this.onSnapshotCallback) {
              this.onSnapshotCallback(msg);
            }
          } else if (msg.type === 'error') {
            const reason = msg.message || 'El servidor rechazo la conexion de juego';
            console.error('[GameWS] Error del servidor:', reason);
            failConnect(new Error(reason));
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
          action: action ?? null,
          seq: this.inputSequence++,
          clientTs: Date.now(),
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
