const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'neondb',
  process.env.DB_USER || 'neondb_owner',
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Esto permite conectarse a Neon sin problemas de certificados
      }
    }
  }
);

module.exports = sequelize;
