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
        /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin) ||
        /\.ngrok(-free)?\.(app|dev|io)$/.test(origin)
      ) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
  });

  // Rate limiting (built-in in-memory cache)
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) =>
      req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
  });

  fastify.get('/', async () => ({
    name: 'Danmakrew API',
    status: 'ok',
    frontendUrl: allowedOrigins[0] || 'http://localhost:3000',
    message: 'Este puerto (8080) es solo la API REST. Abre la web y el juego en http://localhost:3000',
  }));

  fastify.get('/api/health', async () => ({
    status: 'ok',
    wsPort: parseInt(process.env.WS_PORT || '9001', 10),
  }));

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
