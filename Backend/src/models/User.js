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

  create({ id, username, email, password, verificationToken }) {
    db.prepare(
      'INSERT INTO user (id, username, email, password, is_verified, verification_token) VALUES (?, ?, ?, ?, 0, ?)'
    ).run(id, username, email, password, verificationToken ?? null);
    return this.findById(id);
  },

  verify(id) {
    db.prepare(
      'UPDATE user SET is_verified = 1, verification_token = NULL WHERE id = ?'
    ).run(id);
  },
};

module.exports = User;