/// <reference lib="webworker" />

import * as planck from 'planck';
import type {
  GameSnapshot,
  ServerBullet,
  ServerWall,
  ServerLaser,
  ServerEnemy,
  ServerItem,
  ServerBoss,
  ServerCampaign,
  ServerBeamStruggle,
} from '../network/wsClient';

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;
const PLAYER_RADIUS = 10;
const PLAYER_SPEED = 380;
const TICK_RATE = 60;
const DT = 1 / TICK_RATE;
const SKILL_COOLDOWN = 1.5;

interface CharacterStats {
  spMax: number;
  hpMax: number;
  bulletDamage: number;
  shotsPerSecond: number;
  bombDamage: number;
  spChargePerHit: number;
  defensePercent: number;
}

const DEFAULT_STATS: CharacterStats = {
  spMax: 1000,
  hpMax: 100,
  bulletDamage: 5,
  shotsPerSecond: 5,
  bombDamage: 750,
  spChargePerHit: 10,
  defensePercent: 50,
};

function normalizeRoleKey(role: string): string {
  const v = String(role || '').toLowerCase();
  if (v === 'tank' || v === 'defense' || v === 'defence') return 'tank';
  if (v === 'support' || v === 'healer') return 'support';
  if (v === 'special_attack' || v === 'attack' || v === 'spatk') return 'special_attack';
  return 'dps';
}

function canonicalRoleName(role: string): string {
  const k = normalizeRoleKey(role);
  if (k === 'tank') return 'Tank';
  if (k === 'support') return 'Support';
  if (k === 'special_attack') return 'Special_Attack';
  return 'DPS';
}

function getCharacterStats(role: string): CharacterStats {
  const k = normalizeRoleKey(role);
  if (k === 'tank') {
    return { ...DEFAULT_STATS, hpMax: 140, defensePercent: 65, shotsPerSecond: 3, bulletDamage: 4, bombDamage: 500, spChargePerHit: 8 };
  }
  if (k === 'support') {
    return { ...DEFAULT_STATS, hpMax: 90, defensePercent: 40, shotsPerSecond: 4, bulletDamage: 4, bombDamage: 600, spChargePerHit: 12 };
  }
  return { ...DEFAULT_STATS };
}

interface SimPlayer {
  id: string;
  body: planck.Body;
  character: string;
  stats: CharacterStats;
  hp: number;
  sp: number;
  angle: number;
  shootCooldown: number;
  skillCooldown: number;
  isBot: boolean;
  input: {
    dx: number;
    dy: number;
    action: string | null;
    focus: boolean;
  };
}

interface SimBullet {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  ttl: number;
  type: 'normal' | 'autoaim' | 'laser';
  damage: number;
  color: number;
}

interface SimWall {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  ttl: number;
}

interface SimLaser {
  id: string;
  ownerId: string;
  direction: 'left' | 'right';
  sourceX: number;
  sourceY: number;
  targetY: number;
  state: 'charging' | 'firing' | 'fading';
  timer: number;
  chargeDuration: number;
  fireDuration: number;
  fadeDuration: number;
  maxWidth: number;
  currentWidth: number;
  dps: number;
  color: number;
  isMegaBeam: boolean;
}

interface SimEnemy {
  id: string;
  type: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  speed: number;
  hp: number;
  maxHp: number;
  radius: number;
  itemDrop: 'power' | 'point' | 'bomb_frag' | 'life_frag';
  trajectory: string;
  attackPattern: string;
  shootInterval: number;
  shootTimer: number;
  spawnTime: number;
  freq: number;
  amp: number;
  phase: number;
  hoverX: number;
  hoverTime: number;
}

interface SimItem {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'power' | 'point' | 'bomb_frag' | 'life_frag';
  magnetizedTo: string | null;
}

const BOSS_SPELLS = [
  { phase: 1, name: 'Twilight Non-Spell "Evening Flutter"', isSpellCard: false },
  { phase: 2, name: 'Night Sign "Night Bird"', isSpellCard: true },
  { phase: 3, name: 'Darkness Non-Spell "Blind Night"', isSpellCard: false },
  { phase: 4, name: 'Darkness Sign "Demarcation"', isSpellCard: true },
  { phase: 5, name: 'Final Eclipse "Moonlight Ray"', isSpellCard: true },
];

const WORLD_NAMES_BY_DIFFICULTY: Record<'normal' | 'difficult' | 'no_mercy', [string, string, string]> = {
  normal: ['Moonlit Forest', 'Scarlet Riverside', 'Celestial Observatory'],
  difficult: ['Infernal Peaks', 'Abyssal Depths', 'Storm Citadel'],
  no_mercy: ['Void Sanctum', 'Shattered Realm', 'Oblivion Edge'],
};

const STAGE_TITLES: [string, string, string] = [
  'Danmaku Vanguard',
  'Crimson Crossfire',
  'Final Spell Duel',
];

const TOTAL_STAGES_PER_DIFFICULTY = 9; // 3 worlds × 3 stages

function getStageMeta(difficulty: 'normal' | 'difficult' | 'no_mercy', stageIndex: number) {
  const clamped = Math.max(0, Math.min(TOTAL_STAGES_PER_DIFFICULTY - 1, stageIndex));
  const worldIdx = Math.floor(clamped / 3);
  const stageIdx = clamped % 3;
  const world = worldIdx + 1;
  const stage = stageIdx + 1;
  const worldName = WORLD_NAMES_BY_DIFFICULTY[difficulty][worldIdx];
  const stageTitle = STAGE_TITLES[stageIdx];
  const diffLabel = difficulty === 'no_mercy' ? 'NO MERCY' : difficulty === 'difficult' ? 'DIFFICULT' : 'NORMAL';
  const isFinal = clamped >= TOTAL_STAGES_PER_DIFFICULTY - 1;

  return {
    world,
    stage,
    worldName,
    stageTitle,
    bannerText: `WORLD ${world}-${stage} · ${worldName.toUpperCase()}`,
    bannerSubtext: `${diffLabel} — ${stageTitle}`,
    clearTitle: isFinal ? `${diffLabel} CAMPAIGN COMPLETE!` : `WORLD ${world} - STAGE ${stage} CLEARED!`,
    clearSubtext: isFinal
      ? '¡El escuadrón Danmakrew conquistó todos los mundos!'
      : `${worldName} · Preparando siguiente sector...`,
    bossBaseHp: 110 + worldIdx * 30 + stageIdx * 18,
  };
}

const SPAWN_POSITIONS = [
  { x: 110, y: 240 },
  { x: 110, y: 360 },
  { x: 165, y: 180 },
  { x: 165, y: 420 },
];

class DanmakrewSimulationWorker {
  private world!: planck.World;
  private players = new Map<string, SimPlayer>();
  private bullets: SimBullet[] = [];
  private walls: SimWall[] = [];
  private lasers: SimLaser[] = [];
  private enemies: SimEnemy[] = [];
  private items: SimItem[] = [];

  private nextBulletId = 1;
  private nextEntityId = 1;
  private tick = 0;
  private stageTime = 0;
  private stageIndex = 0;
  private difficulty: 'normal' | 'difficult' | 'no_mercy' = 'normal';
  private stageState: 'intro' | 'waves' | 'boss_warning' | 'boss_battle' | 'stage_clear' = 'intro';
  private triggeredEvents = new Set<string>();
  private myPlayerId = 'player-local-host';
  private loopTimer: ReturnType<typeof setInterval> | null = null;

  private boss = {
    x: 650,
    y: 300,
    hp: 110,
    maxHp: 110,
    phase: 1,
    remainingStocks: 4,
    spellcardName: BOSS_SPELLS[0].name,
    isSpellCard: false,
    isActive: false,
    isDefeated: false,
    isRefilling: false,
    refillTimer: 0,
    isLockedForBeam: false,
    attackTimer: 0,
    laserTimer: 2.5,
    moveTimer: 0,
  };

  private struggle: ServerBeamStruggle = {
    active: false,
    isAligning: false,
    winner: null,
    timer: 0,
    maxTimer: 5.0,
    balance: 50,
    resolutionTimer: 0,
    clashX: 400,
    clashY: 300,
  };

  private alignTimer = 0;

  public init(
    roomId: string,
    playerId: string,
    classId: string,
    difficulty: string,
    world: number = 1,
    stage: number = 1
  ): void {
    this.stop();
    this.myPlayerId = playerId || 'player-local-host';
    this.difficulty = difficulty === 'difficult' || difficulty === 'no_mercy' ? difficulty : 'normal';
    const w = Math.max(1, Math.min(3, Math.floor(Number(world) || 1)));
    const s = Math.max(1, Math.min(3, Math.floor(Number(stage) || 1)));
    this.stageIndex = (w - 1) * 3 + (s - 1);
    this.createPhysicsWorld();
    this.players.clear();
    this.addPlayer(this.myPlayerId, classId, false);
    this.resetStageRuntime();

    self.postMessage({
      type: 'INIT_ACK',
      roomId,
      myPlayerId: this.myPlayerId,
    });

    this.loopTimer = setInterval(() => {
      this.step(DT);
      self.postMessage({
        type: 'SNAPSHOT',
        payload: this.buildSnapshot(),
      });
    }, 1000 / TICK_RATE);
  }

  public stop(): void {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  private createPhysicsWorld(): void {
    this.world = planck.World({ gravity: planck.Vec2(0, 0) });
    const bounds = this.world.createBody({ type: 'static' });
    const corners = [
      [planck.Vec2(0, 0), planck.Vec2(WORLD_WIDTH, 0)],
      [planck.Vec2(WORLD_WIDTH, 0), planck.Vec2(WORLD_WIDTH, WORLD_HEIGHT)],
      [planck.Vec2(WORLD_WIDTH, WORLD_HEIGHT), planck.Vec2(0, WORLD_HEIGHT)],
      [planck.Vec2(0, WORLD_HEIGHT), planck.Vec2(0, 0)],
    ];
    for (const [v1, v2] of corners) {
      bounds.createFixture({ shape: planck.Edge(v1, v2), friction: 0, restitution: 0 });
    }
  }

  public addPlayer(playerId: string, role: string, isBot: boolean = false): void {
    if (this.players.has(playerId)) {
      this.setPlayerRole(playerId, role);
      return;
    }
    const canonical = canonicalRoleName(role);
    const stats = getCharacterStats(canonical);
    const spawn = SPAWN_POSITIONS[this.players.size % SPAWN_POSITIONS.length];
    const body = this.world.createBody({
      type: 'dynamic',
      position: planck.Vec2(spawn.x, spawn.y),
      fixedRotation: true,
      linearDamping: 0,
    });
    body.createFixture({
      shape: planck.Circle(PLAYER_RADIUS),
      density: 1,
      friction: 0,
      restitution: 0,
    });

    this.players.set(playerId, {
      id: playerId,
      body,
      character: canonical,
      stats,
      hp: stats.hpMax,
      sp: stats.spMax,
      angle: 0,
      shootCooldown: 0,
      skillCooldown: 0,
      isBot,
      input: { dx: 0, dy: 0, action: null, focus: false },
    });
  }

  public setPlayerRole(playerId: string, role: string): void {
    const p = this.players.get(playerId);
    if (!p) return;
    const canonical = canonicalRoleName(role);
    const stats = getCharacterStats(canonical);
    p.character = canonical;
    p.stats = stats;
    p.hp = stats.hpMax;
    p.sp = stats.spMax;
  }

  public setPlayerInput(playerId: string, dx: number, dy: number, action: string | null, focus: boolean): void {
    const p = this.players.get(playerId);
    if (!p) return;
    p.input = {
      dx: Number.isFinite(dx) ? Math.max(-1, Math.min(1, dx)) : 0,
      dy: Number.isFinite(dy) ? Math.max(-1, Math.min(1, dy)) : 0,
      action,
      focus: Boolean(focus),
    };
  }

  public triggerSkill(playerId: string): void {
    const p = this.players.get(playerId);
    if (!p) return;
    const roleKey = normalizeRoleKey(p.character);
    const skillAction = roleKey === 'tank' ? 'wall' : roleKey === 'special_attack' ? 'laser' : 'special';
    this.executePlayerSkill(p, skillAction);
  }

  public pushStruggle(): void {
    if (this.struggle.active) {
      this.struggle.balance = Math.min(100, this.struggle.balance + 4.2);
    }
  }

  public spawnBossNow(): void {
    this.enemies = [];
    this.triggeredEvents.add('w1');
    this.triggeredEvents.add('w2');
    this.triggeredEvents.add('w3');
    this.triggeredEvents.add('w4');
    this.triggeredEvents.add('w5');
    this.triggeredEvents.add('warn');
    this.triggeredEvents.add('boss');
    this.activateBoss();
  }

  public startBeamStruggleTest(): void {
    const me = this.players.get(this.myPlayerId);
    if (!me) return;
    this.setPlayerRole(this.myPlayerId, 'Special_Attack');
    if (!this.boss.isActive || this.boss.isDefeated) {
      this.spawnBossNow();
    }
    this.bullets = [];
    this.lasers = [];
    me.body.setPosition(planck.Vec2(140, 300));
    this.boss.x = 660;
    this.boss.y = 300;
    this.boss.isLockedForBeam = true;

    this.spawnLaser(me.id, 'right', 156, 300, 300, 0.25, 4.5, 0.25, 32, 0x00f0ff, false);
    this.spawnLaser('boss', 'left', 625, 300, 300, 0.25, 4.5, 0.25, 76, 0xffdd00, true);
  }

  public advanceStage(): boolean {
    if (this.stageIndex >= TOTAL_STAGES_PER_DIFFICULTY - 1) return false;
    this.stageIndex++;
    this.resetStageRuntime();
    return true;
  }

  public restartStage(): void {
    this.resetStageRuntime();
    let idx = 0;
    for (const [, p] of this.players) {
      p.hp = p.stats.hpMax;
      p.sp = p.stats.spMax;
      p.shootCooldown = 0;
      p.skillCooldown = 0;
      const spawn = SPAWN_POSITIONS[idx % SPAWN_POSITIONS.length];
      p.body.setPosition(planck.Vec2(spawn.x, spawn.y));
      p.body.setLinearVelocity(planck.Vec2(0, 0));
      idx++;
    }
  }

  private getDifficultyMult(): number {
    if (this.difficulty === 'no_mercy') return 1.5;
    if (this.difficulty === 'difficult') return 1.25;
    return 1.0;
  }

  private resetStageRuntime(): void {
    this.bullets = [];
    this.walls = [];
    this.lasers = [];
    this.enemies = [];
    this.items = [];
    this.triggeredEvents.clear();
    this.stageTime = 0;
    this.stageState = 'intro';
    this.struggle = {
      active: false,
      isAligning: false,
      winner: null,
      timer: 0,
      maxTimer: 5.0,
      balance: 50,
      resolutionTimer: 0,
      clashX: 400,
      clashY: 300,
    };

    const cfg = getStageMeta(this.difficulty, this.stageIndex);
    const hp = Math.round(cfg.bossBaseHp * this.getDifficultyMult());
    this.boss = {
      x: 650,
      y: 300,
      hp,
      maxHp: hp,
      phase: 1,
      remainingStocks: 4,
      spellcardName: BOSS_SPELLS[0].name,
      isSpellCard: false,
      isActive: false,
      isDefeated: false,
      isRefilling: false,
      refillTimer: 0,
      isLockedForBeam: false,
      attackTimer: 0,
      laserTimer: 3.0,
      moveTimer: 0,
    };
  }

  private activateBoss(): void {
    const cfg = getStageMeta(this.difficulty, this.stageIndex);
    const hp = Math.round(cfg.bossBaseHp * this.getDifficultyMult());
    this.stageState = 'boss_battle';
    this.boss.isActive = true;
    this.boss.isDefeated = false;
    this.boss.phase = 1;
    this.boss.remainingStocks = 4;
    this.boss.hp = hp;
    this.boss.maxHp = hp;
    this.boss.spellcardName = BOSS_SPELLS[0].name;
    this.boss.isSpellCard = BOSS_SPELLS[0].isSpellCard;
  }

  private step(dt: number): void {
    this.tick++;
    this.stageTime += dt;

    this.updateTimeline();
    this.updatePlayers(dt);
    this.world.step(dt);
    this.updateBoss(dt);
    this.updateEnemies(dt);
    this.updateItems(dt);
    this.updateBullets(dt);
    this.updateLasers(dt);
    this.updateBeamStruggle(dt);
    this.updateWalls(dt);
  }

  private updateTimeline(): void {
    const fireOnce = (key: string, at: number, fn: () => void) => {
      if (this.stageTime >= at && !this.triggeredEvents.has(key)) {
        this.triggeredEvents.add(key);
        fn();
      }
    };

    fireOnce('banner', 0.1, () => {
      this.stageState = 'waves';
    });
    fireOnce('w1', 0.4, () => this.spawnWave(1));
    fireOnce('w2', 6.5, () => this.spawnWave(2));
    fireOnce('w3', 13.0, () => this.spawnWave(3));
    fireOnce('w4', 20.0, () => this.spawnWave(4));
    fireOnce('w5', 27.0, () => this.spawnWave(5));
    fireOnce('warn', 33.5, () => {
      if (!this.boss.isActive && !this.boss.isDefeated) {
        this.stageState = 'boss_warning';
      }
    });
    fireOnce('boss', 36.5, () => {
      if (!this.boss.isActive && !this.boss.isDefeated) {
        this.activateBoss();
      }
    });
  }

  private getAutoAimTargets(): Array<{ x: number; y: number }> {
    const targets: Array<{ x: number; y: number }> = [];
    for (const e of this.enemies) {
      if (e.hp > 0) targets.push({ x: e.x, y: e.y });
    }
    if (this.boss.isActive && !this.boss.isDefeated && this.boss.hp > 0) {
      targets.push({ x: this.boss.x, y: this.boss.y });
    }
    if (targets.length === 0) {
      targets.push({ x: 700, y: 300 });
    }
    return targets;
  }

  private spawnAutoAimShot(ownerId: string, x: number, y: number, speed: number, damage: number): void {
    const targets = this.getAutoAimTargets();
    let best = targets[0];
    let bestDistSq = Infinity;
    for (const t of targets) {
      const d = (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y);
      if (d < bestDistSq) {
        bestDistSq = d;
        best = t;
      }
    }
    const angle = Math.atan2(best.y - y, best.x - x);
    this.bullets.push({
      id: this.nextBulletId++,
      ownerId,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 4,
      ttl: 2.6,
      type: 'autoaim',
      damage,
      color: 0xff00ff,
    });
  }

  private spawnLaser(
    ownerId: string,
    direction: 'left' | 'right',
    sourceX: number,
    sourceY: number,
    targetY: number,
    chargeDuration: number,
    fireDuration: number,
    fadeDuration: number,
    maxWidth: number,
    color: number,
    isMegaBeam: boolean
  ): void {
    this.lasers.push({
      id: `laser_${this.nextEntityId++}`,
      ownerId,
      direction,
      sourceX,
      sourceY,
      targetY,
      state: chargeDuration > 0 ? 'charging' : 'firing',
      timer: 0,
      chargeDuration,
      fireDuration,
      fadeDuration,
      maxWidth,
      currentWidth: chargeDuration > 0 ? 4 : maxWidth,
      dps: 50,
      color,
      isMegaBeam,
    });
  }

  private executePlayerSkill(p: SimPlayer, action: string): void {
    if (p.skillCooldown > 0 || p.hp <= 0) return;
    const pos = p.body.getPosition();
    const roleKey = normalizeRoleKey(p.character);

    if ((action === 'wall' || (roleKey === 'tank' && action === 'special')) && p.sp >= 250) {
      this.walls.push({
        id: `wall_${this.nextEntityId++}`,
        ownerId: p.id,
        x: pos.x + 24,
        y: pos.y,
        vx: 40,
        vy: 0,
        width: 14,
        height: 48,
        hp: 25,
        maxHp: 25,
        ttl: 1.0,
      });
      p.skillCooldown = SKILL_COOLDOWN;
      p.sp = Math.max(0, p.sp - 250);
      return;
    }

    if ((action === 'laser' || (roleKey === 'special_attack' && action === 'special')) && p.sp >= 500) {
      this.spawnLaser(p.id, 'right', pos.x + 16, pos.y, pos.y, 0.3, 1.1, 0.2, 30, 0x00f0ff, false);
      p.skillCooldown = SKILL_COOLDOWN * 2;
      p.sp = Math.max(0, p.sp - 500);
      return;
    }

    if (roleKey === 'support' && action === 'special' && p.sp >= 400) {
      for (const offsetY of [-18, -10, -4, 4, 10, 18]) {
        this.spawnAutoAimShot(p.id, pos.x + 16, pos.y + offsetY, 700, p.stats.bulletDamage * 1.5);
      }
      for (const [, ally] of this.players) {
        if (ally.hp > 0) {
          ally.hp = Math.min(ally.stats.hpMax, ally.hp + 25);
        }
      }
      p.skillCooldown = SKILL_COOLDOWN * 1.5;
      p.sp = Math.max(0, p.sp - 400);
      return;
    }

    if (roleKey === 'dps' && action === 'special' && p.sp >= 350) {
      for (const a of [-0.21, -0.14, -0.07, -0.02, 0.02, 0.07, 0.14, 0.21]) {
        this.bullets.push({
          id: this.nextBulletId++,
          ownerId: p.id,
          x: pos.x + 18,
          y: pos.y,
          vx: Math.cos(a) * 840,
          vy: Math.sin(a) * 840,
          radius: 5,
          ttl: 2.5,
          type: 'normal',
          damage: p.stats.bulletDamage * 2,
          color: 0x00f2fe,
        });
      }
      p.skillCooldown = SKILL_COOLDOWN;
      p.sp = Math.max(0, p.sp - 350);
    }
  }

  private updatePlayers(dt: number): void {
    const locked = this.struggle.active || !!this.struggle.isAligning;

    for (const [, p] of this.players) {
      if (p.hp <= 0) {
        p.body.setLinearVelocity(planck.Vec2(0, 0));
        continue;
      }

      if (p.isBot) {
        // Escort AI for local demo companions
        const pos = p.body.getPosition();
        const desiredY = 300 + Math.sin(this.stageTime * 1.8 + pos.x * 0.02) * 140;
        p.input.dx = Math.cos(this.stageTime * 1.1) * 0.25;
        p.input.dy = Math.max(-1, Math.min(1, (desiredY - pos.y) / 80));
        p.input.action = 'shoot';
      }

      p.shootCooldown = Math.max(0, p.shootCooldown - dt);
      p.skillCooldown = Math.max(0, p.skillCooldown - dt);
      p.sp = Math.min(p.stats.spMax, p.sp + dt * 45);

      const { dx, dy, action, focus } = p.input;
      if (!locked) {
        const len = Math.hypot(dx, dy);
        const nx = len > 1 ? dx / len : dx;
        const ny = len > 1 ? dy / len : dy;
        const speed = focus ? PLAYER_SPEED * 0.45 : PLAYER_SPEED;
        p.body.setLinearVelocity(planck.Vec2(nx * speed, ny * speed));
        if (nx !== 0 || ny !== 0) p.angle = Math.atan2(ny, nx);
      } else {
        p.body.setLinearVelocity(planck.Vec2(0, 0));
      }

      if (action === 'struggle_push') {
        this.pushStruggle();
      } else if (action === 'wall' || action === 'laser' || action === 'special') {
        this.executePlayerSkill(p, action);
      } else if (action === 'shoot' && p.shootCooldown <= 0 && !locked) {
        const pos = p.body.getPosition();
        const roleKey = normalizeRoleKey(p.character);
        if (roleKey === 'support') {
          this.spawnAutoAimShot(p.id, pos.x + 16, pos.y, 650, p.stats.bulletDamage);
        } else if (roleKey === 'tank') {
          this.bullets.push({
            id: this.nextBulletId++,
            ownerId: p.id,
            x: pos.x + 16,
            y: pos.y,
            vx: 600,
            vy: 0,
            radius: 5,
            ttl: 2.5,
            type: 'normal',
            damage: p.stats.bulletDamage,
            color: 0x00ff88,
          });
        } else {
          for (const offsetY of [-6, 6]) {
            this.bullets.push({
              id: this.nextBulletId++,
              ownerId: p.id,
              x: pos.x + 16,
              y: pos.y + offsetY,
              vx: 750,
              vy: 0,
              radius: 4,
              ttl: 2.5,
              type: 'normal',
              damage: p.stats.bulletDamage,
              color: 0x00f2fe,
            });
          }
        }
        p.shootCooldown = 1 / Math.max(0.1, p.stats.shotsPerSecond);
      }
    }
  }

  private getAveragePlayerPos(): { x: number; y: number } {
    let sx = 0;
    let sy = 0;
    let c = 0;
    for (const [, p] of this.players) {
      if (p.hp <= 0) continue;
      const pos = p.body.getPosition();
      sx += pos.x;
      sy += pos.y;
      c++;
    }
    return c > 0 ? { x: sx / c, y: sy / c } : { x: 120, y: 300 };
  }

  private spawnWave(waveId: number): void {
    const mult = this.getDifficultyMult();
    if (waveId === 1) {
      for (let i = 0; i < 6; i++) {
        this.enemies.push({
          id: `en_${this.nextEntityId++}`,
          type: 'green_fairy',
          x: WORLD_WIDTH + 45 + i * 58,
          y: 170,
          startX: WORLD_WIDTH + 45 + i * 58,
          startY: 170,
          speed: 130,
          hp: Math.round(14 * mult),
          maxHp: Math.round(14 * mult),
          radius: 16,
          itemDrop: i % 2 === 0 ? 'power' : 'point',
          trajectory: 'double_helix',
          attackPattern: 'aimed_single',
          shootInterval: 1.8,
          shootTimer: 0.4 * i,
          spawnTime: 0,
          freq: 3.2,
          amp: 70,
          phase: i * 0.4,
          hoverX: 550,
          hoverTime: 3.5,
        });
        this.enemies.push({
          id: `en_${this.nextEntityId++}`,
          type: 'yellow_fairy',
          x: WORLD_WIDTH + 45 + i * 58,
          y: 430,
          startX: WORLD_WIDTH + 45 + i * 58,
          startY: 430,
          speed: 130,
          hp: Math.round(16 * mult),
          maxHp: Math.round(16 * mult),
          radius: 16,
          itemDrop: 'power',
          trajectory: 'double_helix',
          attackPattern: 'helix_stream',
          shootInterval: 1.9,
          shootTimer: 0.3 * i,
          spawnTime: 0,
          freq: 3.2,
          amp: 70,
          phase: i * 0.4 + Math.PI,
          hoverX: 550,
          hoverTime: 3.5,
        });
      }
    } else if (waveId === 2) {
      for (let i = 0; i < 3; i++) {
        for (const top of [true, false]) {
          const sy = top ? 110 + i * 24 : 490 - i * 24;
          this.enemies.push({
            id: `en_${this.nextEntityId++}`,
            type: 'red_fairy',
            x: WORLD_WIDTH + 50 + i * 68,
            y: sy,
            startX: WORLD_WIDTH + 50 + i * 68,
            startY: sy,
            speed: 150,
            hp: Math.round(26 * mult),
            maxHp: Math.round(26 * mult),
            radius: 17,
            itemDrop: top ? 'power' : 'point',
            trajectory: 'hover_retreat',
            attackPattern: 'flower_burst',
            shootInterval: 1.25,
            shootTimer: 0.2,
            spawnTime: 0,
            freq: 2.5,
            amp: 16,
            phase: 0,
            hoverX: 575 - i * 32,
            hoverTime: 3.8,
          });
        }
      }
    } else if (waveId === 3) {
      this.enemies.push({
        id: `en_${this.nextEntityId++}`,
        type: 'big_fairy',
        x: WORLD_WIDTH + 50,
        y: 300,
        startX: WORLD_WIDTH + 50,
        startY: 300,
        speed: 75,
        hp: Math.round(125 * mult),
        maxHp: Math.round(125 * mult),
        radius: 30,
        itemDrop: 'life_frag',
        trajectory: 'hover_retreat',
        attackPattern: 'star_rings',
        shootInterval: 0.9,
        shootTimer: 0,
        spawnTime: 0,
        freq: 2.0,
        amp: 20,
        phase: 0,
        hoverX: 535,
        hoverTime: 7.0,
      });
    } else if (waveId === 4) {
      for (const [idx, sy] of [120, 210, 390, 480].entries()) {
        this.enemies.push({
          id: `en_${this.nextEntityId++}`,
          type: 'purple_fairy',
          x: WORLD_WIDTH + 45 + idx * 42,
          y: sy,
          startX: WORLD_WIDTH + 45 + idx * 42,
          startY: sy,
          speed: 125,
          hp: Math.round(34 * mult),
          maxHp: Math.round(34 * mult),
          radius: 17,
          itemDrop: idx % 2 === 0 ? 'bomb_frag' : 'power',
          trajectory: 'hover_retreat',
          attackPattern: 'ring_burst',
          shootInterval: 1.1,
          shootTimer: 0.25 * idx,
          spawnTime: 0,
          freq: 2.4,
          amp: 15,
          phase: idx,
          hoverX: 555 - (idx % 2) * 40,
          hoverTime: 4.2,
        });
      }
    } else if (waveId === 5) {
      for (let i = 0; i < 8; i++) {
        const isTop = i % 2 === 0;
        const sy = isTop ? 40 : WORLD_HEIGHT - 40;
        this.enemies.push({
          id: `en_${this.nextEntityId++}`,
          type: 'green_fairy',
          x: WORLD_WIDTH + 40 + i * 48,
          y: sy,
          startX: WORLD_WIDTH + 40 + i * 48,
          startY: sy,
          speed: 175,
          hp: Math.round(18 * mult),
          maxHp: Math.round(18 * mult),
          radius: 16,
          itemDrop: i % 3 === 0 ? 'power' : 'point',
          trajectory: isTop ? 'cross_top' : 'cross_bottom',
          attackPattern: 'aimed_single',
          shootInterval: 0.95,
          shootTimer: 0.15 * i,
          spawnTime: 0,
          freq: 1.8,
          amp: 140,
          phase: 0,
          hoverX: 500,
          hoverTime: 3.0,
        });
      }
    }
  }

  private updateEnemies(dt: number): void {
    const target = this.getAveragePlayerPos();

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.spawnTime += dt;
      const t = e.spawnTime;

      if (e.trajectory === 'double_helix') {
        e.x -= e.speed * dt;
        e.y = e.startY + e.amp * Math.sin(e.freq * t + e.phase);
      } else if (e.trajectory === 'hover_retreat') {
        if (e.x > e.hoverX) e.x -= e.speed * dt;
        else if (t > e.hoverTime) e.x -= e.speed * 0.55 * dt;
        e.y = e.startY + Math.sin(t * 2.5) * 15;
      } else if (e.trajectory === 'cross_top') {
        e.x -= e.speed * dt;
        e.y = e.startY + Math.abs(Math.sin(t * 1.8)) * 150;
      } else if (e.trajectory === 'cross_bottom') {
        e.x -= e.speed * dt;
        e.y = e.startY - Math.abs(Math.sin(t * 1.8)) * 150;
      } else {
        e.x -= e.speed * dt;
      }

      if (e.x < -60 || e.y < -70 || e.y > WORLD_HEIGHT + 70) {
        this.enemies.splice(i, 1);
        continue;
      }

      e.shootTimer += dt;
      if (e.shootTimer >= e.shootInterval) {
        e.shootTimer = 0;
        const aim = Math.atan2(target.y - e.y, target.x - e.x);
        if (e.attackPattern === 'aimed_single') {
          this.spawnEnemyBullet(e.x, e.y, aim, 210, 4, 0xff2b5b);
        } else if (e.attackPattern === 'helix_stream') {
          this.spawnEnemyBullet(e.x, e.y, aim + 0.18, 220, 4, 0xffae00);
          this.spawnEnemyBullet(e.x, e.y, aim - 0.18, 220, 4, 0xffae00);
        } else if (e.attackPattern === 'flower_burst') {
          for (let k = 0; k < 5; k++) {
            this.spawnEnemyBullet(e.x, e.y, aim + (Math.PI * 2 * k) / 5, 180, 4, 0xff2b5b);
          }
        } else if (e.attackPattern === 'ring_burst') {
          for (let k = 0; k < 10; k++) {
            this.spawnEnemyBullet(e.x, e.y, (Math.PI * 2 * k) / 10, 165, 4, 0xa855f7);
          }
        } else if (e.attackPattern === 'star_rings') {
          for (let k = 0; k < 14; k++) {
            this.spawnEnemyBullet(e.x, e.y, t * 2 + (Math.PI * 2 * k) / 14, 150, 5, 0x3b82f6);
          }
        }
      }
    }
  }

  private spawnEnemyBullet(x: number, y: number, angle: number, speed: number, radius: number, color: number): void {
    this.bullets.push({
      id: this.nextBulletId++,
      ownerId: 'boss',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      ttl: 4.0,
      type: 'normal',
      damage: 5,
      color,
    });
  }

  private updateBoss(dt: number): void {
    if (!this.boss.isActive || this.boss.isDefeated) return;

    if (this.boss.isRefilling) {
      this.boss.refillTimer -= dt;
      this.boss.hp = Math.min(this.boss.maxHp, this.boss.hp + this.boss.maxHp * dt * 1.4);
      if (this.boss.refillTimer <= 0) {
        this.boss.isRefilling = false;
        this.boss.hp = this.boss.maxHp;
      }
      return;
    }

    if (!this.boss.isLockedForBeam && !this.struggle.active && !this.struggle.isAligning) {
      this.boss.moveTimer += dt;
      this.boss.x = 640 + Math.cos(this.boss.moveTimer * 0.9) * 35;
      this.boss.y = 300 + Math.sin(this.boss.moveTimer * 1.25) * 120;
    }

    const hasMega = this.lasers.some((l) => l.ownerId === 'boss' && l.isMegaBeam);
    if (this.boss.isLockedForBeam && !hasMega) {
      this.boss.isLockedForBeam = false;
    }

    if (this.struggle.active || this.struggle.isAligning) return;

    const target = this.getAveragePlayerPos();
    this.boss.attackTimer += dt;
    this.boss.laserTimer -= dt;

    const interval = this.boss.phase >= 4 ? 0.55 : 0.75;
    if (this.boss.attackTimer >= interval) {
      this.boss.attackTimer = 0;
      const baseAngle = Math.atan2(target.y - this.boss.y, target.x - this.boss.x);
      const count = 5 + this.boss.phase * 2;
      for (let i = 0; i < count; i++) {
        const spread = ((i - (count - 1) / 2) / count) * 1.3;
        this.spawnEnemyBullet(
          this.boss.x - 24,
          this.boss.y,
          baseAngle + spread,
          210 + this.boss.phase * 18,
          5,
          this.boss.isSpellCard ? 0xa855f7 : 0xff2b5b
        );
      }
    }

    if (this.boss.laserTimer <= 0) {
      this.boss.laserTimer = this.boss.phase >= 3 ? 5.2 : 6.2;
      if (this.boss.phase >= 3) {
        this.boss.isLockedForBeam = true;
        this.spawnLaser('boss', 'left', this.boss.x - 28, this.boss.y, this.boss.y, 0.75, 1.8, 0.3, 72, 0xffdd00, true);
      } else {
        this.spawnLaser('boss', 'left', this.boss.x - 24, this.boss.y - 48, this.boss.y - 48, 0.65, 1.1, 0.25, 32, 0xff2b5b, false);
        this.spawnLaser('boss', 'left', this.boss.x - 24, this.boss.y + 48, this.boss.y + 48, 0.65, 1.1, 0.25, 32, 0xff2b5b, false);
      }
    }
  }

  private damageBoss(amount: number): void {
    if (!this.boss.isActive || this.boss.isDefeated || this.boss.isRefilling) return;
    this.boss.hp = Math.max(0, this.boss.hp - amount);
    if (this.boss.hp <= 0) {
      this.advanceBossPhaseOrDefeat();
    }
  }

  private advanceBossPhaseOrDefeat(): void {
    // Clear enemy bullets on phase break
    this.bullets = this.bullets.filter((b) => b.ownerId !== 'boss');
    if (this.boss.remainingStocks > 0) {
      this.boss.remainingStocks--;
      this.boss.phase = Math.min(5, this.boss.phase + 1);
      const spell = BOSS_SPELLS[this.boss.phase - 1] || BOSS_SPELLS[BOSS_SPELLS.length - 1];
      this.boss.spellcardName = spell.name;
      this.boss.isSpellCard = spell.isSpellCard;
      this.boss.isRefilling = true;
      this.boss.refillTimer = 0.85;
      this.spawnItemFountain(this.boss.x, this.boss.y, 8);
    } else {
      this.boss.isDefeated = true;
      this.boss.isActive = false;
      this.stageState = 'stage_clear';
      this.lasers = [];
      this.spawnItemFountain(this.boss.x, this.boss.y, 18);
    }
  }

  private spawnItemFountain(x: number, y: number, count: number): void {
    const types: Array<'power' | 'point' | 'bomb_frag' | 'life_frag'> = ['power', 'point', 'bomb_frag', 'life_frag'];
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count;
      this.items.push({
        id: `item_${this.nextEntityId++}`,
        x: x + Math.cos(a) * 20,
        y: y + Math.sin(a) * 20,
        vx: -90 + Math.cos(a) * 40,
        vy: Math.sin(a) * 55,
        type: types[i % types.length],
        magnetizedTo: null,
      });
    }
  }

  private updateItems(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      let closestPlayer: SimPlayer | null = null;
      let closestDist = Infinity;
      for (const [, p] of this.players) {
        if (p.hp <= 0) continue;
        const pos = p.body.getPosition();
        const dist = Math.hypot(pos.x - item.x, pos.y - item.y);
        if (dist < closestDist) {
          closestDist = dist;
          closestPlayer = p;
        }
        // Upper-right / collection line auto-magnetize or proximity magnetize
        if (dist < 110 || pos.x > 520) {
          item.magnetizedTo = p.id;
        }
      }

      if (item.magnetizedTo) {
        const targetPlayer = this.players.get(item.magnetizedTo) || closestPlayer;
        if (targetPlayer && targetPlayer.hp > 0) {
          const pos = targetPlayer.body.getPosition();
          const a = Math.atan2(pos.y - item.y, pos.x - item.x);
          item.vx = Math.cos(a) * 480;
          item.vy = Math.sin(a) * 480;
        }
      } else {
        item.vx = Math.max(-140, item.vx - 80 * dt);
        item.vy *= 0.96;
      }

      item.x += item.vx * dt;
      item.y += item.vy * dt;

      if (closestPlayer && closestDist < 24) {
        if (item.type === 'power') closestPlayer.sp = Math.min(closestPlayer.stats.spMax, closestPlayer.sp + 50);
        else if (item.type === 'point') closestPlayer.sp = Math.min(closestPlayer.stats.spMax, closestPlayer.sp + 30);
        else if (item.type === 'bomb_frag') closestPlayer.sp = Math.min(closestPlayer.stats.spMax, closestPlayer.sp + 160);
        else if (item.type === 'life_frag') closestPlayer.hp = Math.min(closestPlayer.stats.hpMax, closestPlayer.hp + 25);
        this.items.splice(i, 1);
        continue;
      }

      if (item.x < -50 || item.x > WORLD_WIDTH + 80 || item.y < -60 || item.y > WORLD_HEIGHT + 60) {
        this.items.splice(i, 1);
      }
    }
  }

  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;

      if (b.ttl <= 0 || b.x < -30 || b.x > WORLD_WIDTH + 30 || b.y < -30 || b.y > WORLD_HEIGHT + 30) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.ownerId === 'boss') {
        // Enemy bullet vs players
        let hitPlayer = false;
        for (const [, p] of this.players) {
          if (p.hp <= 0) continue;
          const pos = p.body.getPosition();
          const hitRadius = p.input.focus ? 5 : PLAYER_RADIUS;
          const dx = b.x - pos.x;
          const dy = b.y - pos.y;
          if (dx * dx + dy * dy <= (hitRadius + b.radius) * (hitRadius + b.radius)) {
            this.applyDamageToPlayer(p, b.damage);
            hitPlayer = true;
            break;
          }
        }
        if (hitPlayer) {
          this.bullets.splice(i, 1);
        }
      } else {
        // Player bullet vs enemies
        let consumed = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const dx = b.x - e.x;
          const dy = b.y - e.y;
          if (dx * dx + dy * dy <= (e.radius + b.radius) * (e.radius + b.radius)) {
            e.hp -= b.damage;
            const owner = this.players.get(b.ownerId);
            if (owner) owner.sp = Math.min(owner.stats.spMax, owner.sp + owner.stats.spChargePerHit);
            if (e.hp <= 0) {
              this.items.push({
                id: `item_${this.nextEntityId++}`,
                x: e.x,
                y: e.y,
                vx: -60,
                vy: 0,
                type: e.itemDrop,
                magnetizedTo: null,
              });
              for (const [, p] of this.players) {
                if (p.hp > 0) p.sp = Math.min(p.stats.spMax, p.sp + 60);
              }
              this.enemies.splice(j, 1);
            }
            consumed = true;
            break;
          }
        }
        if (consumed) {
          this.bullets.splice(i, 1);
          continue;
        }

        // Player bullet vs boss
        if (this.boss.isActive && !this.boss.isDefeated) {
          const dx = b.x - this.boss.x;
          const dy = b.y - this.boss.y;
          if (dx * dx + dy * dy <= (40 + b.radius) * (40 + b.radius)) {
            const owner = this.players.get(b.ownerId);
            if (owner) owner.sp = Math.min(owner.stats.spMax, owner.sp + owner.stats.spChargePerHit);
            this.damageBoss(b.damage * 0.45);
            this.bullets.splice(i, 1);
          }
        }
      }
    }
  }

  private updateLasers(dt: number): void {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.timer += dt;

      if (l.state === 'charging' && l.timer >= l.chargeDuration) {
        l.state = 'firing';
        l.timer = 0;
        l.currentWidth = l.maxWidth;
      } else if (l.state === 'firing' && !this.struggle.active && l.timer >= l.fireDuration) {
        l.state = 'fading';
        l.timer = 0;
      } else if (l.state === 'fading') {
        l.currentWidth = Math.max(0, l.maxWidth * (1 - l.timer / Math.max(0.05, l.fadeDuration)));
        if (l.timer >= l.fadeDuration) {
          this.lasers.splice(i, 1);
          continue;
        }
      }

      if (l.state !== 'firing') continue;

      const halfW = l.currentWidth * 0.5;

      // Lasers erase normal bullets in their beam path
      for (let bIdx = this.bullets.length - 1; bIdx >= 0; bIdx--) {
        const b = this.bullets[bIdx];
        if (b.type === 'laser') continue;
        const inX = l.direction === 'right' ? b.x >= l.sourceX : b.x <= l.sourceX;
        if (inX && Math.abs(b.y - l.sourceY) <= halfW + b.radius) {
          this.bullets.splice(bIdx, 1);
        }
      }

      // Boss lasers damage Tank walls at 50 DPS (destroys two 25 HP walls in 1s)
      if (l.ownerId === 'boss') {
        for (const w of this.walls) {
          const inX = w.x <= l.sourceX;
          if (inX && Math.abs(w.y - l.sourceY) <= halfW + w.height * 0.5) {
            w.hp = Math.max(0, w.hp - l.dps * dt);
          }
        }
      }

      if (this.struggle.active || this.struggle.isAligning) continue;

      if (l.ownerId === 'boss') {
        for (const [, p] of this.players) {
          if (p.hp <= 0) continue;
          const pos = p.body.getPosition();
          if (pos.x <= l.sourceX && Math.abs(pos.y - l.sourceY) <= halfW + PLAYER_RADIUS) {
            this.applyDamageToPlayer(p, l.dps * dt);
          }
        }
      } else {
        // Player Master Spark damages fairies & boss
        for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
          const e = this.enemies[eIdx];
          if (e.x >= l.sourceX && Math.abs(e.y - l.sourceY) <= halfW + e.radius) {
            e.hp -= 90 * dt;
            if (e.hp <= 0) {
              this.items.push({
                id: `item_${this.nextEntityId++}`,
                x: e.x,
                y: e.y,
                vx: -60,
                vy: 0,
                type: e.itemDrop,
                magnetizedTo: null,
              });
              this.enemies.splice(eIdx, 1);
            }
          }
        }
        if (this.boss.isActive && !this.boss.isDefeated) {
          if (this.boss.x >= l.sourceX && Math.abs(this.boss.y - l.sourceY) <= halfW + 40) {
            this.damageBoss(55 * dt);
          }
        }
      }
    }
  }

  private updateBeamStruggle(dt: number): void {
    if ((this.struggle.resolutionTimer ?? 0) > 0) {
      this.struggle.resolutionTimer = Math.max(0, (this.struggle.resolutionTimer ?? 0) - dt);
      if (this.struggle.resolutionTimer === 0) {
        this.struggle.winner = null;
      }
    }

    const playerLaser = this.lasers.find((l) => l.ownerId !== 'boss' && (l.state === 'charging' || l.state === 'firing'));
    const bossMega = this.lasers.find((l) => l.ownerId === 'boss' && (l.isMegaBeam || l.maxWidth >= 60) && (l.state === 'charging' || l.state === 'firing'));

    if (!this.struggle.active && !this.struggle.isAligning) {
      if (playerLaser && bossMega && Math.abs(playerLaser.sourceY - bossMega.sourceY) <= 95) {
        this.struggle.isAligning = true;
        this.alignTimer = 0.55;
        const midY = (playerLaser.sourceY + bossMega.sourceY) * 0.5;
        playerLaser.sourceY = midY;
        playerLaser.targetY = midY;
        bossMega.sourceY = midY;
        bossMega.targetY = midY;
        this.struggle.clashY = midY;
        this.struggle.clashX = (playerLaser.sourceX + bossMega.sourceX) * 0.5;
      }
      return;
    }

    if (this.struggle.isAligning) {
      this.alignTimer -= dt;
      if (this.alignTimer <= 0) {
        this.struggle.isAligning = false;
        this.struggle.active = true;
        this.struggle.balance = 50;
        this.struggle.timer = 5.0;
        this.struggle.maxTimer = 5.0;
        if (playerLaser) {
          playerLaser.state = 'firing';
          playerLaser.fireDuration = 8.0;
          playerLaser.timer = 0;
        }
        if (bossMega) {
          bossMega.state = 'firing';
          bossMega.fireDuration = 8.0;
          bossMega.timer = 0;
        }
      }
      return;
    }

    if (this.struggle.active) {
      if (!playerLaser || !bossMega) {
        this.struggle.active = false;
        return;
      }

      this.struggle.timer = Math.max(0, this.struggle.timer - dt);
      // Boss pushes back steadily
      const bossPush = 14 * this.getDifficultyMult();
      this.struggle.balance = Math.max(0, Math.min(100, this.struggle.balance - bossPush * dt));

      const minX = playerLaser.sourceX + 40;
      const maxX = bossMega.sourceX - 40;
      const clashX = minX + (maxX - minX) * (this.struggle.balance / 100);
      this.struggle.clashX = clashX;
      this.struggle.clashY = playerLaser.sourceY;
      this.struggle.playerTipX = clashX;
      this.struggle.bossTipX = clashX;
      this.struggle.vortexX = clashX;
      this.struggle.vortexY = playerLaser.sourceY;

      if (this.struggle.balance >= 96 || (this.struggle.timer <= 0 && this.struggle.balance >= 50)) {
        this.struggle.active = false;
        this.struggle.winner = 'player';
        this.struggle.resolutionTimer = 1.2;
        this.lasers = [];
        this.advanceBossPhaseOrDefeat();
      } else if (this.struggle.balance <= 4 || (this.struggle.timer <= 0 && this.struggle.balance < 50)) {
        this.struggle.active = false;
        this.struggle.winner = 'boss';
        this.struggle.resolutionTimer = 1.2;
        this.lasers = [];
        for (const [, p] of this.players) {
          if (p.hp > 0) this.applyDamageToPlayer(p, 35);
        }
      }
    }
  }

  private updateWalls(dt: number): void {
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.ttl -= dt;

      if (w.ttl <= 0 || w.hp <= 0) {
        this.walls.splice(i, 1);
        continue;
      }

      // Tank wall absorbs enemy bullets
      for (let bIdx = this.bullets.length - 1; bIdx >= 0; bIdx--) {
        const b = this.bullets[bIdx];
        if (b.ownerId !== 'boss') continue;
        const halfW = w.width * 0.5 + b.radius;
        const halfH = w.height * 0.5 + b.radius;
        if (Math.abs(b.x - w.x) <= halfW && Math.abs(b.y - w.y) <= halfH) {
          this.bullets.splice(bIdx, 1);
        }
      }
    }
  }

  private applyDamageToPlayer(p: SimPlayer, rawDamage: number): void {
    const mitigation = Math.max(0, Math.min(1, p.stats.defensePercent / 100));
    const finalDamage = rawDamage * (1 - mitigation);
    p.hp = Math.max(0, Number((p.hp - finalDamage).toFixed(2)));
  }

  private buildSnapshot(): GameSnapshot {
    const cfg = getStageMeta(this.difficulty, this.stageIndex);
    const players = [...this.players.values()].map((p) => {
      const pos = p.body.getPosition();
      return {
        id: p.id,
        x: pos.x,
        y: pos.y,
        angle: p.angle,
        isReady: true,
        character: p.character,
        focus: p.input.focus,
        hp: Number(p.hp.toFixed(2)),
        sp: Number(p.sp.toFixed(2)),
        maxHp: p.stats.hpMax,
        maxSp: p.stats.spMax,
        defensePercent: p.stats.defensePercent,
      };
    });

    const bullets: ServerBullet[] = this.bullets.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      radius: b.radius,
      ownerId: b.ownerId,
      type: b.type,
      color: b.color,
    }));

    const walls: ServerWall[] = this.walls.map((w) => ({
      id: w.id,
      ownerId: w.ownerId,
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
      hp: w.hp,
      maxHp: w.maxHp,
      ttl: w.ttl,
    }));

    const lasers: ServerLaser[] = this.lasers.map((l) => ({
      id: l.id,
      ownerId: l.ownerId,
      direction: l.direction,
      sourceX: l.sourceX,
      sourceY: l.sourceY,
      targetY: l.targetY,
      state: l.state,
      timer: l.timer,
      chargeDuration: l.chargeDuration,
      fireDuration: l.fireDuration,
      fadeDuration: l.fadeDuration,
      maxWidth: l.maxWidth,
      color: l.color,
      isMegaBeam: l.isMegaBeam,
    }));

    const enemies: ServerEnemy[] = this.enemies.map((e) => ({
      id: e.id,
      type: e.type,
      x: e.x,
      y: e.y,
      hp: e.hp,
      maxHp: e.maxHp,
      radius: e.radius,
    }));

    const items: ServerItem[] = this.items.map((item) => ({
      id: item.id,
      x: item.x,
      y: item.y,
      type: item.type,
    }));

    const boss: ServerBoss = {
      x: this.boss.x,
      y: this.boss.y,
      hp: this.boss.hp,
      maxHp: this.boss.maxHp,
      phase: this.boss.phase,
      remainingStocks: this.boss.remainingStocks,
      spellcardName: this.boss.spellcardName,
      isSpellCard: this.boss.isSpellCard,
      isActive: this.boss.isActive,
      isDefeated: this.boss.isDefeated,
      isRefilling: this.boss.isRefilling,
      isLockedForBeam: this.boss.isLockedForBeam,
    };

    const difficultyLabel =
      this.difficulty === 'no_mercy' ? 'No Mercy' : this.difficulty === 'difficult' ? 'Difficult' : 'Normal';

    const campaign: ServerCampaign = {
      difficulty: this.difficulty,
      difficultyLabel,
      world: cfg.world,
      stage: cfg.stage,
      worldName: cfg.worldName,
      stageTitle: cfg.stageTitle,
      stageState: this.stageState,
      campaignComplete: this.stageState === 'stage_clear' && this.stageIndex >= TOTAL_STAGES_PER_DIFFICULTY - 1,
      bannerText: cfg.bannerText,
      bannerSubtext: cfg.bannerSubtext,
      clearTitle: cfg.clearTitle,
      clearSubtext: cfg.clearSubtext,
    };

    return {
      type: 'snapshot',
      tick: this.tick,
      phase: 'playing',
      stageTime: this.stageTime,
      players,
      bullets,
      walls,
      lasers,
      enemies,
      items,
      boss,
      campaign,
      struggle: { ...this.struggle },
    };
  }
}

const sim = new DanmakrewSimulationWorker();

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data || {};
  switch (type) {
    case 'INIT':
      sim.init(
        payload?.roomId || 'local-room',
        payload?.playerId || 'player-local-host',
        payload?.classId || 'DPS',
        payload?.difficulty || 'normal',
        payload?.world ?? 1,
        payload?.stage ?? 1
      );
      break;
    case 'PLAYER_INPUT':
      sim.setPlayerInput(
        payload?.playerId || 'player-local-host',
        payload?.dx ?? 0,
        payload?.dy ?? 0,
        payload?.action ?? null,
        Boolean(payload?.isFocus)
      );
      break;
    case 'ADD_PLAYER':
      if (payload?.playerId) {
        sim.addPlayer(payload.playerId, payload.character || 'DPS', payload.isBot !== false);
      }
      break;
    case 'SET_ROLE':
      if (payload?.playerId && payload?.role) {
        sim.setPlayerRole(payload.playerId, payload.role);
      }
      break;
    case 'TRIGGER_SKILL':
      sim.triggerSkill(payload?.playerId || 'player-local-host');
      break;
    case 'PUSH_STRUGGLE':
      sim.pushStruggle();
      break;
    case 'SPAWN_BOSS_NOW':
      sim.spawnBossNow();
      break;
    case 'START_BEAM_STRUGGLE_TEST':
      sim.startBeamStruggleTest();
      break;
    case 'ADVANCE_STAGE':
      sim.advanceStage();
      break;
    case 'RESTART_STAGE':
      sim.restartStage();
      break;
    case 'STOP':
      sim.stop();
      break;
  }
};

