'use strict';

class InMemoryRedis {
  constructor() {
    this.store = new Map();
    this.zsets = new Map();
    this.status = 'ready';
  }

  on(event, cb) {
    if (event === 'connect' || event === 'ready') {
      setTimeout(cb, 0);
    }
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async set(key, val, ex, ttl) {
    this.store.set(key, String(val));
    if (ex === 'EX' && ttl) {
      setTimeout(() => this.store.delete(key), ttl * 1000);
    }
    return 'OK';
  }

  async del(key) {
    const existed = this.store.delete(key);
    this.zsets.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key) {
    return this.store.has(key) || this.zsets.has(key) ? 1 : 0;
  }

  async zadd(key, score, member) {
    if (!this.zsets.has(key)) this.zsets.set(key, new Map());
    this.zsets.get(key).set(member, Number(score));
    return 1;
  }

  async zrange(key, start, stop) {
    const zset = this.zsets.get(key);
    if (!zset) return [];
    const sorted = [...zset.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
    if (stop === -1) stop = sorted.length - 1;
    return sorted.slice(start, stop + 1);
  }

  async zrevrange(key, start, stop) {
    const zset = this.zsets.get(key);
    if (!zset) return [];
    const sorted = [...zset.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
    if (stop === -1) stop = sorted.length - 1;
    return sorted.slice(start, stop + 1);
  }

  async zrem(key, member) {
    const zset = this.zsets.get(key);
    if (!zset) return 0;
    return zset.delete(member) ? 1 : 0;
  }

  pipeline() {
    const ops = [];
    const p = {
      get: (k) => { ops.push(async () => [null, await this.get(k)]); return p; },
      set: (k, v, ex, ttl) => { ops.push(async () => [null, await this.set(k, v, ex, ttl)]); return p; },
      del: (k) => { ops.push(async () => [null, await this.del(k)]); return p; },
      zadd: (k, s, m) => { ops.push(async () => [null, await this.zadd(k, s, m)]); return p; },
      zrange: (k, s, e) => { ops.push(async () => [null, await this.zrange(k, s, e)]); return p; },
      zrevrange: (k, s, e) => { ops.push(async () => [null, await this.zrevrange(k, s, e)]); return p; },
      zrem: (k, m) => { ops.push(async () => [null, await this.zrem(k, m)]); return p; },
      exec: async () => {
        const results = [];
        for (const op of ops) {
          results.push(await op());
        }
        return results;
      },
    };
    return p;
  }

  disconnect() {}
}

module.exports = new InMemoryRedis();
