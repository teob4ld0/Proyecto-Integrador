const db = require('../config/database');

const Chip = {
  findById(id) {
    return db.prepare('SELECT * FROM chip WHERE id = ?').get(id);
  },

  findByOwner(ownerId) {
    return db.prepare('SELECT * FROM chip WHERE owner_id = ?').all(ownerId);
  },

  create({ ownerId, name, rarity, level = 1, modifiers = null, image = null, scraps = 0 }) {
    const result = db.prepare(
      'INSERT INTO chip (owner_id, name, rarity, level, modifiers, image, scraps) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(ownerId, name, rarity, level, modifiers, image, scraps);
    return this.findById(result.lastInsertRowid);
  },

  // Destruir una chip devuelve sus scraps al inventario del dueño
  destroy(id) {
    const chip = this.findById(id);
    if (!chip) return null;
    db.prepare('DELETE FROM chip WHERE id = ?').run(id);
    db.prepare('UPDATE inventory SET scraps = scraps + ? WHERE owner_id = ?').run(chip.scraps, chip.owner_id);
    return chip.scraps;
  },

  updateLevel(id, level) {
    db.prepare('UPDATE chip SET level = ? WHERE id = ?').run(level, id);
  },
};

module.exports = Chip;