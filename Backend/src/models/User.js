const db = require('../config/database');

const User = {
  findByEmail(email) {
    return db.prepare('SELECT * FROM user WHERE email = ?').get(email);
  },

  findById(id) {
    return db.prepare('SELECT * FROM user WHERE id = ?').get(id);
  },

  findAll() {
    return db.prepare('SELECT id, username, email FROM user').all();
  },

  create({ id, username, email, password, verificationToken, danmas }) {
    const insert = db.transaction(() => {
      db.prepare(
        'INSERT INTO user (id, username, email, password, is_verified, verification_token, danmas) VALUES (?, ?, ?, ?, 0, ?, ?)'
      ).run(id, username, email, password, verificationToken ?? null, danmas ?? 0);

      db.prepare('INSERT INTO inventory (owner_id) VALUES (?)').run(id);
    });
    insert();
    return this.findById(id);
  },

  verify(id) {
    db.prepare(
      'UPDATE user SET is_verified = 1, verification_token = NULL WHERE id = ?'
    ).run(id);
  },

  setVerificationToken(id, token) {
    db.prepare(
      'UPDATE user SET verification_token = ?, is_verified = 0 WHERE id = ?'
    ).run(token, id);
  },
};

module.exports = User;