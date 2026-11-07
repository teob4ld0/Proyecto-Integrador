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
  type?: 'normal' | 'laser' | 'autoaim' | string;
  vx?: number;
  vy?: number;
  color?: string | number;
}

export interface ServerWall {
  id: string;
  ownerId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  ttl?: number;
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
  isMegaBeam?: boolean;
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
  walls?: ServerWall[];
  enemies?: ServerEnemy[];
  items?: ServerItem[];
  boss?: ServerBoss;
  campaign?: ServerCampaign;
  struggle?: ServerBeamStruggle;
}

export type GameServerMessage =
  | { type: 'joined'; playerId: string; isHost?: boolean; initialState: GameSnapshot }
  | GameSnapshot
  | { type: 'phase'; phase: string; countdownMs?: number }
  | { type: 'ready-status'; phase: string; players: Array<{ id: string; isReady: boolean }> }
  | { type: 'player-joined'; playerId: string }
  | { type: 'player-disconnected'; playerId: string }
  | { type: 'player-left'; playerId: string }
  | { type: 'hit'; playerId: string; bulletId?: string; damage?: number }
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
    onSnapshot: (snapshot: GameSnapshot) => void,
    character?: string,
    options?: { difficulty?: string; world?: number; stage?: number }
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
      }, 4500);

      this.socket.onopen = () => {
        this.inputSequence = 0;
        this.send({
          type: 'join-game',
          roomId,
          character,
          difficulty: options?.difficulty,
          world: options?.world,
          stage: options?.stage,
        });
      };

      this.socket.onerror = () => {
        failConnect(new Error('No se pudo abrir el WebSocket del juego'));
      };

      this.socket.onclose = () => {
        if (!settled) {
          failConnect(new Error('Conexion cerrada antes de completar el join de la sala'));
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const msg: GameServerMessage = JSON.parse(event.data);
          if (msg.type === 'joined') {
            this.myPlayerId = msg.playerId;
            // Notify authoritative server that client assets/canvas are ready immediately
            this.send({ type: 'ready' });
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
            failConnect(new Error(reason));
          }
        } catch {
          // Ignore malformed packet
        }
      };
    });
  }

  public sendInput(dx: number, dy: number, action: string | null = null, focus: boolean = false): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const clampedDx = Math.max(-1, Math.min(1, dx));
      const clampedDy = Math.max(-1, Math.min(1, dy));
      this.socket.send(
        JSON.stringify({
          type: 'input',
          dx: clampedDx,
          dy: clampedDy,
          action: action ?? null,
          focus: Boolean(focus),
          seq: this.inputSequence++,
          clientTs: Date.now(),
        })
      );
    }
  }

  public sendAdvanceStage(): void {
    this.send({ type: 'advance-stage' });
  }

  public sendRestartStage(): void {
    this.send({ type: 'restart-stage' });
  }

  public sendSpawnBoss(): void {
    this.send({ type: 'spawn-boss' });
  }

  public sendStartStruggle(): void {
    this.send({ type: 'start-struggle' });
  }

  private send(payload: unknown): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  public getPlayerId(): string {
    return this.myPlayerId;
  }

  public disconnect(): void {
    if (this.connectTimeoutId) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

