const db = require('../config/database');

const Friend = {
  exists(userId, friendUserId) {
    return !!db
      .prepare('SELECT 1 FROM friend WHERE user_id = ? AND friend_user_id = ?')
      .get(userId, friendUserId);
  },

  createPair(userId, friendUserId) {
    const insert = db.prepare(
      'INSERT OR IGNORE INTO friend (user_id, friend_user_id) VALUES (?, ?)'
    );
    db.transaction(() => {
      insert.run(userId, friendUserId);
      insert.run(friendUserId, userId);
    })();
  },
};

module.exports = Friend;
