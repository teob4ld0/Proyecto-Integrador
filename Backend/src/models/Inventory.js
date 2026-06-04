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

  removeCharacterSkin(ownerId, skinId) {
    const inv = db.prepare('SELECT id FROM inventory WHERE owner_id = ?').get(ownerId);
    db.prepare(
      'DELETE FROM inventory_character_skin WHERE inventory_id = ? AND skin_id = ?'
    ).run(inv.id, skinId);
  },

  // Effect skins (por ahora sólo IDs)
  addEffectSkin(ownerId, skinId) {
    const inv = db.prepare('SELECT id FROM inventory WHERE owner_id = ?').get(ownerId);
    db.prepare(
      'INSERT OR IGNORE INTO inventory_effect_skin (inventory_id, skin_id) VALUES (?, ?)'
    ).run(inv.id, skinId);
  },

  removeEffectSkin(ownerId, skinId) {
    const inv = db.prepare('SELECT id FROM inventory WHERE owner_id = ?').get(ownerId);
    db.prepare(
      'DELETE FROM inventory_effect_skin WHERE inventory_id = ? AND skin_id = ?'
    ).run(inv.id, skinId);
  },
};

module.exports = Inventory;