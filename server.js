const app = require('./src/app');
const { testConnection } = require('./src/config/database');

// Puerto
const PORT = process.env.PORT || 3001;

// Función para iniciar el servidor
const startServer = async () => {
  try {
    // Probar conexión a base de datos
    await testConnection();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`
        🚀 Servidor corriendo en puerto ${PORT}
        📍 URL: http://localhost:${PORT}
        🌍 Ambiente: ${process.env.NODE_ENV || 'development'}
      `);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Promesa rechazada no manejada:', error);
  process.exit(1);
});

// Iniciar servidor
startServer();