'use strict';

const ROOM_ID_REGEX = /^[0-9a-f-]{36}$/i;
const ALLOWED_TYPES = new Set(['join-game', 'start-ready', 'ready', 'input']);
const ALLOWED_ACTIONS = new Set(['shoot', 'special', 'wall', 'laser', 'struggle_push']);

function parseAllowedOrigins() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  if (/^https?:\/\/[a-z0-9-]+\.ngrok(-free)?\.(app|dev|io)$/i.test(origin)) return true;
  return false;
}

function validateClientMessage(msg) {
  if (!msg || typeof msg !== 'object') {
    return { ok: false, reason: 'invalid-payload' };
  }

  if (typeof msg.type !== 'string' || !ALLOWED_TYPES.has(msg.type)) {
    return { ok: false, reason: 'invalid-type' };
  }

  if (msg.type === 'join-game') {
    if (typeof msg.roomId !== 'string' || !ROOM_ID_REGEX.test(msg.roomId)) {
      return { ok: false, reason: 'invalid-room-id' };
    }
  }

  if (msg.type === 'input') {
    if (!Number.isFinite(msg.dx) || !Number.isFinite(msg.dy)) {
      return { ok: false, reason: 'invalid-vector' };
    }
    if (msg.action !== null && msg.action !== undefined) {
      if (typeof msg.action !== 'string' || !ALLOWED_ACTIONS.has(msg.action)) {
        return { ok: false, reason: 'invalid-action' };
      }
    }
    if (msg.seq !== undefined && !Number.isInteger(msg.seq)) {
      return { ok: false, reason: 'invalid-seq' };
    }
    if (msg.clientTs !== undefined && !Number.isFinite(msg.clientTs)) {
      return { ok: false, reason: 'invalid-client-ts' };
    }
  }

  return { ok: true };
}

module.exports = {
  parseAllowedOrigins,
  isOriginAllowed,
  validateClientMessage,
};
