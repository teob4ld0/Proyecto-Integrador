const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const sequelize = require('./config/database');
require('./models'); // registrar asociaciones

const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 8080;

// ---- MIDDLEWARES ----
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
  apis: [], // se puede agregar JSDoc en las rutas más adelante
});

app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ---- RUTAS ----
app.use('/api/auth', userRoutes);

// ---- INICIAR SERVIDOR ----
async function start() {
  try {
    await sequelize.authenticate();
    console.log('Conexión a PostgreSQL establecida.');

    // Crear tablas si no existen (equivalente a EnsureCreated)
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
