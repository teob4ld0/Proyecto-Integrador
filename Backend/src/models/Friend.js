const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Friend = sequelize.define('Friend', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'UserId',
  },
  friendUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'FriendUserId',
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'CreatedAt',
  },
}, {
  tableName: 'Friends',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['UserId', 'FriendUserId'],
    },
  ],
});

module.exports = Friend;
