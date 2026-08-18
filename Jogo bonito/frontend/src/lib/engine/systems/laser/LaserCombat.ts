import type { Bullet, LaserBeam } from '../../types';

export function clearEnemyBulletsInPlayerBeam(
  laser: LaserBeam,
  bullets: Bullet[],
  endX: number,
  pulseWidth: number
): void {
  const beamHalfWidth = pulseWidth * 0.5 + 16;
  for (let bIdx = bullets.length - 1; bIdx >= 0; bIdx--) {
    const b = bullets[bIdx];
    if (b.isPlayerBullet) continue;
    const inPath = b.x >= laser.sourceX - 20 && b.x <= endX + 20;
    if (inPath && Math.abs(b.y - laser.sourceY) <= (beamHalfWidth + b.radius)) {
      bullets.splice(bIdx, 1);
    }
  }
}

export function shouldHitPlayer(
  laser: LaserBeam,
  playerPos: { x: number; y: number },
  pulseWidth: number,
  isClashing: boolean,
  effectiveDt: number
): boolean {
  if (laser.ownerId !== 'boss' || isClashing || effectiveDt <= 0) return false;
  if (playerPos.x >= laser.sourceX) return false;

  const dy = Math.abs(playerPos.y - laser.sourceY);
  return dy < pulseWidth * 0.5 + 4;
}

export function getBossHitDamage(
  laser: LaserBeam,
  bossPos: { x: number; y: number; hp: number },
  pulseWidth: number,
  dt: number,
  isClashing: boolean
): number {
  if (laser.ownerId !== 'player' || isClashing) return 0;
  if (bossPos.x <= laser.sourceX || bossPos.hp <= 0) return 0;

  const dy = Math.abs(bossPos.y - laser.sourceY);
  if (dy < pulseWidth * 0.5 + 55) {
    return 50 * dt * 0.6;
  }

  return 0;
}
