require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const rateLimit = require('@fastify/rate-limit');
const redis = require('./config/redis');

const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');

// Start the WebSocket signaling server in the same process
require('./signal');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /\.ngrok(-free)?\.(app|dev|io)$/.test(origin)
      ) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
  });

  // Rate limiting backed by Redis
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (req) =>
      req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
  });

  fastify.register(userRoutes, { prefix: '/api/auth' });
  fastify.register(roomRoutes, { prefix: '/api' });

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`Servidor corriendo en http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    redis.disconnect();
    process.exit(1);
  }
}

start();
