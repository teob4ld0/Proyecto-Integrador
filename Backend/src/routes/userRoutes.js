const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs'); // Usabas bcryptjs, lo mantenemos
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const crypto = require('crypto'); // NUEVO: Para generar el token
const { sendVerificationEmail } = require('../utils/mailer'); // NUEVO: El servicio de emails
const { User, Friend, FriendRequest } = require('../models');
const { FRIEND_REQUEST_STATUS } = require('../models/FriendRequest');
const jwtConfig = require('../config/jwt');
const authenticate = require('../middleware/auth');

const router = Router();

// ---- VALIDACIONES ----
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 11 })
    .withMessage('El nombre de usuario debe tener entre 3 y 11 caracteres.')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('El nombre de usuario solo puede contener letras, números y guiones bajos.'),
  body('email')
    .isEmail()
    .withMessage('Email inválido.'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres.'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Email inválido.'),
  body('password').notEmpty().withMessage('La contraseña es requerida.'),
];

// POST /api/users/register (o /api/auth/register dependiendo de tu index.js)
router.post('/register', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send('Error: datos inválidos.');
  }

  try {
    const { username, email, password } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).send('Error: el email ya está registrado.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // NUEVO: Generar token de verificación
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // NUEVO: Crear usuario guardando el token y marcando isVerified como false
    const newUser = await User.create({ 
        username, 
        email, 
        password: hashedPassword,
        verificationToken,
        isVerified: false 
    });

    // NUEVO: Enviar el correo de verificación
    await sendVerificationEmail(newUser.email, newUser.id, verificationToken);

    return res.status(200).send('Usuario registrado. Por favor revisa tu email para verificar tu cuenta.');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error interno del servidor.');
  }
});

// NUEVO: GET /verify-email - Endpoint para validar el token que llega por correo
router.get('/verify-email', async (req, res) => {
  try {
    const { userId, token, email } = req.query;

    if (!userId || !token || !email) {
      return res.status(400).send('Faltan parámetros de verificación.');
    }

    const user = await User.findOne({ 
      where: { 
        id: userId, 
        email: email, 
        verificationToken: token 
      } 
    });

    if (!user) {
      return res.status(400).send('Enlace de verificación inválido o expirado.');
    }

    // Actualizar el usuario a verificado
    user.isVerified = true;
    user.verificationToken = null; // Limpiar el token para que no se re-use
    await user.save();

    return res.status(200).send('Correo verificado exitosamente. Ya puedes iniciar sesión.');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error interno del servidor.');
  }
});

// GET /api/users
router.get('/', async (_req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email'], // excluye password
    });
    return res.json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error interno del servidor.');
  }
});

// POST /api/users/login (o /api/auth/login)
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send('Error: datos inválidos.');
  }

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).send('Error: credenciales incorrectas.');
    }

    // NUEVO: Validar si el usuario ha verificado su email
    if (!user.isVerified) {
      return res.status(403).send('Error: Debes verificar tu email antes de iniciar sesión.');
    }

    const token = jwt.sign(
      { sub: user.username, email: user.email },
      jwtConfig.key,
      {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
        expiresIn: jwtConfig.expiresIn,
      }
    );

    return res.json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error interno del servidor.');
  }
});

// GET /api/users/AllGood  — Endpoint público de prueba
router.get('/AllGood', (_req, res) => {
  return res.send('Este endpoint es público. No necesitas estar logueado para verlo.');
});

// GET /api/users/AllAuthorized  — Endpoint protegido de prueba
router.get('/AllAuthorized', authenticate, (_req, res) => {
  return res.send('Sas');
});

// ---- FRIEND REQUEST ENDPOINTS ----

// POST /api/users/:id/friend-request  — Enviar solicitud de amistad
router.post('/:id/friend-request', authenticate, async (req, res) => {
  try {
    const receiverId = parseInt(req.params.id, 10);
    const sender = await User.findOne({ where: { email: req.user.email } });
    if (!sender) return res.status(401).send('No autorizado.');

    if (sender.id === receiverId) {
      return res.status(400).send('No puedes enviarte una solicitud a ti mismo.');
    }

    const receiver = await User.findByPk(receiverId);
    if (!receiver) return res.status(404).send('Usuario no encontrado.');

    const alreadyFriends = await Friend.findOne({
      where: { UserId: sender.id, FriendUserId: receiverId },
    });
    if (alreadyFriends) return res.status(400).send('Ya son amigos.');

    const alreadyPending = await FriendRequest.findOne({
      where: {
        Status: FRIEND_REQUEST_STATUS.Pendiente,
        [Op.or]: [
          { SenderId: sender.id, ReceiverId: receiverId },
          { SenderId: receiverId, ReceiverId: sender.id },
        ],
      },
    });
    if (alreadyPending) return res.status(400).send('Ya hay una solicitud pendiente.');

    await FriendRequest.create({
      SenderId: sender.id,
      ReceiverId: receiverId,
    });

    return res.send('Solicitud de amistad enviada.');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error interno del servidor.');
  }
});

// GET /api/users/:id/friend-requests  — Obtener solicitudes pendientes
router.get('/:id/friend-requests', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const currentUser = await User.findOne({ where: { email: req.user.email } });
    if (!currentUser || currentUser.id !== targetId) {
      return res.status(401).send('No tienes permiso.');
    }

    const requests = await FriendRequest.findAll({
      where: {
        ReceiverId: targetId,
        Status: FRIEND_REQUEST_STATUS.Pendiente,
      },
      include: [{ model: User, as: 'sender', attributes: ['id', 'username'] }],
    });

    const result = requests.map((fr) => ({
      requestId: fr.id,
      senderId: fr.SenderId,
      senderName: fr.sender.username,
      status: Object.keys(FRIEND_REQUEST_STATUS).find(
        (k) => FRIEND_REQUEST_STATUS[k] === fr.Status
      ),
      createdAt: fr.CreatedAt,
    }));

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error interno del servidor.');
  }
});

// POST /api/users/friend-requests/:requestId/accept  — Aceptar solicitud
router.post('/friend-requests/:requestId/accept', authenticate, async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    const currentUser = await User.findOne({ where: { email: req.user.email } });
    if (!currentUser) return res.status(401).send('No autorizado.');

    const request = await FriendRequest.findByPk(requestId);
    if (!request) return res.status(404).send('Solicitud no encontrada.');

    if (request.ReceiverId !== currentUser.id) {
      return res.status(401).send('Esta solicitud no es para ti.');
    }

    if (request.Status !== FRIEND_REQUEST_STATUS.Pendiente) {
      return res.status(400).send('Esta solicitud ya fue procesada.');
    }

    request.Status = FRIEND_REQUEST_STATUS.Aceptada;
    await request.save();

    // Crear amistad bidireccional
    await Friend.bulkCreate([
      { UserId: request.SenderId, FriendUserId: request.ReceiverId },
      { UserId: request.ReceiverId, FriendUserId: request.SenderId },
    ]);

    return res.send('Solicitud aceptada. Ahora son amigos.');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error interno del servidor.');
  }
});

module.exports = router;