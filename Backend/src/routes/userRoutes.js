const { z } = require('zod');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { generateId } = require('lucia');
const lucia = require('../config/auth');
const authenticate = require('../middleware/auth');
const { User, Friend, FriendRequest, FRIEND_REQUEST_STATUS } = require('../models');
const { sendVerificationEmail } = require('../utils/mailer');

// ---- Schemas Zod ----
const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.')
    .max(11, 'El nombre de usuario no puede superar 11 caracteres.')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos.'),
  email: z.string().email('Email inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido.'),
  password: z.string().min(1, 'La contraseña es requerida.'),
});

const resendVerificationSchema = z.object({
  email: z.string().email('Email inválido.'),
});

async function userRoutes(fastify) {
  // POST /register
  fastify.post('/register', async (request, reply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ message: result.error.issues[0].message });
    }

    const { username, email, password } = result.data;

    const existingUser = User.findByEmail(email);
    if (existingUser) {
      if (existingUser.is_verified) {
        return reply.status(400).send({ message: 'El email ya está registrado.' });
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      User.setVerificationToken(existingUser.id, verificationToken);

      try {
        await sendVerificationEmail(existingUser.email, existingUser.id, verificationToken);
      } catch (err) {
        fastify.log.warn({ err }, 'No se pudo reenviar el email de verificación.');
      }

      return reply.send({
        message: 'Ese email ya está registrado, pero no verificado. Te reenviamos el correo de verificación.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const userId = generateId(15);

    const newUser = User.create({ id: userId, username, email, password: hashedPassword, verificationToken });

    try {
      await sendVerificationEmail(newUser.email, newUser.id, verificationToken);
    } catch (err) {
      fastify.log.warn({ err }, 'No se pudo enviar el email de verificación.');
    }

    return reply.send({ message: 'Usuario registrado. Por favor revisa tu email para verificar tu cuenta.' });
  });

  // GET /verify-email
  fastify.get('/verify-email', async (request, reply) => {
    const { userId, token, email } = request.query;

    if (!userId || !token || !email) {
      return reply.status(400).send({ message: 'Faltan parámetros de verificación.' });
    }

    const user = User.findById(userId);
    if (!user || user.email !== email || user.verification_token !== token) {
      return reply.status(400).send({ message: 'Enlace de verificación inválido o expirado.' });
    }

    User.verify(userId);

    return reply.send({ message: 'Correo verificado exitosamente. Ya puedes iniciar sesión.' });
  });

  // POST /resend-verification
  fastify.post('/resend-verification', async (request, reply) => {
    const result = resendVerificationSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ message: result.error.issues[0].message });
    }

    const { email } = result.data;
    const user = User.findByEmail(email);

    if (!user) {
      return reply.status(404).send({ message: 'No existe una cuenta con ese email.' });
    }

    if (user.is_verified) {
      return reply.status(400).send({ message: 'Tu cuenta ya está verificada. Puedes iniciar sesión.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    User.setVerificationToken(user.id, verificationToken);

    try {
      await sendVerificationEmail(user.email, user.id, verificationToken);
    } catch (err) {
      fastify.log.warn({ err }, 'No se pudo reenviar el email de verificación.');
      return reply.status(500).send({ message: 'No se pudo reenviar el correo. Intenta nuevamente.' });
    }

    return reply.send({ message: 'Correo de verificación reenviado. Revisa tu bandeja.' });
  });

  // GET / — listar usuarios
  fastify.get('/', async (_request, reply) => {
    return reply.send(User.findAll());
  });

  // POST /login
  fastify.post('/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ message: result.error.issues[0].message });
    }

    const { email, password } = result.data;

    const user = User.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return reply.status(401).send({ message: 'Credenciales incorrectas.' });
    }

    if (!user.is_verified) {
      return reply.status(403).send({ message: 'Debes verificar tu email antes de iniciar sesión.' });
    }

    const session = await lucia.createSession(user.id, {});

    return reply.send({ token: session.id, username: user.username, userId: user.id });
  });

  // POST /logout
  fastify.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    await lucia.invalidateSession(request.session.id);
    return reply.send({ message: 'Sesión cerrada.' });
  });

  // GET /AllGood — endpoint público de prueba
  fastify.get('/AllGood', async (_request, reply) => {
    return reply.send('Este endpoint es público. No necesitas estar logueado para verlo.');
  });

  // GET /AllAuthorized — endpoint protegido de prueba
  fastify.get('/AllAuthorized', { preHandler: authenticate }, async (_request, reply) => {
    return reply.send('Autorizado.');
  });

  // GET /me — devuelve info del usuario autenticado
  fastify.get('/me', { preHandler: authenticate }, async (request, reply) => {
    return reply.send({
      id: request.user.id,
      username: request.user.username,
      email: request.user.email,
    });
  });

  // ---- FRIEND REQUEST ENDPOINTS ----

  // POST /:id/friend-request
  fastify.post('/:id/friend-request', { preHandler: authenticate }, async (request, reply) => {
    const receiverId = request.params.id;
    const senderId = request.user.id;

    if (senderId === receiverId) {
      return reply.status(400).send({ message: 'No puedes enviarte una solicitud a ti mismo.' });
    }

    if (!User.findById(receiverId)) {
      return reply.status(404).send({ message: 'Usuario no encontrado.' });
    }

    if (Friend.exists(senderId, receiverId)) {
      return reply.status(400).send({ message: 'Ya son amigos.' });
    }

    if (FriendRequest.hasPending(senderId, receiverId)) {
      return reply.status(400).send({ message: 'Ya hay una solicitud pendiente.' });
    }

    FriendRequest.create(senderId, receiverId);

    return reply.send({ message: 'Solicitud de amistad enviada.' });
  });

  // GET /:id/friend-requests
  fastify.get('/:id/friend-requests', { preHandler: authenticate }, async (request, reply) => {
    const targetId = request.params.id;

    if (request.user.id !== targetId) {
      return reply.status(403).send({ message: 'No tienes permiso.' });
    }

    const requests = FriendRequest.findPendingForReceiver(targetId);

    const result = requests.map((fr) => ({
      requestId: fr.id,
      senderId: fr.sender_id,
      senderName: fr.sender_username,
      status: Object.keys(FRIEND_REQUEST_STATUS).find(
        (k) => FRIEND_REQUEST_STATUS[k] === fr.status
      ),
      createdAt: fr.created_at,
    }));

    return reply.send(result);
  });

  // POST /friend-requests/:requestId/accept
  fastify.post('/friend-requests/:requestId/accept', { preHandler: authenticate }, async (request, reply) => {
    const requestId = parseInt(request.params.requestId, 10);
    const currentUserId = request.user.id;

    const fr = FriendRequest.findById(requestId);
    if (!fr) return reply.status(404).send({ message: 'Solicitud no encontrada.' });

    if (fr.receiver_id !== currentUserId) {
      return reply.status(403).send({ message: 'Esta solicitud no es para ti.' });
    }

    if (fr.status !== FRIEND_REQUEST_STATUS.Pendiente) {
      return reply.status(400).send({ message: 'Esta solicitud ya fue procesada.' });
    }

    FriendRequest.updateStatus(requestId, FRIEND_REQUEST_STATUS.Aceptada);
    Friend.createPair(fr.sender_id, fr.receiver_id);

    return reply.send({ message: 'Solicitud aceptada. Ahora son amigos.' });
  });
}

module.exports = userRoutes;