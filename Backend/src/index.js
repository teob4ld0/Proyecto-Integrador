require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const sequelize = require('./config/database');
require('./models'); // registrar asociaciones

// Importamos las rutas de usuario
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 8080;

// ---- MIDDLEWARES ----
app.use(cors());
app.use(express.json());

// ---- SWAGGER ----
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Danmakrew API',
      version: '1.0.0',
      description: 'API del proyecto integrador',
    },
    components: {
      securitySchemes: {
        Bearer: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: "Ingresa 'Bearer' [espacio] y luego tu token.\r\n\r\nEjemplo: \"Bearer eyJhbGci...\"",
        },
      },
    },
    security: [{ Bearer: [] }],
  },
  apis: ['./src/routes/*.js'], // Apuntamos a las rutas para que Swagger las lea
});

app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ---- RUTAS ----
// CAMBIO CLAVE: Usamos /api/auth para sincronizar con el Frontend
app.use('/api/auth', userRoutes);

// ---- INICIAR SERVIDOR ----
async function start() {
  try {
    await sequelize.authenticate();
    console.log('Conexión a PostgreSQL establecida.');

    // Sincronizar modelos con la base de datos
    await sequelize.sync();
    console.log('Tablas sincronizadas.');

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
      console.log(`Swagger UI en http://localhost:${PORT}/swagger`);
    });
  } catch (err) {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
  }
}

start();