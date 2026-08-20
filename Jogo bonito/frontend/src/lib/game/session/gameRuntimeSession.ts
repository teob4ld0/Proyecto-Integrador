import { APIClient } from '$lib/network/apiClient';
import { GameEngine } from '$lib/engine/GameEngine';
import { GameWSClient, type GameSnapshot, type ServerPlayer } from '$lib/network/wsClient';

export type PlayerRole = 'Tank' | 'Support' | 'DPS' | 'Special_Attack';
export type Difficulty = 'normal' | 'difficult' | 'no_mercy';

export type SessionQuery = {
  roomId: string;
  classId: string;
  token: string;
  difficulty: Difficulty;
  testMode: string | null;
};

export type RuntimeFrameInput = {
  touchDx: number;
  touchDy: number;
  touchFiring: boolean;
  touchFocus: boolean;
};

export type RuntimeSessionOptions = {
  canvas: HTMLCanvasElement;
  roomId: string;
  classId: string;
  token: string;
  difficulty?: Difficulty;
  testMode?: string | null;
  authorityMode?: 'hybrid' | 'backend-only';
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
  onStandaloneWarn?: (error: unknown) => void;
  onBackendUnavailable?: (error: unknown) => void;
  onAuthorityStateChange?: (isAuthoritative: boolean) => void;
};

function toDifficulty(value: string | null | undefined, fallback: Difficulty = 'normal'): Difficulty {
  if (value === 'difficult' || value === 'no_mercy' || value === 'normal') return value;
  return fallback;
}

export function readSessionQuery(search: string, defaultDifficulty: Difficulty = 'normal'): SessionQuery {
  const searchParams = new URLSearchParams(search);
  return {
    roomId: searchParams.get('roomId') || searchParams.get('room') || 'default-room',
    classId: searchParams.get('class') || searchParams.get('character') || 'attack',
    token: searchParams.get('token') || APIClient.getToken() || '',
    difficulty: toDifficulty(searchParams.get('difficulty'), defaultDifficulty),
    testMode: searchParams.get('test'),
  };
}

export class GameRuntimeSession {
  public readonly engine: GameEngine;
  private gameClient: GameWSClient | null = null;
  private readonly keys: Record<string, boolean> = {};
  private readonly options: RuntimeSessionOptions;
  private readonly authorityMode: 'hybrid' | 'backend-only';
  private myPlayerId = '';
  private animFrameId = 0;
  private lastTime = performance.now();

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

    if (e.code === 'Digit1') this.selectRole('DPS');
    if (e.code === 'Digit2') this.selectRole('Tank');
    if (e.code === 'Digit3') this.selectRole('Support');
    if (e.code === 'Digit4') this.selectRole('Special_Attack');
    if (e.code === 'KeyX') this.triggerSkill();
    if (e.code === 'KeyT') this.startBeamStruggleTest();
    if (e.code === 'KeyB') this.spawnBossNow();
    if (e.code === 'KeyF') this.options.onToggleFullscreen();
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
    this.authorityMode = options.authorityMode || 'hybrid';
    this.engine = new GameEngine(options.canvas, 1024, 576, { difficulty: options.difficulty });
    this.engine.setCharacterClass(options.classId);
  }

  public start(): void {
    const isCoarse = window.matchMedia('(pointer: coarse) and (hover: none)').matches;
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this.options.onTouchDeviceChange(isCoarse && hasTouch);
    this.options.onOrientationChange();

    window.addEventListener('touchstart', this.onFirstTouch, { once: true, passive: true });
    window.addEventListener('resize', this.options.onOrientationChange);
    window.addEventListener('orientationchange', this.options.onOrientationChange);
    document.addEventListener('fullscreenchange', this.options.onFullscreenChange);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    if (this.options.token && this.options.roomId) {
      this.gameClient = new GameWSClient(this.options.token);
      this.gameClient.connect(
        this.options.roomId,
        (playerId, initialState) => {
          this.myPlayerId = playerId;
          if (initialState) this.applySnapshot(initialState);
        },
        (snapshot: GameSnapshot) => this.applySnapshot(snapshot)
      ).catch((err) => {
        if (this.authorityMode === 'backend-only') {
          if (this.options.onBackendUnavailable) this.options.onBackendUnavailable(err);
          this.options.onAuthorityStateChange?.(false);
          return;
        }
        if (this.options.onStandaloneWarn) this.options.onStandaloneWarn(err);
      });
    } else if (this.authorityMode === 'backend-only') {
      const err = new Error('Multiplayer requiere token y roomId validos para conectar al backend.');
      if (this.options.onBackendUnavailable) this.options.onBackendUnavailable(err);
      this.options.onAuthorityStateChange?.(false);
    }

    if (this.authorityMode !== 'backend-only' && (this.options.testMode === 'beam' || this.options.testMode === 'struggle')) {
      setTimeout(() => this.startBeamStruggleTest(), 120);
    } else if (this.authorityMode !== 'backend-only' && this.options.testMode === 'boss') {
      setTimeout(() => this.spawnBossNow(), 120);
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    window.removeEventListener('touchstart', this.onFirstTouch);
    window.removeEventListener('resize', this.options.onOrientationChange);
    window.removeEventListener('orientationchange', this.options.onOrientationChange);
    document.removeEventListener('fullscreenchange', this.options.onFullscreenChange);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    cancelAnimationFrame(this.animFrameId);
    this.gameClient?.disconnect();
    this.engine.destroy();
  }

  public selectRole(role: PlayerRole): void {
    this.options.setSelectedRole(role);
    this.engine.setCharacterClass(role);
  }

  public triggerSkill(): void {
    if (this.authorityMode !== 'backend-only' && !(this.engine.isBackendConnected && this.engine.useBackendBullets)) {
      this.engine.triggerCharacterSkill();
    }
    if (this.gameClient) {
      const role = this.options.getSelectedRole();
      const action = role === 'Tank' ? 'wall' : (role === 'Special_Attack' ? 'laser' : 'special');
      this.gameClient.sendInput(0, 0, action);
    }
  }

  public pushStruggle(): void {
    if (this.gameClient) {
      this.gameClient.sendInput(0, 0, 'struggle_push');
      return;
    }
    if (this.authorityMode === 'backend-only') return;
    this.engine.pushStruggle(4.5);
  }

  public restartStage(): void {
    if (this.authorityMode === 'backend-only') return;
    this.engine.restartStage();
  }

  public startBeamStruggleTest(): void {
    if (this.authorityMode === 'backend-only') return;
    this.selectRole('Special_Attack');
    this.engine.startBeamStruggleTest();
  }

  public spawnBossNow(): void {
    if (this.authorityMode === 'backend-only') return;
    this.engine.spawnBossDirectly();
  }

  public goToNextStage(): boolean {
    if (this.authorityMode === 'backend-only') return false;
    return this.engine.goToNextStage();
  }

  private readonly loop = (now: number) => {
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

    const isShooting = !!this.keys.KeyZ || !!this.keys.Space || !!this.keys.z || !!this.keys.Z || frameInput.touchFiring;
    const isFocusing = !!this.keys.ShiftLeft || !!this.keys.ShiftRight || !!this.keys.Shift || !!this.keys.shift || frameInput.touchFocus;

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

    if (this.authorityMode === 'backend-only' && !(this.engine.isBackendConnected && this.engine.useBackendBullets)) {
      if (this.gameClient) {
        this.gameClient.sendInput(dx, dy, isShooting ? 'shoot' : null);
      }
      this.options.onAuthorityStateChange?.(false);
      this.options.onEngineFrame(this.engine);
      this.animFrameId = requestAnimationFrame(this.loop);
      return;
    }

    this.engine.update(dt, effectiveKeys, { dx, dy });

    if (this.gameClient) {
      this.gameClient.sendInput(dx, dy, isShooting ? 'shoot' : null);
    }

    this.options.onEngineFrame(this.engine);
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private applySnapshot(snapshot: GameSnapshot): void {
    if (snapshot.players) {
      this.engine.applyBackendSnapshot(snapshot.players, this.myPlayerId);
      this.options.onPlayersSnapshot?.(snapshot.players, this.myPlayerId);
    }
    if (snapshot.bullets) this.engine.applyBackendBullets(snapshot.bullets);
    if (snapshot.lasers) this.engine.applyBackendLasers(snapshot.lasers);
    if (snapshot.boss) this.engine.applyBackendBoss(snapshot.boss);
    if (snapshot.struggle) this.engine.applyBackendStruggle(snapshot.struggle);
    if (snapshot.enemies) this.engine.applyBackendEnemies(snapshot.enemies);
    if (snapshot.items) this.engine.applyBackendItems(snapshot.items);
    if (snapshot.campaign) this.engine.applyBackendCampaign(snapshot.campaign);
    this.options.onAuthorityStateChange?.(this.engine.isBackendConnected && this.engine.useBackendBullets);
  }
}

