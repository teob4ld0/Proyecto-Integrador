import type { CharacterClass, RemotePlayer, Bullet, LaserBeam, WallBarrier, SparkParticle, StageState, BossPhase, ItemType, GameDifficulty } from './types';
import type { ServerBullet, ServerLaser, ServerBoss, ServerBeamStruggle, ServerEnemy, ServerItem, ServerCampaign } from '../network/wsClient';
import { BaseStageEngine } from './BaseStageEngine';
import { Player } from './entities/Player';
import { Boss } from './entities/Boss';
import { EnemySystem } from './systems/EnemySystem';
import { ItemSystem } from './systems/ItemSystem';
import { BeamStruggleSystem } from './systems/BeamStruggleSystem';
import { loadStage1Sprites } from './SpriteFactory';
import { NetworkSyncController } from './controllers/NetworkSyncController';

export class GameEngine extends BaseStageEngine {
  public player: Player;
  public boss: Boss;
  public enemySystem: EnemySystem;
  public itemSystem: ItemSystem;
  private networkSync = new NetworkSyncController();

  // Estado del Nivel y HUD
  public stageState: StageState = 'intro';
  public isStageClear: boolean = false;
  public stageBanner: { text: string; subtext: string; timer: number; maxTimer: number } | null = null;
  public bossWarningActive: boolean = false;
  public spellcardBanner: { active: boolean; name: string; timer: number } = { active: false, name: '', timer: 0 };
  private _showBossHpBar: boolean = false;
  private lastBannerText: string = '';

  public get showBossHpBar(): boolean {
    return this._showBossHpBar || (!!this.boss && this.boss.isActive && !this.boss.isDefeated);
  }
  public set showBossHpBar(val: boolean) {
    this._showBossHpBar = val;
  }

  constructor(canvas: HTMLCanvasElement, width: number = 1024, height: number = 576, options?: { difficulty?: string }) {
    super(canvas, width, height);

    this.player = new Player(this.playerContainer, 'DPS');
    this.boss = new Boss(this.enemyContainer, '/assets/sprites/FirstBoss.png', 100);
    this.enemySystem = new EnemySystem(this.enemyContainer);
    this.itemSystem = new ItemSystem(this.playfieldContainer);

    // Cargar sprites de hadas y efectos de forma asíncrona
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
      this.bulletSystem.bullets = [];
      this.applyScreenShake(0.6, 16);
      this.playSound('/assets/sounds/powerup.wav', 0.6);
    };

    this.boss.onDefeated = () => {
      this.stageState = 'stage_clear';
      this.isStageClear = true;
      this.showBossHpBar = false;
      this.applyScreenShake(1.4, 22);
      this.playSound('/assets/sounds/gasterfire.wav', 0.8);
      this.score += 100000;
    };
  }

  // ── Getters y Propiedades Compatibles con el HUD y Rutas ─────────────────────

  public get currentDifficulty(): GameDifficulty {
    return (this.networkSync.campaignState?.difficulty as GameDifficulty) || 'normal';
  }

  public get currentDifficultyLabel(): string {
    return this.networkSync.campaignState?.difficultyLabel || 'Normal';
  }

  public get currentWorld(): number {
    return this.networkSync.campaignState?.world || 1;
  }

  public get currentStage(): number {
    return this.networkSync.campaignState?.stage || 1;
  }

  public get canAdvanceStage(): boolean {
    return this.isStageClear && !(this.networkSync.campaignState?.campaignComplete);
  }

  public get isCampaignComplete(): boolean {
    return !!this.networkSync.campaignState?.campaignComplete;
  }

  public get stageClearTitle(): string {
    return this.networkSync.campaignState?.clearTitle || `WORLD ${this.currentWorld} - STAGE ${this.currentStage} CLEARED!`;
  }

  public get stageClearSubtext(): string {
    return this.networkSync.campaignState?.clearSubtext || 'Boss derrotado.';
  }

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
    return this.networkSync.resolveStruggle(
      true,
      false,
      (s) => !!(s.active || s.isAligning || (s.resolutionTimer ?? 0) > 0)
    );
  }

  public get isStruggleAligning(): boolean {
    return this.networkSync.resolveStruggle(
      true,
      false,
      (s) => !!s.isAligning
    );
  }

  public get struggleBalance(): number {
    return this.networkSync.resolveStruggle(
      true,
      50,
      (s) => s.balance
    );
  }

  public get struggleTimer(): number {
    return this.networkSync.resolveStruggle(
      true,
      0,
      (s) => s.timer
    );
  }

  public get struggleMaxTimer(): number {
    return this.networkSync.resolveStruggle(
      true,
      5,
      (s) => s.maxTimer
    );
  }

  public get struggleWinner(): 'player' | 'boss' | null {
    return this.networkSync.resolveStruggle(
      true,
      null,
      (s) => s.winner ?? null
    );
  }

  public get struggleResolutionTimer(): number {
    return this.networkSync.resolveStruggle(
      true,
      0,
      (s) => s.resolutionTimer ?? 0
    );
  }

  public get isStruggleActive(): boolean {
    return this.networkSync.resolveStruggle(
      true,
      false,
      (s) => !!(s.active || s.isAligning || (s.resolutionTimer ?? 0) > 0)
    );
  }

  public get struggleProgress(): number {
    return this.struggleBalance;
  }

  public get struggleTimeLeft(): number {
    return this.struggleTimer;
  }

  public pushStruggle(amount: number = 3.5): void {
    this.shakeTimer = 0.15;
    this.playSound('/assets/sounds/powerup.wav', 0.4);
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
    return this.networkSync.resolveCombat(this.isBackendConnected, this.player.hp, (s) => s.hp);
  }

  public get playerMaxHp(): number {
    return this.networkSync.resolveCombat(this.isBackendConnected, this.player.maxHp, (s) => s.maxHp);
  }

  public get playerSp(): number {
    return this.networkSync.resolveCombat(this.isBackendConnected, this.player.sp, (s) => s.sp);
  }

  public get playerMaxSp(): number {
    return this.networkSync.resolveCombat(this.isBackendConnected, this.player.maxSp, (s) => s.maxSp);
  }

  public get playerDefensePercent(): number {
    return this.networkSync.resolveCombat(this.isBackendConnected, this.player.defensePercent, (s) => s.defensePercent);
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
    return false;
  }

  public triggerRhombusLasers(pattern: 'both' | 'targeted' = 'both'): void {
    this.boss.triggerRhombusLasers(this.laserSystem, this.player.pos, this.SCALE_X, this.SCALE_Y, pattern);
  }

  public getClosestAimTarget(): { x: number; y: number } {
    if (this.boss.isActive && !this.boss.isDefeated) {
      return this.boss.pos;
    }
    return { x: this.player.pos.x + 800, y: this.player.pos.y };
  }

  public restartStage(): void {
    this.score = 0;
    this.isStageClear = false;
    this.stageState = 'intro';
    this.showBossHpBar = false;
    this.bossWarningActive = false;
    this.spellcardBanner = { active: false, name: '', timer: 0 };
    this.stageBanner = null;
    this.stageTime = 0;
    this.enemySystem.clear();
    this.itemSystem.clear();
    this.bulletSystem.clear();
    this.laserSystem.clear();
    this.wallSystem.clear();
  }

  public goToNextStage(): boolean {
    return false;
  }

  public startBeamStruggleTest(): void {
    this.player.setCharacterClass('Special_Attack');
  }

  public spawnBossDirectly(): void {
    this.stageState = 'boss_battle';
    this.showBossHpBar = true;
  }

  // ── Sincronización de Red ───────────────────────────────────────────────────

  public applyBackendSnapshot(players: RemotePlayer[], myPlayerId: string): void {
    super.applyBackendSnapshot(players, myPlayerId, (x, y) => {
      this.player.targetPos.x = x;
      this.player.targetPos.y = y;
    });
    this.networkSync.applySnapshot(players, myPlayerId, this.player);
  }

  public applyBackendBoss(boss: ServerBoss): void {
    this.networkSync.applyBossSnapshot(boss, this.boss, this.SCALE_X, this.SCALE_Y);
    if (boss.isActive) {
      this.showBossHpBar = true;
    }
    if (boss.isDefeated) {
      this.stageState = 'stage_clear';
      this.isStageClear = true;
      this.showBossHpBar = false;
    }
  }

  public applyBackendStruggle(struggle?: ServerBeamStruggle): void {
    this.networkSync.applyStruggleSnapshot(struggle);
  }

  public applyBackendEnemies(enemies?: ServerEnemy[]): void {
    if (!enemies) return;
    this.enemySystem.applyBackendEnemies(enemies, this.SCALE_X, this.SCALE_Y);
  }

  public applyBackendItems(items?: ServerItem[]): void {
    if (!items) return;
    this.itemSystem.applyBackendItems(items, this.SCALE_X, this.SCALE_Y);
  }

  public applyBackendCampaign(campaign?: ServerCampaign): void {
    if (!campaign) return;
    this.networkSync.applyCampaignSnapshot(campaign);

    if (campaign.stageState) {
      this.stageState = campaign.stageState as StageState;
    }

    if (campaign.bannerText && campaign.bannerText !== this.lastBannerText) {
      this.lastBannerText = campaign.bannerText;
      this.stageBanner = {
        text: campaign.bannerText,
        subtext: campaign.bannerSubtext || '',
        timer: 4.5,
        maxTimer: 4.5,
      };
    }

    if (campaign.stageState === 'boss_warning' && !this.bossWarningActive) {
      this.bossWarningActive = true;
      this.playSound('/assets/sounds/gasterintro.wav', 0.7);
      setTimeout(() => {
        this.bossWarningActive = false;
      }, 3400);
    }
  }

  // ── Loop de Renderizado Principal ──────────────────────────────────────────

  public update(dt: number, keys: Record<string, boolean>, moveVec?: { dx: number; dy: number }): void {
    this.animTimer += dt;

    // Detectar si el Master Spark está en fase de carga o de disparo
    const masterSpark = this.laserSystem.lasers.find(l => l.ownerId === 'player');
    const isMasterSparkCharging = masterSpark && masterSpark.state === 'charging';
    this.isLaserFiring = !!(masterSpark && masterSpark.state === 'firing');

    // Hotkeys para cambio de personaje
    if (keys['Digit1']) this.setCharacterClass('Tank');
    if (keys['Digit2']) this.setCharacterClass('Support');
    if (keys['Digit3']) this.setCharacterClass('DPS');
    if (keys['Digit4']) this.setCharacterClass('Special_Attack');

    // 1. Renderizar Fondo Procedural
    this.backgroundRenderer.update(isMasterSparkCharging ? 0 : dt);

    // 2. Movimiento y Animación del Jugador (Interpolación visual de targetPos)
    const isMovementLocked = this.isStruggleActive;
    this.player.update(
      dt,
      this.animTimer,
      isMovementLocked ? {} : keys,
      isMovementLocked ? { dx: 0, dy: 0 } : moveVec,
      true
    );

    // 3. Efecto de Micro-Pausa & Spotlight al Acumular Poder
    this.spellcardOverlayGraphics.clear();
    if (isMasterSparkCharging) {
      const progress = masterSpark.timer / masterSpark.chargeDuration;

      this.spellcardOverlayGraphics.beginFill(0x020108, 0.65);
      this.spellcardOverlayGraphics.drawRect(0, 0, 1024, 576);
      this.spellcardOverlayGraphics.endFill();

      const px = this.player.pos.x;
      const py = this.player.pos.y;
      const auraRadius = 35 + Math.sin(this.animTimer * 15) * 6;

      this.spellcardOverlayGraphics.lineStyle(3, 0x00f2fe, 0.9);
      this.spellcardOverlayGraphics.drawCircle(px, py, auraRadius);
      this.spellcardOverlayGraphics.lineStyle(1.5, 0xffdd00, 0.8);
      this.spellcardOverlayGraphics.drawCircle(px, py, auraRadius * 1.35);
      this.spellcardOverlayGraphics.lineStyle(0);

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
    }

    // 4. Actualizar Banners de Texto
    if (this.stageBanner) {
      this.stageBanner.timer -= dt;
      if (this.stageBanner.timer <= 0) this.stageBanner = null;
    }

    if (this.spellcardBanner.active) {
      this.spellcardBanner.timer -= dt;
      if (this.spellcardBanner.timer <= 0) this.spellcardBanner.active = false;
    }

    // 5. Boss visual update (render magic circles, refilling animation, position)
    if (this.boss.isActive) {
      this.boss.displayHpPercent = this.boss.maxHp > 0 ? (this.boss.hp / this.boss.maxHp) * 100 : 0;
    }

    // 6. Actualizar Láseres y Renderizado de Choque
    const authoritativeStruggleState = this.networkSync.getStruggleState();
    const renderStruggleState = {
      active: !!authoritativeStruggleState?.active,
      isAligning: !!authoritativeStruggleState?.isAligning,
      balance: authoritativeStruggleState?.balance ?? 50,
      clashX: (authoritativeStruggleState?.clashX ?? 400) * this.SCALE_X,
      clashY: (authoritativeStruggleState?.clashY ?? 300) * this.SCALE_Y,
      playerTipX: authoritativeStruggleState?.playerTipX !== undefined ? authoritativeStruggleState.playerTipX * this.SCALE_X : undefined,
      bossTipX: authoritativeStruggleState?.bossTipX !== undefined ? authoritativeStruggleState.bossTipX * this.SCALE_X : undefined,
      vortexX: authoritativeStruggleState?.vortexX !== undefined ? authoritativeStruggleState.vortexX * this.SCALE_X : undefined,
      vortexY: authoritativeStruggleState?.vortexY !== undefined ? authoritativeStruggleState.vortexY * this.SCALE_Y : undefined,
      winner: authoritativeStruggleState?.winner ?? null,
      resolutionTimer: authoritativeStruggleState?.resolutionTimer ?? 0,
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
        onPlayerHit: () => {},
        onBossHit: () => {},
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

export { GameEngine as Stage1Engine };
