import { GameEngine } from '../engine/GameEngine';
import { GameWSClient, type GameSnapshot, type ServerPlayer } from '../network/wsClient';
import { GameWorkerBridge } from './GameWorkerBridge';
import { normalizeRole } from './squadState';

export type PlayerRole = 'Tank' | 'Support' | 'DPS' | 'Special_Attack';
export type Difficulty = 'normal' | 'difficult' | 'no_mercy';
export type WorkerRuntimeMode = 'connecting' | 'backend-worker' | 'local-worker';

export type SessionQuery = {
  roomId: string;
  classId: string;
  token: string;
  difficulty: Difficulty;
  world: number;
  stage: number;
  testMode: string | null;
};

export type RuntimeFrameInput = {
  touchDx: number;
  touchDy: number;
  touchFiring: boolean;
  touchFocus: boolean;
};

export type RuntimeSessionOptions = {
  mountContainer: HTMLElement;
  roomId: string;
  userId?: string;
  classId: string;
  token: string;
  difficulty?: Difficulty;
  world?: number;
  stage?: number;
  testMode?: string | null;
  initialRoster?: Record<string, string>;
  getSelectedRole: () => PlayerRole;
  setSelectedRole: (role: PlayerRole) => void;
  getFrameInput: () => RuntimeFrameInput;
  onTouchDeviceChange: (isTouchDevice: boolean) => void;
  onFirstTouch: () => void;
  onOrientationChange: () => void;
  onFullscreenChange: () => void;
  onToggleFullscreen: () => void;
  onEngineFrame: (engine: GameEngine) => void;
  onPlayersSnapshot?: (players: ServerPlayer[], myPlayerId: string) => void;
  onWorkerModeChange?: (mode: WorkerRuntimeMode, statusMessage: string) => void;
};

const UUID_REGEX = /^[0-9a-f-]{36}$/i;

export function toDifficulty(value: string | null | undefined, fallback: Difficulty = 'normal'): Difficulty {
  if (value === 'difficult' || value === 'no_mercy' || value === 'normal') return value;
  return fallback;
}

export function clampLevelPart(value: unknown, fallback: number = 1): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.min(3, Math.floor(num)));
}

export function readSessionQuery(search: string, defaultDifficulty: Difficulty = 'normal'): SessionQuery {
  const searchParams = new URLSearchParams(search);
  const storedToken =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('danma_idtoken') ||
        localStorage.getItem('danma_token') ||
        localStorage.getItem('danma_session_token') ||
        ''
      : '';
  return {
    roomId: searchParams.get('roomId') || searchParams.get('room') || '',
    classId: searchParams.get('class') || searchParams.get('character') || 'DPS',
    token: searchParams.get('token') || storedToken,
    difficulty: toDifficulty(searchParams.get('difficulty'), defaultDifficulty),
    world: clampLevelPart(searchParams.get('world'), 1),
    stage: clampLevelPart(searchParams.get('stage'), 1),
    testMode: searchParams.get('test'),
  };
}

export class GameRuntimeSession {
  public readonly engine: GameEngine;
  private gameClient: GameWSClient | null = null;
  private workerBridge: GameWorkerBridge | null = null;
  private snapshotWorker: Worker | null = null;
  private readonly keys: Record<string, boolean> = {};
  private readonly options: RuntimeSessionOptions;
  private runtimeMode: WorkerRuntimeMode = 'connecting';
  private myPlayerId = '';
  private animFrameId = 0;
  private lastTime = performance.now();
  private stopped = false;

  private readonly onFirstTouch = () => {
    this.options.onTouchDeviceChange(true);
    this.options.onOrientationChange();
    this.options.onFirstTouch();
    window.removeEventListener('touchstart', this.onFirstTouch);
  };

  private readonly onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
    this.keys[e.key] = true;
    if (e.shiftKey || e.key === 'Shift') {
      this.keys.Shift = true;
      this.keys.ShiftLeft = true;
      this.keys.ShiftRight = true;
    }

    if ((e.code === 'KeyZ' || e.code === 'Space') && !e.repeat && this.engine.isBeamStruggle) {
      this.pushStruggle();
    }

    if (this.runtimeMode === 'local-worker') {
      if (e.code === 'Digit1') this.selectRole('DPS');
      if (e.code === 'Digit2') this.selectRole('Tank');
      if (e.code === 'Digit3') this.selectRole('Support');
      if (e.code === 'Digit4') this.selectRole('Special_Attack');
    }

    if (e.code === 'KeyT' && !e.repeat) this.startBeamStruggleTest();
    if (e.code === 'KeyB' && !e.repeat) this.spawnBossNow();
    if (e.code === 'KeyX' && !e.repeat) this.triggerSkill();
    if (e.code === 'KeyF' && !e.repeat) this.options.onToggleFullscreen();
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
    this.keys[e.key] = false;
    if (!e.shiftKey && e.key === 'Shift') {
      this.keys.Shift = false;
      this.keys.ShiftLeft = false;
      this.keys.ShiftRight = false;
    }
  };

  constructor(options: RuntimeSessionOptions) {
    this.options = options;
    while (options.mountContainer.firstChild) {
      options.mountContainer.removeChild(options.mountContainer.firstChild);
    }
    const canvas = document.createElement('canvas');
    options.mountContainer.appendChild(canvas);
    this.engine = new GameEngine(canvas, 1024, 576, { difficulty: options.difficulty });
    this.engine.setCharacterClass(normalizeRole(options.classId));
  }

  public start(): void {
    this.stopped = false;
    const isCoarse = window.matchMedia('(pointer: coarse) and (hover: none)').matches;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.options.onTouchDeviceChange(isCoarse && hasTouch);
    this.options.onOrientationChange();

    window.addEventListener('touchstart', this.onFirstTouch, { once: true, passive: true });
    window.addEventListener('resize', this.options.onOrientationChange);
    window.addEventListener('orientationchange', this.options.onOrientationChange);
    document.addEventListener('fullscreenchange', this.options.onFullscreenChange);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // 1. Dedicated Web Worker for 60 FPS Snapshot Buffering & Entity Interpolation
    try {
      this.snapshotWorker = new Worker(
        new URL('../workers/snapshot.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.snapshotWorker.onmessage = (e: MessageEvent) => {
        const { type, payload } = e.data || {};
        if (type === 'RENDER_FRAME' && payload) {
          this.applySnapshot(payload as GameSnapshot);
        }
      };
    } catch {
      this.snapshotWorker = null;
    }

    // 2. Connect to Authoritative Backend WS if valid room UUID + token, with automatic Local Physics Worker fallback
    const canUseBackendWs = Boolean(this.options.token && this.options.roomId && UUID_REGEX.test(this.options.roomId));

    if (canUseBackendWs) {
      this.setMode('connecting', 'Sincronizando sala multijugador...');
      this.gameClient = new GameWSClient(this.options.token);
      this.gameClient
        .connect(
          this.options.roomId,
          (playerId, initialState) => {
            if (this.stopped) return;
            this.myPlayerId = playerId;
            this.setMode('backend-worker', 'Servidor Autoritativo + Snapshot Worker (60Hz)');
            if (initialState) this.handleIncomingSnapshot(initialState);
            if (this.options.testMode === 'beam' || this.options.testMode === 'struggle') {
              setTimeout(() => this.startBeamStruggleTest(), 150);
            } else if (this.options.testMode === 'boss') {
              setTimeout(() => this.spawnBossNow(), 150);
            }
          },
          (snapshot: GameSnapshot) => {
            if (this.stopped) return;
            this.handleIncomingSnapshot(snapshot);
          },
          normalizeRole(this.options.classId),
          {
            difficulty: this.options.difficulty || 'normal',
            world: clampLevelPart(this.options.world, 1),
            stage: clampLevelPart(this.options.stage, 1),
          }
        )
        .catch(() => {
          if (this.stopped) return;
          this.gameClient?.disconnect();
          this.gameClient = null;
          this.startLocalSimulationWorker();
        });
    } else {
      this.startLocalSimulationWorker();
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  }

  private startLocalSimulationWorker(): void {
    if (this.stopped || this.workerBridge) return;
    this.snapshotWorker?.postMessage({ type: 'RESET' });

    const localId = this.options.userId || 'player-local-host';
    this.workerBridge = new GameWorkerBridge();
    this.workerBridge
      .start(
        this.options.roomId || 'local-room',
        localId,
        normalizeRole(this.options.classId),
        this.options.difficulty || 'normal',
        clampLevelPart(this.options.world, 1),
        clampLevelPart(this.options.stage, 1),
        (snapshot) => {
          if (this.stopped) return;
          this.handleIncomingSnapshot(snapshot);
        }
      )
      .then((resolvedId) => {
        if (this.stopped) return;
        this.myPlayerId = resolvedId;
        this.setMode('local-worker', 'Físicas Planck.js en Web Worker Local (60Hz)');

        // Populate companion roster if coming from a demo/offline room
        if (this.options.initialRoster) {
          for (const [pid, role] of Object.entries(this.options.initialRoster)) {
            if (pid !== resolvedId && pid !== localId) {
              this.workerBridge?.addTeammate(pid, normalizeRole(role), true);
            }
          }
        }

        if (this.options.testMode === 'beam' || this.options.testMode === 'struggle') {
          setTimeout(() => this.startBeamStruggleTest(), 120);
        } else if (this.options.testMode === 'boss') {
          setTimeout(() => this.spawnBossNow(), 120);
        }
      });
  }

  private setMode(mode: WorkerRuntimeMode, message: string): void {
    this.runtimeMode = mode;
    this.options.onWorkerModeChange?.(mode, message);
  }

  public stop(): void {
    this.stopped = true;
    window.removeEventListener('touchstart', this.onFirstTouch);
    window.removeEventListener('resize', this.options.onOrientationChange);
    window.removeEventListener('orientationchange', this.options.onOrientationChange);
    document.removeEventListener('fullscreenchange', this.options.onFullscreenChange);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    cancelAnimationFrame(this.animFrameId);
    if (this.snapshotWorker) {
      this.snapshotWorker.terminate();
      this.snapshotWorker = null;
    }
    this.workerBridge?.stop();
    this.workerBridge = null;
    this.gameClient?.disconnect();
    this.gameClient = null;
    this.engine.destroy();
  }

  public selectRole(role: PlayerRole): void {
    if (this.runtimeMode === 'backend-worker') return;
    this.options.setSelectedRole(role);
    this.engine.setCharacterClass(role);
    this.workerBridge?.setRole(role);
  }

  public triggerSkill(): void {
    if (this.workerBridge?.isActive()) {
      this.workerBridge.triggerSkill();
    }
    if (this.gameClient) {
      const role = this.options.getSelectedRole();
      const action = role === 'Tank' ? 'wall' : role === 'Special_Attack' ? 'laser' : 'special';
      const isFocusing = !!(this.keys.ShiftLeft || this.keys.ShiftRight || this.keys.Shift);
      this.gameClient.sendInput(0, 0, action, isFocusing);
    }
  }

  public pushStruggle(): void {
    this.engine.pushStruggle(4.2);
    if (this.gameClient) {
      this.gameClient.sendInput(0, 0, 'struggle_push', false);
      return;
    }
    this.workerBridge?.pushStruggle();
  }

  public restartStage(): void {
    this.snapshotWorker?.postMessage({ type: 'RESET' });
    this.engine.restartStage();
    if (this.gameClient) {
      this.gameClient.sendRestartStage();
      return;
    }
    this.workerBridge?.restartStage();
  }

  public startBeamStruggleTest(): void {
    if (this.gameClient && this.runtimeMode === 'backend-worker') {
      this.options.setSelectedRole('Special_Attack');
      this.engine.startBeamStruggleTest();
      this.gameClient.sendStartStruggle();
      return;
    }
    this.selectRole('Special_Attack');
    this.engine.startBeamStruggleTest();
    this.workerBridge?.startBeamStruggleTest();
  }

  public spawnBossNow(): void {
    if (this.gameClient && this.runtimeMode === 'backend-worker') {
      this.engine.spawnBossDirectly();
      this.gameClient.sendSpawnBoss();
      return;
    }
    this.engine.spawnBossDirectly();
    this.workerBridge?.spawnBossNow();
  }

  public goToNextStage(): boolean {
    this.snapshotWorker?.postMessage({ type: 'RESET' });
    this.engine.restartStage();
    if (this.gameClient) {
      this.gameClient.sendAdvanceStage();
      return true;
    }
    if (this.workerBridge?.isActive()) {
      this.workerBridge.advanceStage();
      return true;
    }
    return false;
  }

  private readonly loop = (now: number) => {
    if (this.stopped) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    let dx = 0;
    let dy = 0;
    if (this.keys.ArrowLeft || this.keys.KeyA || this.keys.a || this.keys.A) dx -= 1;
    if (this.keys.ArrowRight || this.keys.KeyD || this.keys.d || this.keys.D) dx += 1;
    if (this.keys.ArrowUp || this.keys.KeyW || this.keys.w || this.keys.W) dy -= 1;
    if (this.keys.ArrowDown || this.keys.KeyS || this.keys.s || this.keys.S) dy += 1;

    const frameInput = this.options.getFrameInput();
    if (frameInput.touchDx !== 0 || frameInput.touchDy !== 0) {
      dx = frameInput.touchDx;
      dy = frameInput.touchDy;
    }

    const isShooting = !!(this.keys.KeyZ || this.keys.Space || this.keys.z || this.keys.Z || frameInput.touchFiring);
    const isFocusing = !!(
      this.keys.ShiftLeft ||
      this.keys.ShiftRight ||
      this.keys.Shift ||
      this.keys.shift ||
      frameInput.touchFocus
    );

    const effectiveKeys: Record<string, boolean> = {
      ...this.keys,
      KeyZ: isShooting,
      Space: isShooting,
      ShiftLeft: isFocusing,
      ShiftRight: isFocusing,
      Shift: isFocusing,
      focus: isFocusing,
      isFocus: isFocusing,
    };

    const action = isShooting && !this.engine.isBeamStruggle ? 'shoot' : null;

    if (this.gameClient && this.runtimeMode === 'backend-worker') {
      this.gameClient.sendInput(dx, dy, action, isFocusing);
    } else if (this.workerBridge?.isActive()) {
      this.workerBridge.sendInput(dx, dy, action, isFocusing);
    }

    if (this.snapshotWorker) {
      this.snapshotWorker.postMessage({ type: 'GET_INTERPOLATED_STATE' });
    }

    this.engine.update(dt, effectiveKeys, { dx, dy });
    this.options.onEngineFrame(this.engine);
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private handleIncomingSnapshot(snapshot: GameSnapshot): void {
    if (this.snapshotWorker) {
      this.snapshotWorker.postMessage({ type: 'ADD_SNAPSHOT', payload: snapshot });
    } else {
      this.applySnapshot(snapshot);
    }
  }

  private applySnapshot(snapshot: GameSnapshot): void {
    if (!snapshot) return;
    if (snapshot.players) {
      this.engine.applyBackendSnapshot(snapshot.players, this.myPlayerId);
      this.options.onPlayersSnapshot?.(snapshot.players, this.myPlayerId);
    }
    if (snapshot.bullets) this.engine.applyBackendBullets(snapshot.bullets);
    if (snapshot.walls) this.engine.applyBackendWalls(snapshot.walls);
    if (snapshot.lasers) this.engine.applyBackendLasers(snapshot.lasers);
    if (snapshot.boss) this.engine.applyBackendBoss(snapshot.boss);
    if (snapshot.struggle) this.engine.applyBackendStruggle(snapshot.struggle);
    if (snapshot.enemies) this.engine.applyBackendEnemies(snapshot.enemies);
    if (snapshot.items) this.engine.applyBackendItems(snapshot.items);
    if (snapshot.campaign) this.engine.applyBackendCampaign(snapshot.campaign);
  }
}
