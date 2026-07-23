const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
});

const sendVerificationEmail = async (userEmail, userId, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const verifyLink = `${frontendUrl}/verify-email?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}&email=${encodeURIComponent(userEmail)}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: 'Verifica tu cuenta en Danmakrew',
    html: `
      <h2>¡Bienvenido a Danmakrew!</h2>
      <p>Por favor, haz clic en el siguiente enlace para verificar tu cuenta e ingresar a la arena:</p>
      <a href="${verifyLink}" style="display:inline-block; padding:10px 20px; background-color:#ff2d55; color:#fff; text-decoration:none; border-radius:5px;">Verificar Cuenta</a>
      <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
      <p>${verifyLink}</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail };