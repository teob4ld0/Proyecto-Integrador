const db = require('../config/database');

const FRIEND_REQUEST_STATUS = {
  Pendiente: 0,
  Aceptada: 1,
  Rechazada: 2,
};

const FriendRequest = {
  hasPending(userAId, userBId) {
    return !!db
      .prepare(
        `SELECT 1 FROM friend_request
         WHERE status = 0
           AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))`
      )
      .get(userAId, userBId, userBId, userAId);
  },

  create(senderId, receiverId) {
    return db
      .prepare('INSERT INTO friend_request (sender_id, receiver_id) VALUES (?, ?)')
      .run(senderId, receiverId);
  },

  findPendingForReceiver(receiverId) {
    return db
      .prepare(
        `SELECT fr.id, fr.sender_id, fr.receiver_id, fr.status, fr.created_at,
                u.username AS sender_username
         FROM friend_request fr
         JOIN user u ON u.id = fr.sender_id
         WHERE fr.receiver_id = ? AND fr.status = 0`
      )
      .all(receiverId);
  },

  findById(id) {
    return db.prepare('SELECT * FROM friend_request WHERE id = ?').get(id);
  },

  updateStatus(id, status) {
    db.prepare('UPDATE friend_request SET status = ? WHERE id = ?').run(status, id);
  },
};

module.exports = { FriendRequest, FRIEND_REQUEST_STATUS };
