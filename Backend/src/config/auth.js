const { Lucia } = require('lucia');
const { BetterSqlite3Adapter } = require('@lucia-auth/adapter-sqlite');
const db = require('./database');

const adapter = new BetterSqlite3Adapter(db, {
  user: 'user',
  session: 'user_session',
});

const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === 'production',
    },
  },
  getUserAttributes(attributes) {
    return {
      username: attributes.username,
      email: attributes.email,
      isVerified: attributes.is_verified === 1,
    };
  },
});

module.exports = lucia;
