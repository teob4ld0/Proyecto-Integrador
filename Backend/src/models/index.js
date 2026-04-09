const User = require('./User');
const Friend = require('./Friend');
const { FriendRequest } = require('./FriendRequest');

// User <-> Friend (self-referencing)
User.hasMany(Friend, { foreignKey: 'UserId', as: 'friends' });
User.hasMany(Friend, { foreignKey: 'FriendUserId', as: 'friendOf' });
Friend.belongsTo(User, { foreignKey: 'UserId', as: 'user' });
Friend.belongsTo(User, { foreignKey: 'FriendUserId', as: 'friendUser' });

// User <-> FriendRequest (self-referencing)
User.hasMany(FriendRequest, { foreignKey: 'SenderId', as: 'sentFriendRequests' });
User.hasMany(FriendRequest, { foreignKey: 'ReceiverId', as: 'receivedFriendRequests' });
FriendRequest.belongsTo(User, { foreignKey: 'SenderId', as: 'sender' });
FriendRequest.belongsTo(User, { foreignKey: 'ReceiverId', as: 'receiver' });

module.exports = { User, Friend, FriendRequest };
