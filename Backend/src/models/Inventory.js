const db = require('../config/database');

const Inventory = {
  // Crea el inventario para un usuario recién registrado
  create(ownerId) {
    db.prepare('INSERT INTO inventory (owner_id) VALUES (?)').run(ownerId);
    return this.findByOwner(ownerId);
  },

  findByOwner(ownerId) {
    const inventory = db.prepare('SELECT * FROM inventory WHERE owner_id = ?').get(ownerId);
    if (!inventory) return null;

    inventory.character_skins = db
      .prepare('SELECT skin_id FROM inventory_character_skin WHERE inventory_id = ?')
      .all(inventory.id)
      .map(r => r.skin_id);

    inventory.effect_skins = db
      .prepare('SELECT skin_id FROM inventory_effect_skin WHERE inventory_id = ?')
      .all(inventory.id)
      .map(r => r.skin_id);

    const chips = db.prepare(`
      SELECT c.*, s.HP, s.ATK, s.DEF, s.SP_CHARGE, s.CRIT_CHANCE, s.SP_DRAIN,
             s.HEALING_POINTS, s.BULLET_ARMOR, s.ULTIMATE_DAMAGE, s.ULTIMATE_HEALTH, s.BUFFS
      FROM chip c
      LEFT JOIN chip_stats s ON s.chip_id = c.id
      WHERE c.inventory_id = ?
    `).all(inventory.id);
    inventory.chips = chips.map(({ HP, ATK, DEF, SP_CHARGE, CRIT_CHANCE, SP_DRAIN, HEALING_POINTS, BULLET_ARMOR, ULTIMATE_DAMAGE, ULTIMATE_HEALTH, BUFFS, ...chip }) => {
      const hasStats = HP !== null || ATK !== null || DEF !== null;
      chip.stats = hasStats ? { HP, ATK, DEF, SP_CHARGE, CRIT_CHANCE, SP_DRAIN, HEALING_POINTS, BULLET_ARMOR, ULTIMATE_DAMAGE, ULTIMATE_HEALTH, BUFFS } : null;
      return chip;
    });

    return inventory;
  },

  // Scraps
  addScraps(ownerId, amount) {
    db.prepare('UPDATE inventory SET scraps = scraps + ? WHERE owner_id = ?').run(amount, ownerId);
  },

  removeScraps(ownerId, amount) {
    db.prepare('UPDATE inventory SET scraps = MAX(0, scraps - ?) WHERE owner_id = ?').run(amount, ownerId);
  },

  // Character skins (por ahora sólo IDs)
  addCharacterSkin(ownerId, skinId) {
    const inv = db.prepare('SELECT id FROM inventory WHERE owner_id = ?').get(ownerId);
    db.prepare(
      'INSERT OR IGNORE INTO inventory_character_skin (inventory_id, skin_id) VALUES (?, ?)'
    ).run(inv.id, skinId);
  },

  // Effect skins (por ahora sólo IDs)
  addEffectSkin(ownerId, skinId) {
    const inv = db.prepare('SELECT id FROM inventory WHERE owner_id = ?').get(ownerId);
    db.prepare(
      'INSERT OR IGNORE INTO inventory_effect_skin (inventory_id, skin_id) VALUES (?, ?)'
    ).run(inv.id, skinId);
  },
};

module.exports = Inventory;