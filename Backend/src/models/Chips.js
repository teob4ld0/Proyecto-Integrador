const db = require('../config/database');

const Chip = {
  findById(id) {
    const chip = db.prepare('SELECT * FROM chip WHERE id = ?').get(id);
    if (!chip) return null;
    chip.stats = db.prepare('SELECT HP, ATK, DEF, SP_CHARGE FROM chip_stats WHERE chip_id = ?').get(chip.id) ?? null;
    return chip;
  },

  findByInventory(inventoryId) {
    const chips = db.prepare('SELECT * FROM chip WHERE inventory_id = ?').all(inventoryId);
    for (const chip of chips) {
      chip.stats = db.prepare('SELECT HP, ATK, DEF, SP_CHARGE FROM chip_stats WHERE chip_id = ?').get(chip.id) ?? null;
    }
    return chips;
  },

  create({ inventoryId, name, rarity, level = 1, image = null, stats = null }) {
    const result = db.prepare(
      'INSERT INTO chip (inventory_id, name, rarity, level, image) VALUES (?, ?, ?, ?, ?)'
    ).run(inventoryId, name, rarity, level, image);
    const chipId = result.lastInsertRowId;

    if (stats) {
      const { HP = null, ATK = null, DEF = null, SP_CHARGE = null, CRIT_CHANCE = null, SP_DRAIN = null, HEALING_POINTS = null, BULLET_HEALTH = null, ULTIMATE_DAMAGE = null, ULTIMATE_HEALTH = null, BUFFS = null, LEVEL = null } = stats;
      db.prepare(
        'INSERT INTO chip_stats (chip_id, HP, ATK, DEF, SP_CHARGE, CRIT_CHANCE, SP_DRAIN, HEALING_POINTS, BULLET_HEALTH, ULTIMATE_DAMAGE, ULTIMATE_HEALTH, BUFFS, LEVEL) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(chipId, HP, ATK, DEF, SP_CHARGE, CRIT_CHANCE, SP_DRAIN, HEALING_POINTS, BULLET_HEALTH, ULTIMATE_DAMAGE, ULTIMATE_HEALTH, BUFFS, LEVEL);
    }

    return this.findById(chipId);
  },

  updateLevel(id, level) {
    db.prepare('UPDATE chip SET level = ? WHERE id = ?').run(level, id);
  },

  updateStats(chipId, { HP = null, ATK = null, DEF = null, SP_CHARGE = null, CRIT_CHANCE = null, SP_DRAIN = null, HEALING_POINTS = null, BULLET_HEALTH = null, ULTIMATE_DAMAGE = null, ULTIMATE_HEALTH = null, BUFFS = null, LEVEL = null }) {
    db.prepare(`
      INSERT INTO chip_stats (chip_id, HP, ATK, DEF, SP_CHARGE, CRIT_CHANCE, SP_DRAIN, HEALING_POINTS, BULLET_HEALTH, ULTIMATE_DAMAGE, ULTIMATE_HEALTH, BUFFS, LEVEL) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chip_id) DO UPDATE SET 
        HP = excluded.HP, 
        ATK = excluded.ATK, 
        DEF = excluded.DEF, 
        SP_CHARGE = excluded.SP_CHARGE,
        CRIT_CHANCE = excluded.CRIT_CHANCE,
        SP_DRAIN = excluded.SP_DRAIN,
        HEALING_POINTS = excluded.HEALING_POINTS,
        BULLET_HEALTH = excluded.BULLET_HEALTH,
        ULTIMATE_DAMAGE = excluded.ULTIMATE_DAMAGE,
        ULTIMATE_HEALTH = excluded.ULTIMATE_HEALTH,
        BUFFS = excluded.BUFFS,
        LEVEL = excluded.LEVEL
    `).run(chipId, HP, ATK, DEF, SP_CHARGE, CRIT_CHANCE, SP_DRAIN, HEALING_POINTS, BULLET_HEALTH, ULTIMATE_DAMAGE, ULTIMATE_HEALTH, BUFFS, LEVEL);
  },
};

module.exports = Chip;