module.exports = {
  key: process.env.JWT_KEY || 'UnaClaveSecretaMuyLargaYSeguraParaJWT_12345!',
  issuer: process.env.JWT_ISSUER || 'DanmakrewAPI',
  audience: process.env.JWT_AUDIENCE || 'DanmakrewUsers',
  expiresIn: '2h',
};
