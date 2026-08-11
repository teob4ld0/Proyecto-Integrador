import planck from 'planck';

export class PlayerPhysicsEngine {
  private world: planck.World;
  private playerBody: planck.Body;
  private normalSpeed = 350; // px/sec
  private focusSpeed = 140;  // px/sec (Shift para precisión)

  constructor(initialX: number = 400, initialY: number = 700) {
    // Gravedad 0 para vista Top-Down Danmaku
    this.world = new planck.World(planck.Vec2(0, 0));

    // Crear cuerpo dinámico para el jugador
    this.playerBody = this.world.createBody({
      type: 'dynamic',
      position: planck.Vec2(initialX, initialY),
      fixedRotation: true,
      linearDamping: 10.0
    });

    // Hitbox del jugador estilo Touhou (círculo pequeño de 4px)
    this.playerBody.createFixture({
      shape: planck.Circle(4),
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

    this.playerBody.setLinearVelocity(planck.Vec2(vx * speed, vy * speed));
    this.world.step(dt);

    // Clampear jugador dentro de los límites del canvas (0 a 800 ancho, 0 a 900 alto)
    const pos = this.playerBody.getPosition();
    const clampedX = Math.max(20, Math.min(780, pos.x));
    const clampedY = Math.max(30, Math.min(870, pos.y));
    
    if (clampedX !== pos.x || clampedY !== pos.y) {
      this.playerBody.setPosition(planck.Vec2(clampedX, clampedY));
    }
  }

  getPosition(): { x: number; y: number } {
    const pos = this.playerBody.getPosition();
    return { x: pos.x, y: pos.y };
  }

  setPosition(x: number, y: number) {
    this.playerBody.setPosition(planck.Vec2(x, y));
  }
}
