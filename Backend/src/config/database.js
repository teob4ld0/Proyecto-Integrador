const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/danmakrew.db');

const db = new Database(DB_PATH);

// Rendimiento
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---- Schema ----
db.exec(`
  CREATE TABLE IF NOT EXISTS user (
    id          TEXT    NOT NULL PRIMARY KEY,
    username    TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    is_verified INTEGER NOT NULL DEFAULT 0,
    verification_token TEXT,
    danmas      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_session (
    id         TEXT    NOT NULL PRIMARY KEY,
    user_id    TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS friend (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    friend_user_id TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, friend_user_id)
  );

  CREATE TABLE IF NOT EXISTS friend_request (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id   TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    receiver_id TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    status      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT    NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
    scraps   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inventory_character_skin (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    skin_id      INTEGER NOT NULL,
    UNIQUE(inventory_id, skin_id)
  );

  CREATE TABLE IF NOT EXISTS inventory_effect_skin (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    skin_id      INTEGER NOT NULL,
    UNIQUE(inventory_id, skin_id)
  );

  CREATE TABLE IF NOT EXISTS chip (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    name     TEXT    NOT NULL,
    rarity   TEXT    NOT NULL,
    level    INTEGER NOT NULL DEFAULT 1,
    modifiers TEXT,
    image    TEXT,
    scraps   INTEGER NOT NULL DEFAULT 0
  );
`);

module.exports = db;
