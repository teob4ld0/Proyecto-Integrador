'use strict';

/**
 * SpatialHash — divides the field into fixed-size cells for fast proximity queries.
 *
 * Works with any object that has numeric `x` and `y` properties.
 * The hash tracks each item's current cell via `_cellX` / `_cellY` properties
 * that it writes directly onto the item (no external bookkeeping needed).
 *
 * Cell size recommendation: 2 * maxEntityRadius + vMax * dt
 * For bullets (radius 4, speed 400 px/s, dt 1/60): ~15 px minimum.
 * We use 100 px for simplicity and good cache behaviour.
 */
class SpatialHash {
  /**
   * @param {number} cellSize — size of each square cell in world units
   */
  constructor(cellSize = 100) {
    this.cellSize = cellSize;
    /** @type {Map<string, Set<object>>} */
    this._cells = new Map();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  _key(cx, cy) { return `${cx},${cy}`; }

  _coords(x, y) {
    return [Math.floor(x / this.cellSize), Math.floor(y / this.cellSize)];
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Insert an item at its current (x, y).
   * Sets `item._cellX` and `item._cellY`.
   */
  insert(item) {
    const [cx, cy] = this._coords(item.x, item.y);
    item._cellX = cx;
    item._cellY = cy;
    const key = this._key(cx, cy);
    if (!this._cells.has(key)) this._cells.set(key, new Set());
    this._cells.get(key).add(item);
  }

  /**
   * Remove an item from its current cell.
   * Uses `item._cellX` / `item._cellY` written during insert/update.
   */
  remove(item) {
    if (isNaN(item._cellX)) return;
    const key = this._key(item._cellX, item._cellY);
    const cell = this._cells.get(key);
    if (cell) {
      cell.delete(item);
      if (cell.size === 0) this._cells.delete(key);
    }
    item._cellX = NaN;
    item._cellY = NaN;
  }

  /**
   * Re-register item if it has moved to a different cell.
   * No-op if the item is still in the same cell (fast path).
   */
  update(item) {
    const [cx, cy] = this._coords(item.x, item.y);
    if (cx === item._cellX && cy === item._cellY) return; // same cell — nothing to do
    this.remove(item);
    item._cellX = cx;
    item._cellY = cy;
    const key = this._key(cx, cy);
    if (!this._cells.has(key)) this._cells.set(key, new Set());
    this._cells.get(key).add(item);
  }

  /**
   * Return all items in cells that overlap the query circle (x, y, radius).
   * Results may contain items outside the circle — caller must do the precise check.
   * @returns {object[]}
   */
  query(x, y, radius) {
    const minCX = Math.floor((x - radius) / this.cellSize);
    const maxCX = Math.floor((x + radius) / this.cellSize);
    const minCY = Math.floor((y - radius) / this.cellSize);
    const maxCY = Math.floor((y + radius) / this.cellSize);

    const results = [];
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this._cells.get(this._key(cx, cy));
        if (cell) for (const item of cell) results.push(item);
      }
    }
    return results;
  }

  clear() {
    this._cells.clear();
  }
}

module.exports = SpatialHash;
