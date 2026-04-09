const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FRIEND_REQUEST_STATUS = {
  Pendiente: 0,
  Aceptada: 1,
  Rechazada: 2,
};

const FriendRequest = sequelize.define('FriendRequest', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'SenderId',
  },
  receiverId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'ReceiverId',
  },
  status: {
    type: DataTypes.INTEGER,
    defaultValue: FRIEND_REQUEST_STATUS.Pendiente,
    field: 'Status',
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'CreatedAt',
  },
}, {
  tableName: 'FriendRequests',
  timestamps: false,
});

module.exports = { FriendRequest, FRIEND_REQUEST_STATUS };
