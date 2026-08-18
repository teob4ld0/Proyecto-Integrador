import type { TimelineEvent } from '../types';

export class TimelineManager {
  public currentTime: number = 0;
  public isPaused: boolean = false;
  private events: TimelineEvent[] = [];
  private eventHandlers = new Map<string, (payload?: any) => void>();

  constructor(initialEvents: TimelineEvent[] = []) {
    this.loadScript(initialEvents);
  }

  public loadScript(events: TimelineEvent[]): void {
    // Ordenar cronológicamente y resetear estado ejecutado
    this.events = events
      .map((e) => ({ ...e, executed: false }))
      .sort((a, b) => a.time - b.time);
    this.currentTime = 0;
    this.isPaused = false;
  }

  public on(action: string, handler: (payload?: any) => void): this {
    this.eventHandlers.set(action, handler);
    return this;
  }

  public update(dt: number): void {
    if (this.isPaused) return;

    this.currentTime += dt;

    for (const ev of this.events) {
      if (!ev.executed && this.currentTime >= ev.time) {
        ev.executed = true;
        const handler = this.eventHandlers.get(ev.action);
        if (handler) {
          handler(ev.payload);
        }
      }
    }
  }

  public reset(): void {
    this.currentTime = 0;
    for (const ev of this.events) {
      ev.executed = false;
    }
  }

  public get isFinished(): boolean {
    return this.events.every((e) => e.executed);
  }
}
