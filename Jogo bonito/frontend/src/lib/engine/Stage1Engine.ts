import type { CharacterClass, RemotePlayer, Bullet, LaserBeam, WallBarrier, SparkParticle, StageState, BossPhase, ItemType } from './types';
import type { ServerBullet, ServerLaser, ServerBoss, ServerBeamStruggle } from '../network/wsClient';
import { BaseStageEngine } from './BaseStageEngine';
import { Player } from './entities/Player';
import { Boss } from './entities/Boss';
import { EnemySystem } from './systems/EnemySystem';
import { ItemSystem } from './systems/ItemSystem';
import { TimelineManager } from './systems/TimelineManager';
import { BeamStruggleSystem } from './systems/BeamStruggleSystem';
import { loadStage1Sprites } from './SpriteFactory';

type ServerCombatState = {
  hp?: number;
  maxHp?: number;
  sp?: number;
  maxSp?: number;
  defensePercent?: number;
};

type ServerStruggleState = ServerBeamStruggle;

export class Stage1Engine extends BaseStageEngine {
  public player: Player;
  public boss: Boss;
  public enemySystem: EnemySystem;
  public itemSystem: ItemSystem;
  public timeline: TimelineManager;
  private playerDamageCooldown = 0;
  private serverCombatState: ServerCombatState | null = null;
  private serverStruggleState: ServerStruggleState | null = null;

  // Estado del Nivel y HUD
  public stageState: StageState = 'intro';
  public isStageClear: boolean = false;
  public stageBanner: { text: string; subtext: string; timer: number; maxTimer: number } | null = null;
  public bossWarningActive: boolean = false;
  public spellcardBanner: { active: boolean; name: string; timer: number } = { active: false, name: '', timer: 0 };
  public showBossHpBar: boolean = false;

  constructor(canvas: HTMLCanvasElement, width: number = 1024, height: number = 576) {
    super(canvas, width, height);

    this.player = new Player(this.playerContainer, 'DPS');
    this.boss = new Boss(this.enemyContainer, '/assets/sprites/FirstBoss.png', 100);
    this.enemySystem = new EnemySystem(this.enemyContainer);
    this.itemSystem = new ItemSystem(this.playfieldContainer);
    this.timeline = new TimelineManager();

    // Cargar sprites de hadas y efectos de Touhou 6 de forma asíncrona
    loadStage1Sprites().then((sprites) => {
      if (sprites && sprites.isReady) {
        this.enemySystem.setTextures({
          fairyGreen: sprites.fairyGreen,
          fairyRed: sprites.fairyRed,
          fairyBig: sprites.fairyBig,
        });
      }
    }).catch(() => {
      // Fallback a gráficos procedimentales vectoriales
    });

    // Configurar callbacks del Jefe
    this.boss.onPhaseChange = (phase: BossPhase, spellName: string, isSpellCard: boolean) => {
      this.spellcardName = spellName;
      if (isSpellCard) {
        this.spellcardBanner = { active: true, name: spellName, timer: 3.8 };
        this.playSound('/assets/sounds/gasterintro.wav', 0.7);
      }
      this.bulletSystem.bullets = []; // Limpieza de balas al cambiar de fase
      this.applyScreenShake(0.6, 16);
      this.playSound('/assets/sounds/powerup.wav', 0.6);
    };

    this.boss.onDefeated = () => {
      this.stageState = 'stage_clear';
      this.isStageClear = true;
      this.showBossHpBar = false;
      this.itemSystem.spawnItemFountain(this.boss.pos.x, this.boss.pos.y, 20);
      this.applyScreenShake(1.4, 22);
      this.playSound('/assets/sounds/gasterfire.wav', 0.8);
      this.score += 100000;
    };

    // Inicializar el guión cronometrado del Stage 1
    this.setupTimeline();
  }

  private setupTimeline(): void {
    this.timeline.loadScript([
      {
        time: 0.5,
        action: 'stage_banner',
        payload: { text: 'STAGE 1', subtext: 'The Moonlit Forest ~ Danmaku Incursion' },
      },
      {
        time: 3.0,
        action: 'spawn_wave',
        payload: { wave: 1 },
      },
      {
        time: 8.5,
        action: 'spawn_wave',
        payload: { wave: 2 },
      },
      {
        time: 16.0,
        action: 'spawn_wave',
        payload: { wave: 3 },
      },
      {
        time: 27.0,
        action: 'spawn_wave',
        payload: { wave: 4 },
      },
      {
        time: 36.0,
        action: 'spawn_wave',
        payload: { wave: 5 },
      },
      {
        time: 45.0,
        action: 'boss_warning',
        payload: {},
      },
      {
        time: 48.5,
        action: 'spawn_boss',
        payload: {},
      },
    ]);

    this.timeline
      .on('stage_banner', (payload) => {
        this.stageBanner = {
          text: payload.text,
          subtext: payload.subtext,
          timer: 4.5,
          maxTimer: 4.5,
        };
        this.stageState = 'waves';
      })
      .on('spawn_wave', (payload) => {
        if (payload.wave === 1) {
          // OLEADA 1: Doble Hélice Senoidal
          this.enemySystem.spawnDoubleHelixWave(6);
        } else if (payload.wave === 2) {
          // OLEADA 2: Pinza Carmesí Avanzada
          this.enemySystem.spawnPincerWave(3);
        } else if (payload.wave === 3) {
          // OLEADA 3: Gran Hada Comandante (Mini-Jefe)
          this.enemySystem.spawnCommanderWave(1080, 288);
        } else if (payload.wave === 4) {
          // OLEADA 4: Asalto Pesado Púrpura
          this.enemySystem.spawnPurpleAssaultWave();
        } else if (payload.wave === 5) {
          // OLEADA 5: Cortina de Fuego Cruzado en Zigzag
          this.enemySystem.spawnCrossfireWave(10);
        }
      })
      .on('boss_warning', () => {
        this.bossWarningActive = true;
        this.stageState = 'boss_warning';
        this.playSound('/assets/sounds/gasterintro.wav', 0.7);
        setTimeout(() => {
          this.bossWarningActive = false;
        }, 3400);
      })
      .on('spawn_boss', () => {
        this.stageState = 'boss_battle';
        this.showBossHpBar = true;
        this.boss.spawn(760, 288);
      });
  }

  // ── Getters y Propiedades Compatibles con el HUD y Rutas ─────────────────────

  public get remainingStocks(): number {
    return this.boss.remainingStocks;
  }

  public get isRefillingHp(): boolean {
    return this.boss.isRefilling;
  }

  public get displayHpPercent(): number {
    return this.boss.displayHpPercent;
  }

  public get isSpellCard(): boolean {
    return this.boss.isSpellCard;
  }

  public get playerPos() {
    return this.player.pos;
  }
  public set playerPos(val: { x: number; y: number }) {
    this.player.pos = val;
  }

  public get targetPlayerPos() {
    return this.player.targetPos;
  }
  public set targetPlayerPos(val: { x: number; y: number }) {
    this.player.targetPos = val;
  }

  public get bossPos() {
    return this.boss.pos;
  }
  public set bossPos(val: { x: number; y: number }) {
    this.boss.pos = val;
  }

  // ── Estado de Beam Struggle (Choque de Rayos Ultra Épico) ─────────────────────
  private beamStruggle = new BeamStruggleSystem();

  public get isBeamStruggle(): boolean {
    if (this.isBackendConnected && this.useBackendBullets && this.serverStruggleState) {
      return !!(this.serverStruggleState.active || this.serverStruggleState.isAligning || (this.serverStruggleState.resolutionTimer ?? 0) > 0);
    }
    return this.beamStruggle.isActive;
  }

  public get isStruggleAligning(): boolean {
    if (this.isBackendConnected && this.useBackendBullets && this.serverStruggleState) {
      return !!this.serverStruggleState.isAligning;
    }
    return this.beamStruggle.isAligning;
  }

  public get struggleBalance(): number {
    if (this.isBackendConnected && this.useBackendBullets && this.serverStruggleState) {
      return this.serverStruggleState.balance;
    }
    return this.beamStruggle.balance;
  }

  public get struggleTimer(): number {
    if (this.isBackendConnected && this.useBackendBullets && this.serverStruggleState) {
      return this.serverStruggleState.timer;
    }
    return this.beamStruggle.timer;
  }

  public get struggleMaxTimer(): number {
    if (this.isBackendConnected && this.useBackendBullets && this.serverStruggleState) {
      return this.serverStruggleState.maxTimer;
    }
    return this.beamStruggle.maxTimer;
  }

  public get struggleWinner(): 'player' | 'boss' | null {
    if (this.isBackendConnected && this.useBackendBullets && this.serverStruggleState) {
      return this.serverStruggleState.winner ?? null;
    }
    return this.beamStruggle.winner;
  }

  public get struggleResolutionTimer(): number {
    if (this.isBackendConnected && this.useBackendBullets && this.serverStruggleState) {
      return this.serverStruggleState.resolutionTimer ?? 0;
    }
    return this.beamStruggle.resolutionTimer;
  }

  public get isStruggleActive(): boolean {
    if (this.isBackendConnected && this.useBackendBullets && this.serverStruggleState) {
      return !!(this.serverStruggleState.active || this.serverStruggleState.isAligning || (this.serverStruggleState.resolutionTimer ?? 0) > 0);
    }
    return this.beamStruggle.isStruggleActive;
  }

  public get struggleProgress(): number {
    return this.struggleBalance;
  }

  public get struggleTimeLeft(): number {
    return Math.max(0, this.beamStruggle.timer);
  }

  public pushStruggle(amount: number = 3.5): void {
    if (this.beamStruggle.push(amount)) {
      this.shakeTimer = 0.15;
      this.playSound('/assets/sounds/powerup.wav', 0.4);
    }
  }

  public get bossHp() {
    return this.boss.hp;
  }
  public set bossHp(val: number) {
    this.boss.hp = val;
  }

  public get maxBossHp() {
    return this.boss.maxHp;
  }
  public set maxBossHp(val: number) {
    this.boss.maxHp = val;
  }

  public get spellcardName() {
    return this.boss.spellcardName;
  }
  public set spellcardName(val: string) {
    this.boss.spellcardName = val;
  }

  public get isFocus() {
    return this.player.isFocus;
  }
  public set isFocus(val: boolean) {
    this.player.isFocus = val;
  }

  public get characterClassId() {
    return this.player.characterClassId;
  }
  public set characterClassId(val: CharacterClass) {
    this.player.characterClassId = val;
  }

  public get playerHp(): number {
    if (this.isBackendConnected && this.serverCombatState?.hp !== undefined) return this.serverCombatState.hp;
    return this.player.hp;
  }

  public get playerMaxHp(): number {
    if (this.isBackendConnected && this.serverCombatState?.maxHp !== undefined) return this.serverCombatState.maxHp;
    return this.player.maxHp;
  }

  public get playerSp(): number {
    if (this.isBackendConnected && this.serverCombatState?.sp !== undefined) return this.serverCombatState.sp;
    return this.player.sp;
  }

  public get playerMaxSp(): number {
    if (this.isBackendConnected && this.serverCombatState?.maxSp !== undefined) return this.serverCombatState.maxSp;
    return this.player.maxSp;
  }

  public get playerDefensePercent(): number {
    if (this.isBackendConnected && this.serverCombatState?.defensePercent !== undefined) return this.serverCombatState.defensePercent;
    return this.player.defensePercent;
  }

  private applyPlayerDamage(baseDamage: number): void {
    if (this.isBackendConnected && this.useBackendBullets) return;
    if (this.playerDamageCooldown > 0) return;
    const appliedDamage = this.player.applyIncomingDamage(baseDamage);
    if (appliedDamage <= 0) return;

    this.playerDamageCooldown = 0.18;

    this.playerLives = this.player.hp > 0 ? 1 : 0;
    this.graze += 1;
    this.applyScreenShake(0.3, 10);
  }

  public get bullets(): Bullet[] {
    return this.bulletSystem.bullets;
  }
  public set bullets(val: Bullet[]) {
    this.bulletSystem.bullets = val;
  }

  public get playerBullets(): Bullet[] {
    return this.bulletSystem.playerBullets;
  }
  public set playerBullets(val: Bullet[]) {
    this.bulletSystem.playerBullets = val;
  }

  public get lasers(): LaserBeam[] {
    return this.laserSystem.lasers;
  }
  public set lasers(val: LaserBeam[]) {
    this.laserSystem.lasers = val;
  }

  public get walls(): WallBarrier[] {
    return this.wallSystem.walls;
  }
  public set walls(val: WallBarrier[]) {
    this.wallSystem.walls = val;
  }

  public get particles(): SparkParticle[] {
    return this.particleSystem.particles;
  }
  public set particles(val: SparkParticle[]) {
    this.particleSystem.particles = val;
  }

  // ── Métodos de Acción ────────────────────────────────────────────────────────

  public setCharacterClass(classId: string): void {
    this.player.setCharacterClass(classId as CharacterClass);
    this.playerLives = this.player.hp > 0 ? 1 : 0;
  }

  public triggerCharacterSkill(): boolean {
    if (this.isBackendConnected && this.useBackendBullets) {
      return false;
    }

    const used = this.player.triggerSkill(
      this.wallSystem,
      this.laserSystem,
      this.particleSystem,
      this.bulletSystem,
      this.boss.isActive ? this.boss.pos : { x: 900, y: 288 },
      (path, vol) => this.playSound(path, vol)
    );

    if (!used) return false;

    const classId = String(this.player.characterClassId || '').toLowerCase();
    const canBombDamage = classId === 'dps' || classId === 'physical' || classId === 'special_attack' || classId === 'attack';
    if (canBombDamage && this.boss.isActive && !this.boss.isDefeated) {
      this.boss.takeDamage(this.player.bombDamage);
    }

    return true;
  }

  public triggerRhombusLasers(pattern: 'both' | 'targeted' = 'both'): void {
    this.boss.triggerRhombusLasers(this.laserSystem, this.player.pos, this.SCALE_X, this.SCALE_Y, pattern);
  }

  public getClosestAimTarget(): { x: number; y: number } {
    let closestEnemy: { x: number; y: number } | null = null;
    let minDistSq = Infinity;

    // 1. Priorizar hadas/enemigos activos en pantalla
    for (const enemy of this.enemySystem.enemies) {
      if (!enemy.isDead && !enemy.isOffscreen && enemy.pos.x >= 20 && enemy.pos.x <= 1040) {
        const dx = enemy.pos.x - this.player.pos.x;
        const dy = enemy.pos.y - this.player.pos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closestEnemy = enemy.pos;
        }
      }
    }

    if (closestEnemy) {
      return closestEnemy;
    }

    // 2. Si no hay hadas, apuntar al Jefe si está activo
    if (this.boss.isActive && !this.boss.isDefeated) {
      return this.boss.pos;
    }

  // 3. Fallback: Disparo hacia adelante
    return { x: this.player.pos.x + 800, y: this.player.pos.y };
  }

  private bossMegaLaserActive(): boolean {
    return this.laserSystem.lasers.some(l => l.ownerId === 'boss' && (l.isMegaBeam || l.maxWidth >= 80));
  }

  public restartStage(): void {
    this.score = 0;
    this.power = 0;
    this.graze = 0;
    this.playerLives = 3;
    this.playerBombs = 3;
    this.isStageClear = false;
    this.stageState = 'intro';
    this.showBossHpBar = false;
    this.bossWarningActive = false;
    this.spellcardBanner = { active: false, name: '', timer: 0 };
    this.enemySystem.clear();
    this.itemSystem.clear();
    this.bulletSystem.clear();
    this.laserSystem.clear();
    this.wallSystem.clear();
    this.beamStruggle.reset();
    this.timeline.reset();
    this.player.resetCombatResources();
    this.playerLives = 1;
  }

  /**
   * MODO DE PRUEBA RÁPIDA: BEAM STRUGGLE TEST
   * Configura al jugador como SP.ATK y desata la animación cinematográfica de alineación al centro y el choque.
   */
  public startBeamStruggleTest(): void {
    this.restartStage();
    this.player.setCharacterClass('Special_Attack');
    // Posicionamos en los extremos opuestos y a alturas donde los haces colisionan
    this.player.setPosition(100, 250);
    
    this.stageState = 'boss_battle';
    this.showBossHpBar = true;
    this.boss.spawn(930, 320);
    this.boss.phase = 2;
    this.boss.spellcardName = 'Moon Sign "Moonlight Ray" (Beam Clash Test)';
    this.boss.isSpellCard = true;
    this.spellcardBanner = { active: true, name: '⚡ BEAM STRUGGLE TEST ~ PREPÁRATE!', timer: 3.5 };
    
    this.enemySystem.clear();
    this.bulletSystem.clear();
    
    // El jefe y el jugador disparan sus Mega Rayos para iniciar la animación de choque de inmediato
    setTimeout(() => {
      if (this.boss.isActive && !this.boss.isDefeated) {
        this.player.gainSp(this.player.maxSp);
        this.boss.triggerMegaGoldLaser(this.laserSystem);
        this.player.triggerSkill(
          this.wallSystem,
          this.laserSystem,
          this.particleSystem,
          this.bulletSystem,
          this.boss.pos,
          (p, v) => this.playSound(p, v)
        );
        this.playSound('/assets/sounds/gasterintro.wav', 0.85);
      }
    }, 280);
  }

  // ── Sincronización de Red ───────────────────────────────────────────────────

  public applyBackendSnapshot(players: RemotePlayer[], myPlayerId: string): void {
    super.applyBackendSnapshot(players, myPlayerId, (x, y) => {
      this.player.targetPos.x = x;
      this.player.targetPos.y = y;
    });

    const me = players.find((p) => p.id === myPlayerId) as (RemotePlayer & ServerCombatState) | undefined;
    if (!me) return;

    this.serverCombatState = {
      hp: me.hp,
      maxHp: me.maxHp,
      sp: me.sp,
      maxSp: me.maxSp,
      defensePercent: me.defensePercent,
    };

    if (me.hp !== undefined) this.player.hp = me.hp;
    if (me.sp !== undefined) this.player.sp = me.sp;
  }

  public applyBackendBoss(boss: ServerBoss): void {
    if (boss) {
      if (!this.boss.isActive) this.boss.spawn(boss.x * this.SCALE_X, boss.y * this.SCALE_Y);
      this.boss.setPosition(boss.x * this.SCALE_X, boss.y * this.SCALE_Y);
      this.boss.hp = boss.hp;
      this.boss.maxHp = boss.maxHp;
    }
  }

  public applyBackendStruggle(struggle?: ServerBeamStruggle): void {
    this.serverStruggleState = struggle ?? null;
  }

  // ── Loop de Actualización Principal del Nivel 1 ──────────────────────────────

  public update(dt: number, keys: Record<string, boolean>, moveVec?: { dx: number; dy: number }): void {
    this.animTimer += dt;
    this.playerDamageCooldown = Math.max(0, this.playerDamageCooldown - dt);

    // Detectar si el Master Spark está en fase de carga (Micro-Pausa de 1 segundo) o de disparo
    const masterSpark = this.laserSystem.lasers.find(l => l.ownerId === 'player');
    const isMasterSparkCharging = masterSpark && masterSpark.state === 'charging';
    this.isLaserFiring = !!(masterSpark && masterSpark.state === 'firing');

    // Hotkeys para cambio de personaje
    if (keys['Digit1']) this.setCharacterClass('Tank');
    if (keys['Digit2']) this.setCharacterClass('Support');
    if (keys['Digit3']) this.setCharacterClass('DPS');
    if (keys['Digit4']) this.setCharacterClass('Special_Attack');

    // Hotkeys para activación de Habilidad (solo offline/local)
    if (!(this.isBackendConnected && this.useBackendBullets) && (keys['KeyX'] || keys['KeyB'])) {
      this.triggerCharacterSkill();
    }

    // 1. Renderizar Fondo Procedural (se pausa el scroll durante la micro-pausa)
    this.backgroundRenderer.update(isMasterSparkCharging ? 0 : dt);

    // 2. Movimiento y Animación del Jugador (Bloqueado intencionalmente durante toda la pugna y alineación)
    const isMovementLocked = this.isStruggleActive;
    const movementLockedKeys = isMovementLocked
      ? {
        ...keys,
        ArrowLeft: false,
        ArrowRight: false,
        ArrowUp: false,
        ArrowDown: false,
        KeyA: false,
        KeyD: false,
        KeyW: false,
        KeyS: false,
      }
      : keys;

    this.player.update(
      dt,
      this.animTimer,
      movementLockedKeys,
      isMovementLocked ? { dx: 0, dy: 0 } : moveVec,
      this.isBackendConnected && this.useBackendBullets
    );

    // 3. Efecto de Micro-Pausa & Spotlight al Acumular Poder (1 Segundo)
    this.spellcardOverlayGraphics.clear();
    if (isMasterSparkCharging) {
      const progress = masterSpark.timer / masterSpark.chargeDuration;

      // Fondo oscurecido dramático
      this.spellcardOverlayGraphics.beginFill(0x020108, 0.65);
      this.spellcardOverlayGraphics.drawRect(0, 0, 1024, 576);
      this.spellcardOverlayGraphics.endFill();

      // Spotlight / Halo de Resaltado en el Personaje
      const px = this.player.pos.x;
      const py = this.player.pos.y;
      const auraRadius = 35 + Math.sin(this.animTimer * 15) * 6;

      this.spellcardOverlayGraphics.lineStyle(3, 0x00f2fe, 0.9);
      this.spellcardOverlayGraphics.drawCircle(px, py, auraRadius);
      this.spellcardOverlayGraphics.lineStyle(1.5, 0xffdd00, 0.8);
      this.spellcardOverlayGraphics.drawCircle(px, py, auraRadius * 1.35);
      this.spellcardOverlayGraphics.lineStyle(0);

      // Círculo Mágico / Mini-Hakkero giratorio alrededor del personaje
      const rot = this.animTimer * 8;
      this.spellcardOverlayGraphics.lineStyle(2, 0x00f2fe, 0.75);
      for (let s = 0; s < 6; s++) {
        const a1 = rot + (Math.PI / 3) * s;
        const a2 = rot + (Math.PI / 3) * (s + 2);
        const x1 = px + Math.cos(a1) * (auraRadius * 0.9);
        const y1 = py + Math.sin(a1) * (auraRadius * 0.9);
        const x2 = px + Math.cos(a2) * (auraRadius * 0.9);
        const y2 = py + Math.sin(a2) * (auraRadius * 0.9);
        this.spellcardOverlayGraphics.moveTo(x1, y1);
        this.spellcardOverlayGraphics.lineTo(x2, y2);
      }
      this.spellcardOverlayGraphics.lineStyle(0);

      // Partículas hacia el jugador
      for (let i = 0; i < 3; i++) {
        const pAngle = Math.random() * Math.PI * 2;
        const pDist = 45 + Math.random() * 65;
        this.particleSystem.spawnSpark(
          px + Math.cos(pAngle) * pDist,
          py + Math.sin(pAngle) * pDist,
          -Math.cos(pAngle) * (200 + progress * 200),
          -Math.sin(pAngle) * (200 + progress * 200),
          Math.random() > 0.5 ? 0x00f2fe : 0xffdd00,
          3 + Math.random() * 3,
          0.28,
          true
        );
      }
    }

    // 4. Lógica de Nivel, Oleadas, Balas, Muros y Boss
    if (!this.useBackendBullets) {
      if (!isMasterSparkCharging) {
        this.stageTime += dt;

        // Actualizar Director de Línea Temporal (Timeline Script)
        this.timeline.update(dt);

        // Actualizar Banners de Texto
        if (this.stageBanner) {
          this.stageBanner.timer -= dt;
          if (this.stageBanner.timer <= 0) this.stageBanner = null;
        }

        if (this.spellcardBanner.active) {
          this.spellcardBanner.timer -= dt;
          if (this.spellcardBanner.timer <= 0) this.spellcardBanner.active = false;
        }

        // Disparo continuo del Jugador (Z o Espacio) - deshabilitado durante Beam Struggle
        if (!this.isStruggleActive && (keys['KeyZ'] || keys['Space'] || keys['shoot'] || keys['touchFiring'])) {
          const aimTarget = this.getClosestAimTarget();
          this.player.shoot(this.bulletSystem, aimTarget);
        }

        // Actualizar Sistema de Enemigos (Oleadas)
        this.enemySystem.update(
          dt,
          this.animTimer,
          this.player.pos,
          this.bulletSystem,
          (x, y, score, itemDrop) => {
            this.score += score;
            this.itemSystem.spawnItem(x, y, itemDrop);
            // Explosión de partículas
            for (let k = 0; k < 6; k++) {
              this.particleSystem.spawnSpark(
                x,
                y,
                (Math.random() - 0.5) * 160,
                (Math.random() - 0.5) * 160,
                Math.random() > 0.5 ? 0x00f2fe : 0xffdd00,
                4,
                0.3,
                true
              );
            }
          }
        );

        // Evaluar si el rayo Master Spark destruye enemigos
        if (this.isLaserFiring) {
          this.enemySystem.checkLaserHits(this.laserSystem, (x, y, score, itemDrop) => {
            this.score += score;
            this.itemSystem.spawnItem(x, y, itemDrop);
          });
        }

        // Actualizar Sistema de Ítems (Power & Points)
        this.itemSystem.update(
          dt,
          this.animTimer,
          this.player.pos,
          this.player.isFocus,
          this.particleSystem,
          (type, value) => {
            if (type === 'power') {
              this.power = Math.min(128, this.power + value);
              this.score += 50;
            } else if (type === 'point') {
              this.score += value;
            } else if (type === 'bomb_frag') {
              this.playerBombs += 1;
              this.score += 2500;
            } else if (type === 'life_frag') {
              this.player.heal(20);
              this.playerLives = this.player.hp > 0 ? 1 : 0;
              this.score += 5000;
            }
          }
        );

        // Actualizar Jefe 1 (Rumia / FirstBoss)
        if (this.boss.isActive) {
          this.boss.update(dt, this.player.pos, this.bulletSystem, this.laserSystem, this.SCALE_X, this.SCALE_Y);
        }

        // Actualizar Muros del Tank (absorben balas enemigas)
        this.wallSystem.update(dt, this.bulletSystem.bullets, () => {
          this.score += 5;
        });

        // Actualizar Balas (movimiento y colisiones)
        this.bulletSystem.update(dt, this.player.pos, this.boss, {
          onPlayerHit: () => {
            this.applyPlayerDamage(10);
          },
          onBossHit: (dmg) => {
            if (this.boss.isActive) {
              this.boss.takeDamage(dmg);
              this.score += 15;
            }
          },
          onPlayerBulletHit: () => {
            this.player.gainSp(this.player.stats.spChargePerHit);
          },
        });
      }
    }

    // ── 5. GESTIÓN DEL CHOQUE DE RAYOS (BEAM STRUGGLE QTE) ────────────────────
    const isAuthoritativeBackend = this.isBackendConnected && this.useBackendBullets;
    const playerLaser = this.laserSystem.lasers.find(l => l.ownerId === 'player');
    const bossMega = this.laserSystem.lasers.find(l => l.ownerId === 'boss' && (l.isMegaBeam || l.maxWidth >= 80));

    // Iniciar Choque cuando ambos rayos converjan e intersecten físicamente
    if (!isAuthoritativeBackend && this.beamStruggle.canStart(playerLaser, bossMega, this.player.pos, this.boss.pos) && playerLaser && bossMega) {
      this.beamStruggle.start(playerLaser, bossMega, this.player.pos, this.boss.pos);
      this.playSound('/assets/sounds/masterspark_fire.wav', 1.0);
      this.playSound('/assets/sounds/gasterfire.wav', 0.9);
      this.applyScreenShake(0.6, 16);
      this.bulletSystem.bullets = []; // Limpieza de balas secundarias para foco dramático
    }

    // Actualizar Pugna de Rayos
    let clashX = this.beamStruggle.clashX;
    const clashY = this.beamStruggle.clashY;

    if (!isAuthoritativeBackend && this.beamStruggle.isAligning) {
      const justFinishedAlign = this.beamStruggle.alignCombatants(this.player, this.boss, dt);

      // Partículas de estela / dash durante el movimiento al centro
      if (Math.random() > 0.3) {
        // Estela cian/azul para el jugador
        this.particleSystem.spawnSpark(
          this.player.pos.x - 10 + (Math.random() - 0.5) * 12,
          this.player.pos.y + (Math.random() - 0.5) * 16,
          -180 - Math.random() * 100,
          (Math.random() - 0.5) * 40,
          0x00f2fe,
          4,
          0.25,
          true
        );
        // Estela dorada/roja para el jefe
        this.particleSystem.spawnSpark(
          this.boss.pos.x + 15 + (Math.random() - 0.5) * 16,
          this.boss.pos.y + (Math.random() - 0.5) * 20,
          180 + Math.random() * 100,
          (Math.random() - 0.5) * 40,
          0xffdd00,
          4.5,
          0.25,
          true
        );
      }

      this.applyScreenShake(0.12, 6);
      clashX = this.beamStruggle.clashX;

      // En el frame que termina la animación de alineación, detonar impacto
      if (justFinishedAlign) {
        this.applyScreenShake(0.65, 24);
        this.playSound('/assets/sounds/masterspark_fire.wav', 1.0);
        this.particleSystem.spawnBurst(clashX, clashY, 24, 260, [0x00f2fe, 0xffdd00, 0xffffff], true);
      }
    } else if (!isAuthoritativeBackend && this.beamStruggle.isActive) {
      this.beamStruggle.lockCombatants(this.player, this.boss, this.animTimer);

      if (this.beamStruggle.applyMashAndPressure(dt, keys)) {
        this.shakeTimer = 0.18;
      }

      clashX = this.beamStruggle.clashX;

      // Sacudida continua de pugna
      this.applyScreenShake(0.35, 10);

      // Evaluación de Ganador / Perdedor
      const winner = this.beamStruggle.evaluateWinner();
      if (winner === 'player') {
        // ── VICTORIA DEL JUGADOR: OVERLOAD SPARK ──
        this.beamStruggle.startResolution('player');
        this.boss.loseFullHealthBar(); // ELIMINA 1 BARRA ENTERA DE VIDA!
        this.applyScreenShake(1.8, 30);
        this.playSound('/assets/sounds/gasterfire.wav', 1.0);
        this.score += 50000;
        this.itemSystem.spawnItemFountain(this.boss.pos.x, this.boss.pos.y, 18);
      } else if (winner === 'boss') {
        // ── DERROTA DEL JUGADOR: APOCALYPSE GOLDEN SPARK (PANTALLA COMPLETA) ──
        this.beamStruggle.startResolution('boss');
        this.applyPlayerDamage(35);
        this.applyScreenShake(2.0, 36);
        this.playSound('/assets/sounds/gasterfire.wav', 1.0);
      }
    } else if (!isAuthoritativeBackend && this.beamStruggle.resolutionTimer > 0) {
      if (this.beamStruggle.tickResolution(dt)) {
        this.boss.isLockedForBeam = false;
        // Extinguir y remover todos los láseres de la pugna para que no quede ningún rayo normal residual debajo
        this.laserSystem.lasers = this.laserSystem.lasers.filter(
          l => l.ownerId !== 'player' && !l.isMegaBeam && l.maxWidth < 80
        );
      }
    } else if (!isAuthoritativeBackend) {
      if (this.boss.isLockedForBeam && !this.bossMegaLaserActive()) {
        this.boss.isLockedForBeam = false;
      }
    }

    // ── 6. ACTUALIZAR LÁSERES Y RENDERIZADO DE CHOQUE ─────────────────────────
    const renderStruggleState = isAuthoritativeBackend
      ? {
          active: !!this.serverStruggleState?.active,
          isAligning: !!this.serverStruggleState?.isAligning,
          balance: this.serverStruggleState?.balance ?? 50,
          clashX: (this.serverStruggleState?.clashX ?? 400) * this.SCALE_X,
          clashY: (this.serverStruggleState?.clashY ?? 300) * this.SCALE_Y,
          playerTipX: this.serverStruggleState?.playerTipX !== undefined ? this.serverStruggleState.playerTipX * this.SCALE_X : undefined,
          bossTipX: this.serverStruggleState?.bossTipX !== undefined ? this.serverStruggleState.bossTipX * this.SCALE_X : undefined,
          vortexX: this.serverStruggleState?.vortexX !== undefined ? this.serverStruggleState.vortexX * this.SCALE_X : undefined,
          vortexY: this.serverStruggleState?.vortexY !== undefined ? this.serverStruggleState.vortexY * this.SCALE_Y : undefined,
          winner: this.serverStruggleState?.winner ?? null,
          resolutionTimer: this.serverStruggleState?.resolutionTimer ?? 0,
        }
      : {
          active: this.beamStruggle.isActive || this.beamStruggle.resolutionTimer > 0,
          isAligning: this.beamStruggle.isAligning,
          balance: this.beamStruggle.balance,
          clashX,
          clashY,
          playerTipX: this.beamStruggle.playerBeamTipX,
          bossTipX: this.beamStruggle.bossBeamTipX,
          vortexX: this.beamStruggle.vortexX,
          vortexY: this.beamStruggle.vortexY,
          winner: this.beamStruggle.winner,
          resolutionTimer: this.beamStruggle.resolutionTimer,
        };

    this.laserSystem.update(
      dt,
      this.animTimer,
      this.laserGraphics,
      this.bulletSystem.bullets,
      this.wallSystem.walls,
      this.player.pos,
      this.boss,
      this.particleSystem,
      {
        onPlayerHit: () => {
          this.applyPlayerDamage(12);
        },
        onBossHit: (dmg) => {
          if (this.boss.isActive) {
            this.boss.takeDamage(dmg);
            this.score += 35;
          }
        },
        onShake: (mag) => {
          this.shakeTimer = mag;
        },
        onSound: (path, vol) => {
          this.playSound(path, vol);
        },
      },
      renderStruggleState
    );

    // 7. Renderizar Partículas FX
    this.particleSystem.update(dt, this.fxGraphics);

    // 8. Renderizar Muros del Tank
    this.wallSystem.render(this.wallGraphics, this.animTimer);

    // 9. Renderizar Balas
    this.bulletSystem.render(this.bulletGraphics);

    // 10. Aplicar Temblor de Pantalla
    this.applyScreenShake(dt, 8);
  }
}
