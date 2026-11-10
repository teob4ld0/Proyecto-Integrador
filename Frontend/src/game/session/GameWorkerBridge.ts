import type { GameSnapshot } from '../network/wsClient';
import type { Difficulty, PlayerRole } from './gameRuntimeSession';

export class GameWorkerBridge {
  private worker: Worker | null = null;
  private myPlayerId: string = '';
  private onSnapshotCallback: ((snapshot: GameSnapshot) => void) | null = null;
  private isInitialized = false;

  public start(
    roomId: string,
    playerId: string,
    classId: PlayerRole | string,
    difficulty: Difficulty = 'normal',
    world: number = 1,
    stage: number = 1,
    onSnapshot: (snapshot: GameSnapshot) => void
  ): Promise<string> {
    this.onSnapshotCallback = onSnapshot;

    return new Promise((resolve) => {
      try {
        this.worker = new Worker(
          new URL('../workers/gameSimulation.worker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (e: MessageEvent) => {
          const { type, payload, myPlayerId } = e.data || {};
          if (type === 'INIT_ACK') {
            this.myPlayerId = myPlayerId || playerId || 'player-local-host';
            this.isInitialized = true;
            resolve(this.myPlayerId);
          } else if (type === 'SNAPSHOT' && this.onSnapshotCallback) {
            this.onSnapshotCallback(payload as GameSnapshot);
          }
        };

        this.worker.postMessage({
          type: 'INIT',
          payload: {
            roomId,
            playerId: playerId || 'player-local-host',
            classId,
            difficulty,
            world,
            stage,
          },
        });
      } catch (err) {
        console.error('[GameWorkerBridge] Error iniciando Web Worker de simulación:', err);
        resolve(playerId || 'host-fallback');
      }
    });
  }

  public sendInput(dx: number, dy: number, action: string | null = null, isFocus: boolean = false): void {
    if (this.worker && this.isInitialized) {
      this.worker.postMessage({
        type: 'PLAYER_INPUT',
        payload: {
          playerId: this.myPlayerId,
          dx,
          dy,
          action,
          isFocus,
        },
      });
    }
  }

  public addTeammate(playerId: string, character: string, isBot: boolean = true): void {
    if (this.worker && this.isInitialized) {
      this.worker.postMessage({
        type: 'ADD_PLAYER',
        payload: { playerId, character, isBot },
      });
    }
  }

  public setRole(role: string): void {
    if (this.worker && this.isInitialized) {
      this.worker.postMessage({
        type: 'SET_ROLE',
        payload: { playerId: this.myPlayerId, role },
      });
    }
  }

  public triggerSkill(): void {
    if (this.worker && this.isInitialized) {
      this.worker.postMessage({
        type: 'TRIGGER_SKILL',
        payload: { playerId: this.myPlayerId },
      });
    }
  }

  public pushStruggle(): void {
    if (this.worker && this.isInitialized) {
      this.worker.postMessage({ type: 'PUSH_STRUGGLE' });
    }
  }

  public spawnBossNow(): void {
    if (this.worker && this.isInitialized) {
      this.worker.postMessage({ type: 'SPAWN_BOSS_NOW' });
    }
  }

  public startBeamStruggleTest(): void {
    if (this.worker && this.isInitialized) {
      this.worker.postMessage({ type: 'START_BEAM_STRUGGLE_TEST' });
    }
  }

  public advanceStage(): void {
    if (this.worker && this.isInitialized) {
      this.worker.postMessage({ type: 'ADVANCE_STAGE' });
    }
  }

  public restartStage(): void {
    if (this.worker && this.isInitialized) {
      this.worker.postMessage({ type: 'RESTART_STAGE' });
    }
  }

  public isActive(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  public stop(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'STOP' });
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
  }
}

