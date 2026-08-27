const db = require('../config/database');

const STATS_COLS = 'HP, ATK, DEF, SP_CHARGE, CRIT_CHANCE, SP_DRAIN, HEALING_POINTS, BULLET_ARMOR, ULTIMATE_DAMAGE, ULTIMATE_HEALTH, BUFFS';

const chipWithStatsQuery = db.prepare(`
  SELECT c.*, s.HP, s.ATK, s.DEF, s.SP_CHARGE, s.CRIT_CHANCE, s.SP_DRAIN,
         s.HEALING_POINTS, s.BULLET_ARMOR, s.ULTIMATE_DAMAGE, s.ULTIMATE_HEALTH, s.BUFFS
  FROM chip c
  LEFT JOIN chip_stats s ON s.chip_id = c.id
  WHERE c.id = ?
`);

function rowToChip(row) {
  if (!row) return null;
  const { HP, ATK, DEF, SP_CHARGE, CRIT_CHANCE, SP_DRAIN, HEALING_POINTS, BULLET_ARMOR, ULTIMATE_DAMAGE, ULTIMATE_HEALTH, BUFFS, ...chip } = row;
  const hasStats = HP !== null || ATK !== null || DEF !== null;
  chip.stats = hasStats ? { HP, ATK, DEF, SP_CHARGE, CRIT_CHANCE, SP_DRAIN, HEALING_POINTS, BULLET_ARMOR, ULTIMATE_DAMAGE, ULTIMATE_HEALTH, BUFFS } : null;
  return chip;
}

const Chip = {
  findById(id) {
    return rowToChip(chipWithStatsQuery.get(id));
  },

  findByInventory(inventoryId) {
    const rows = db.prepare(`
      SELECT c.*, s.HP, s.ATK, s.DEF, s.SP_CHARGE, s.CRIT_CHANCE, s.SP_DRAIN,
             s.HEALING_POINTS, s.BULLET_ARMOR, s.ULTIMATE_DAMAGE, s.ULTIMATE_HEALTH, s.BUFFS
      FROM chip c
      LEFT JOIN chip_stats s ON s.chip_id = c.id
      WHERE c.inventory_id = ?
    `).all(inventoryId);
    return rows.map(rowToChip);
  },

  create({ inventoryId, name, rarity, level = 1, image = null, stats = null }) {
    const chipId = db.prepare(
      'INSERT INTO chip (inventory_id, name, rarity, level, image) VALUES (?, ?, ?, ?, ?)'
    ).run(inventoryId, name, rarity, level, image).lastInsertRowid;

    if (stats) {
      const { HP = null, ATK = null, DEF = null, SP_CHARGE = null, CRIT_CHANCE = null, SP_DRAIN = null,
              HEALING_POINTS = null, BULLET_ARMOR = null, ULTIMATE_DAMAGE = null, ULTIMATE_HEALTH = null, BUFFS = null } = stats;
      db.prepare(
        `INSERT INTO chip_stats (chip_id, ${STATS_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(chipId, HP, ATK, DEF, SP_CHARGE, CRIT_CHANCE, SP_DRAIN, HEALING_POINTS, BULLET_ARMOR, ULTIMATE_DAMAGE, ULTIMATE_HEALTH, BUFFS);
    }

    return this.findById(chipId);
  },

  updateLevel(id, level) {
    db.prepare('UPDATE chip SET level = ? WHERE id = ?').run(level, id);
  },

  updateStats(chipId, { HP = null, ATK = null, DEF = null, SP_CHARGE = null, CRIT_CHANCE = null, SP_DRAIN = null,
                        HEALING_POINTS = null, BULLET_ARMOR = null, ULTIMATE_DAMAGE = null, ULTIMATE_HEALTH = null, BUFFS = null }) {
    db.prepare(`
      INSERT INTO chip_stats (chip_id, ${STATS_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chip_id) DO UPDATE SET
        HP = excluded.HP, ATK = excluded.ATK, DEF = excluded.DEF, SP_CHARGE = excluded.SP_CHARGE,
        CRIT_CHANCE = excluded.CRIT_CHANCE, SP_DRAIN = excluded.SP_DRAIN, HEALING_POINTS = excluded.HEALING_POINTS,
        BULLET_ARMOR = excluded.BULLET_ARMOR, ULTIMATE_DAMAGE = excluded.ULTIMATE_DAMAGE,
        ULTIMATE_HEALTH = excluded.ULTIMATE_HEALTH, BUFFS = excluded.BUFFS
    `).run(chipId, HP, ATK, DEF, SP_CHARGE, CRIT_CHANCE, SP_DRAIN, HEALING_POINTS, BULLET_ARMOR, ULTIMATE_DAMAGE, ULTIMATE_HEALTH, BUFFS);
  },
};

module.exports = Chip;