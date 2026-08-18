import type { LaserBeam } from '../types';

interface Combatant {
  pos: { x: number; y: number };
  targetPos: { x: number; y: number };
  setPosition?: (x: number, y: number) => void;
}

interface BossCombatant extends Combatant {
  isLockedForBeam: boolean;
}

type StruggleWinner = 'player' | 'boss' | null;

const DEFAULT_BALANCE = 50;
const DEFAULT_TIMER = 3.5;
const MASH_GAIN = 3.2;
const BOSS_PRESSURE_PER_SEC = 22.0;
const PLAYER_WIN_THRESHOLD = 90;
const PLAYER_TIEBREAK_THRESHOLD = 45;
const PLAYER_CLASH_X = 85;
const BOSS_CLASH_X = 940;
const ALIGN_CENTER_Y = 288;
const ALIGN_DURATION = 0.65; // Duración de la mini animación de entrada al centro
const VERTICAL_TOLERANCE = 230; // Tolerancia calibrada para colisión física entre haces

export class BeamStruggleSystem {
  private _isActive = false;
  private _isAligning = false;
  private _alignTimer = 0;
  private _balance = DEFAULT_BALANCE;
  private _timer = DEFAULT_TIMER;
  private _maxTimer = DEFAULT_TIMER;
  private _winner: StruggleWinner = null;
  private _resolutionTimer = 0;
  private _lastMashState = false;

  private _playerStartX = PLAYER_CLASH_X;
  private _playerStartY = ALIGN_CENTER_Y;
  private _bossStartX = BOSS_CLASH_X;
  private _bossStartY = ALIGN_CENTER_Y;

  private _playerBeamTipStartX = PLAYER_CLASH_X;
  private _bossBeamTipStartX = BOSS_CLASH_X;

  public get isActive(): boolean {
    return this._isActive;
  }

  public get isAligning(): boolean {
    return this._isAligning;
  }

  public get alignProgress(): number {
    return Math.min(1, this._alignTimer / ALIGN_DURATION);
  }

  public get isStruggleActive(): boolean {
    return this._isAligning || this._isActive || this._resolutionTimer > 0;
  }

  public get balance(): number {
    return this._balance;
  }

  public get timer(): number {
    return this._timer;
  }

  public get maxTimer(): number {
    return this._maxTimer;
  }

  public get winner(): StruggleWinner {
    return this._winner;
  }

  public get resolutionTimer(): number {
    return this._resolutionTimer;
  }

  public get clashX(): number {
    return 150 + (this._balance / 100) * 724;
  }

  public get clashY(): number {
    return ALIGN_CENTER_Y;
  }

  /**
   * Posición dinámica del frente/punta del rayo del jugador en tiempo real.
   * Evita teletransportes bruscos: el haz avanza o retrocede dinámicamente hasta el punto de choque.
   */
  public get playerBeamTipX(): number {
    if (!this._isAligning) return this.clashX;
    const ease = 1 - Math.pow(1 - this.alignProgress, 3);
    return this._playerBeamTipStartX + (this.clashX - this._playerBeamTipStartX) * ease;
  }

  /**
   * Posición dinámica del frente/punta del rayo del jefe en tiempo real.
   * Evita teletransportes bruscos: el haz avanza o retrocede dinámicamente hasta el punto de choque.
   */
  public get bossBeamTipX(): number {
    if (!this._isAligning) return this.clashX;
    const ease = 1 - Math.pow(1 - this.alignProgress, 3);
    return this._bossBeamTipStartX + (this.clashX - this._bossBeamTipStartX) * ease;
  }

  /**
   * Posición X del vórtice de colisión durante la alineación y choque.
   */
  public get vortexX(): number {
    if (!this._isAligning) return this.clashX;
    return (this.playerBeamTipX + this.bossBeamTipX) / 2;
  }

  /**
   * Posición Y del vórtice de colisión durante la alineación y choque.
   */
  public get vortexY(): number {
    if (!this._isAligning) return ALIGN_CENTER_Y;
    const ease = 1 - Math.pow(1 - this.alignProgress, 3);
    const midY = (this._playerStartY + this._bossStartY) / 2;
    return midY + (ALIGN_CENTER_Y - midY) * ease;
  }

  public reset(): void {
    this._isActive = false;
    this._isAligning = false;
    this._alignTimer = 0;
    this._balance = DEFAULT_BALANCE;
    this._timer = DEFAULT_TIMER;
    this._maxTimer = DEFAULT_TIMER;
    this._winner = null;
    this._resolutionTimer = 0;
    this._lastMashState = false;
    this._playerStartX = PLAYER_CLASH_X;
    this._playerStartY = ALIGN_CENTER_Y;
    this._bossStartX = BOSS_CLASH_X;
    this._bossStartY = ALIGN_CENTER_Y;
    this._playerBeamTipStartX = PLAYER_CLASH_X;
    this._bossBeamTipStartX = BOSS_CLASH_X;
  }

  public push(amount: number): boolean {
    if (!this._isActive || this._winner) return false;
    this._balance = Math.min(100, this._balance + amount);
    return true;
  }

  /**
   * Evalúa si los dos rayos existen, se dirigen mutuamente y se tocan en el eje Y.
   * Sin ventanas de tiempo rígidas: si ambos láseres están presentes (cargando o disparando), colisionan.
   */
  public canStart(
    playerLaser?: LaserBeam,
    bossMega?: LaserBeam,
    playerPos?: { x: number; y: number },
    bossPos?: { x: number; y: number }
  ): boolean {
    if (this._isActive || this._isAligning || this._winner || this._resolutionTimer > 0) {
      return false;
    }

    if (!playerLaser || !bossMega) return false;
    if (playerLaser.state !== 'charging' && playerLaser.state !== 'firing') return false;
    if (bossMega.state !== 'charging' && bossMega.state !== 'firing') return false;

    const playerToRight = (playerLaser.direction ?? 'right') === 'right';
    const bossToLeft = (bossMega.direction ?? 'left') === 'left';
    if (!playerToRight || !bossToLeft) return false;

    // Validación de colisión física en eje Y con tolerancia amplia para las auras visuales
    const playerY = playerPos?.y ?? playerLaser.sourceY;
    const bossY = bossPos?.y ?? bossMega.sourceY;
    const yDelta = Math.abs(playerY - bossY);

    if (yDelta > VERTICAL_TOLERANCE) {
      return false; // Los rayos pasan uno por arriba/abajo del otro sin tocarse
    }

    const playerX = playerPos?.x ?? playerLaser.sourceX;
    const bossX = bossPos?.x ?? bossMega.sourceX;
    return playerX < bossX + 120;
  }

  /**
   * Inicia la secuencia de Choque de Rayos.
   * Transiciona ambos rayos a estado de disparo de inmediato para respuesta dinámica instantánea.
   */
  public start(
    playerLaser: LaserBeam,
    bossLaser: LaserBeam,
    playerPos?: { x: number; y: number },
    bossPos?: { x: number; y: number }
  ): void {
    this._isActive = false;
    this._isAligning = true;
    this._alignTimer = 0;

    this._playerStartX = playerPos?.x ?? PLAYER_CLASH_X;
    this._playerStartY = playerPos?.y ?? ALIGN_CENTER_Y;

    this._bossStartX = bossPos?.x ?? BOSS_CLASH_X;
    this._bossStartY = bossPos?.y ?? ALIGN_CENTER_Y;

    // Capturar la posición inicial de la punta del rayo para interpolar su avance/retroceso suavemente
    if (playerLaser.state === 'firing') {
      this._playerBeamTipStartX = playerLaser.clashX ?? 1024;
    } else {
      this._playerBeamTipStartX = this._playerStartX + 22;
    }

    if (bossLaser.state === 'firing') {
      this._bossBeamTipStartX = bossLaser.clashX ?? 0;
    } else {
      this._bossBeamTipStartX = this._bossStartX;
    }

    // Erupción inmediata de ambos rayos al colisionar: ninguno se queda esperando al otro
    playerLaser.state = 'firing';
    playerLaser.currentWidth = playerLaser.maxWidth;
    playerLaser.timer = 0;

    bossLaser.state = 'firing';
    bossLaser.currentWidth = bossLaser.maxWidth;
    bossLaser.timer = 0;

    this._balance = DEFAULT_BALANCE;
    this._timer = DEFAULT_TIMER;
    this._maxTimer = DEFAULT_TIMER;
    this._winner = null;
    this._lastMashState = false;
  }

  /**
   * Ejecuta la mini animación de traslación fluida hacia los extremos centrales de la pantalla.
   * Retorna `true` en el frame exacto en que termina la alineación para disparar el impacto de inicio.
   */
  public alignCombatants(player: Combatant, boss: BossCombatant, dt: number): boolean {
    if (!this._isAligning) return false;

    this._alignTimer += dt;
    const progress = Math.min(1, this._alignTimer / ALIGN_DURATION);
    // Curva cúbica easeOut para una desaceleración suave y cinematográfica al llegar al centro
    const ease = 1 - Math.pow(1 - progress, 3);

    const currentPx = this._playerStartX + (PLAYER_CLASH_X - this._playerStartX) * ease;
    const currentPy = this._playerStartY + (ALIGN_CENTER_Y - this._playerStartY) * ease;
    if (player.setPosition) {
      player.setPosition(currentPx, currentPy);
    } else {
      player.pos.x = currentPx;
      player.pos.y = currentPy;
      player.targetPos.x = currentPx;
      player.targetPos.y = currentPy;
    }

    const currentBx = this._bossStartX + (BOSS_CLASH_X - this._bossStartX) * ease;
    const currentBy = this._bossStartY + (ALIGN_CENTER_Y - this._bossStartY) * ease;
    boss.isLockedForBeam = true;
    if (boss.setPosition) {
      boss.setPosition(currentBx, currentBy);
    } else {
      boss.pos.x = currentBx;
      boss.pos.y = currentBy;
      boss.targetPos.x = currentBx;
      boss.targetPos.y = currentBy;
    }

    if (progress >= 1.0) {
      // Fijar exactamente en los extremos centrales
      if (player.setPosition) {
        player.setPosition(PLAYER_CLASH_X, ALIGN_CENTER_Y);
      } else {
        player.pos.x = PLAYER_CLASH_X;
        player.pos.y = ALIGN_CENTER_Y;
        player.targetPos.x = PLAYER_CLASH_X;
        player.targetPos.y = ALIGN_CENTER_Y;
      }

      if (boss.setPosition) {
        boss.setPosition(BOSS_CLASH_X, ALIGN_CENTER_Y);
      } else {
        boss.pos.x = BOSS_CLASH_X;
        boss.pos.y = ALIGN_CENTER_Y;
        boss.targetPos.x = BOSS_CLASH_X;
        boss.targetPos.y = ALIGN_CENTER_Y;
      }

      this._isAligning = false;
      this._isActive = true;
      this._timer = DEFAULT_TIMER;
      return true; // Transición a activo completada en este frame
    }

    return false;
  }

  /**
   * Mantiene anclados a los combatientes en sus posiciones centrales durante el choque activo.
   */
  public lockCombatants(player: Combatant, boss: BossCombatant, animTimer: number): void {
    const pVibeY = Math.sin(animTimer * 45) * 1.5;
    const bVibeY = Math.cos(animTimer * 45) * 1.5;

    if (player.setPosition) {
      player.setPosition(PLAYER_CLASH_X, ALIGN_CENTER_Y + pVibeY);
    } else {
      player.pos.x = PLAYER_CLASH_X;
      player.pos.y = ALIGN_CENTER_Y + pVibeY;
      player.targetPos.x = PLAYER_CLASH_X;
      player.targetPos.y = ALIGN_CENTER_Y + pVibeY;
    }

    boss.isLockedForBeam = true;
    if (boss.setPosition) {
      boss.setPosition(BOSS_CLASH_X, ALIGN_CENTER_Y + bVibeY);
    } else {
      boss.pos.x = BOSS_CLASH_X;
      boss.pos.y = ALIGN_CENTER_Y + bVibeY;
      boss.targetPos.x = BOSS_CLASH_X;
      boss.targetPos.y = ALIGN_CENTER_Y + bVibeY;
    }
  }

  /**
   * Procesa el machaque de teclas del jugador y la presión continua del jefe.
   * Solo opera mientras el minijuego esté activo (_isActive).
   */
  public applyMashAndPressure(dt: number, keys: Record<string, boolean>): boolean {
    if (!this._isActive || this._winner) return false;

    const isMashing =
      !!keys['KeyZ'] ||
      !!keys['KeyX'] ||
      !!keys['Space'] ||
      !!keys['z'] ||
      !!keys['Z'] ||
      !!keys['x'] ||
      !!keys['X'] ||
      !!keys['touchPush'] ||
      !!keys['push'] ||
      !!keys['KeyA'] ||
      !!keys['KeyD'];

    let mashPulse = false;
    if (isMashing && !this._lastMashState) {
      this._balance = Math.min(100, this._balance + MASH_GAIN);
      mashPulse = true;
    }
    this._lastMashState = isMashing;

    this._balance = Math.max(0, this._balance - dt * BOSS_PRESSURE_PER_SEC);
    this._timer -= dt;

    return mashPulse;
  }

  public evaluateWinner(): StruggleWinner {
    if (this._balance >= PLAYER_WIN_THRESHOLD || (this._timer <= 0 && this._balance >= PLAYER_TIEBREAK_THRESHOLD)) {
      return 'player';
    }

    if (this._balance <= 5 || (this._timer <= 0 && this._balance < PLAYER_TIEBREAK_THRESHOLD)) {
      return 'boss';
    }

    return null;
  }

  public startResolution(winner: Exclude<StruggleWinner, null>): void {
    this._isActive = false;
    this._winner = winner;
    this._resolutionTimer = winner === 'player' ? 1.8 : 2.0;
  }

  public tickResolution(dt: number): boolean {
    if (this._resolutionTimer <= 0) return false;

    this._resolutionTimer -= dt;
    if (this._resolutionTimer <= 0) {
      this._resolutionTimer = 0;
      this._winner = null;
      return true;
    }

    return false;
  }
}
