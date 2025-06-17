const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

// Importar middleware de manejo de errores
const errorHandler = require('./middleware/errorHandler');

// Crear aplicación Express
const app = express();

// Configuración de CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};

// Middlewares globales
app.use(helmet()); // Seguridad
app.use(cors(corsOptions)); // CORS
app.use(compression()); // Comprimir respuestas
app.use(express.json()); // Parser JSON
app.use(express.urlencoded({ extended: true })); // Parser URL
app.use(morgan('dev')); // Logging

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({
    message: 'API de Inventario Médico',
    version: '1.0.0',
    status: 'OK'
  });
});

// Información de la API
app.get('/api', (req, res) => {
  res.json({
    message: 'API de Inventario Médico',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      productos: '/api/productos',
      proveedores: '/api/proveedores',
      entradas: '/api/entradas',
      inventario: '/api/inventario'
    },
    documentation: 'Usa un token JWT en el header Authorization para acceder a los endpoints'
  });
});

// Importar rutas
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/productos', require('./routes/productosRoutes'));
app.use('/api/proveedores', require('./routes/proveedoresRoutes'));
app.use('/api/entradas', require('./routes/entradasRoutes'));
app.use('/api/inventario', require('./routes/inventarioRoutes'));
app.use('/api/clientes', require('./routes/clientesRoutes'));
app.use('/api/salidas', require('./routes/salidasRoutes'));
// app.use('/api/facturas', require('./routes/facturasRoutes'));

// Ruta no encontrada
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Middleware de manejo de errores (debe ir al final)
app.use(errorHandler);

module.exports = app;