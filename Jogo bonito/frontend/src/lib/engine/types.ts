export type CharacterClass = 'Tank' | 'Support' | 'DPS' | 'Special_Attack' | 'defense' | 'healer' | 'physical' | 'attack';
export type GameDifficulty = 'normal' | 'difficult' | 'no_mercy';

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  damage?: number;
  isPlayerBullet?: boolean;
  isLaserShard?: boolean;
}

export interface RemotePlayer {
  id: string;
  x: number;
  y: number;
  hp?: number;
  maxHp?: number;
  sp?: number;
  maxSp?: number;
  defensePercent?: number;
  characterColor?: string;
}

export type EnemyType = 'green_fairy' | 'red_fairy' | 'big_fairy' | 'purple_fairy' | 'yellow_fairy' | 'spirit_orb';
export type TrajectoryType = 'sine' | 'swoop' | 'hover_retreat' | 'cross_top' | 'cross_bottom' | 'straight' | 'spiral' | 'double_helix' | 'zigzag';
export type AttackPatternType = 
  | 'aimed_single' 
  | 'aimed_spread' 
  | 'ring_burst' 
  | 'spiral_barrage' 
  | 'needle_stream' 
  | 'flower_burst' 
  | 'helix_stream' 
  | 'cross_spread' 
  | 'star_rings' 
  | 'none';

export type ItemType = 'power' | 'point' | 'bomb_frag' | 'life_frag';

export interface ItemDrop {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: ItemType;
  value: number;
  magnetized: boolean;
}

export type StageState = 'intro' | 'waves' | 'boss_warning' | 'boss_battle' | 'stage_clear';
export type BossPhase = 1 | 2 | 3 | 4 | 5;

export interface TimelineEvent {
  time: number;
  action: 'stage_banner' | 'spawn_wave' | 'boss_warning' | 'spawn_boss' | 'dialogue' | 'custom';
  payload?: any;
  executed?: boolean;
}

export interface Stage1Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  type: 'green' | 'red' | 'big';
}

export interface LaserBeam {
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
  currentWidth: number;
  alpha: number;
  color: number;
  podType: 'top' | 'bottom';
  isMegaBeam?: boolean;
  isClashing?: boolean;
  clashX?: number;
}

export interface WallBarrier {
  id: string;
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

export interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  alpha: number;
  life: number;
  maxLife: number;
  isStar?: boolean;
}

