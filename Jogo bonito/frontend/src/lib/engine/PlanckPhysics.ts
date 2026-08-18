import * as planck from 'planck';

const PWorld = (planck as any).World || (planck as any).default?.World || planck;
const PVec2 = (planck as any).Vec2 || (planck as any).default?.Vec2;
const PCircle = (planck as any).Circle || (planck as any).default?.Circle;

export class PlayerPhysicsEngine {
  private world: any;
  private playerBody: any;
  private normalSpeed = 580; // px/sec (Respuesta rápida y ágil)
  private focusSpeed = 190;  // px/sec (3x más lento para esquiva milimétrica precisa)

  constructor(initialX: number = 100, initialY: number = 300) {
    // Gravedad 0 para vista Top-Down / Horizontal Danmaku
    this.world = new PWorld(PVec2(0, 0));

    // Crear cuerpo dinámico sin amortiguación para respuesta instantánea
    this.playerBody = this.world.createBody({
      type: 'dynamic',
      position: PVec2(initialX, initialY),
      fixedRotation: true,
      linearDamping: 0.0,
      bullet: true
    });

    // Hitbox del jugador estilo Touhou (círculo pequeño de 4px)
    this.playerBody.createFixture({
      shape: PCircle(4),
      density: 1.0,
      friction: 0.0
    });
  }

  updateInput(dx: number, dy: number, isFocus: boolean, dt: number) {
    const speed = isFocus ? this.focusSpeed : this.normalSpeed;
    
    // Normalizar vector de movimiento diagonal
    let vx = dx;
    let vy = dy;
    if (dx !== 0 && dy !== 0) {
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy);
      vx *= invLen;
      vy *= invLen;
    }

    const currentPos = this.playerBody.getPosition();
    const newX = currentPos.x + vx * speed * dt;
    const newY = currentPos.y + vy * speed * dt;

    // Clampear jugador dentro de los límites del canvas horizontal (1024x576)
    const clampedX = Math.max(20, Math.min(1004, newX));
    const clampedY = Math.max(20, Math.min(556, newY));

    this.playerBody.setPosition(PVec2(clampedX, clampedY));
    this.playerBody.setLinearVelocity(PVec2(vx * speed, vy * speed));
    this.world.step(dt);
  }

  getPosition(): { x: number; y: number } {
    const pos = this.playerBody.getPosition();
    return { x: pos.x, y: pos.y };
  }

  setPosition(x: number, y: number) {
    this.playerBody.setPosition(PVec2(x, y));
  }
}

