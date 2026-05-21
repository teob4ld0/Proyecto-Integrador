const lucia = require('../config/auth');

/**
 * Fastify preHandler — valida el session ID enviado como Bearer token.
 * Adjunta `request.user` y `request.session` si es válido.
 */
async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ message: 'Token no proporcionado.' });
  }

  const sessionId = authHeader.slice(7);

  const { session, user } = await lucia.validateSession(sessionId);
  if (!session) {
    return reply.status(401).send({ message: 'Sesión inválida o expirada.' });
  }

  request.session = session;
  request.user = user;
}

module.exports = authenticate;
