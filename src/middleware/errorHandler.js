// Middleware para manejo centralizado de errores
const errorHandler = (err, req, res, next) => {
  // Log del error para debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Determinar el código de estado
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';

  // Errores de validación de express-validator
  if (err.array && typeof err.array === 'function') {
    statusCode = 400;
    message = 'Error de validación';
    const errors = err.array();
    return res.status(statusCode).json({
      success: false,
      message,
      errors
    });
  }

  // Errores de MySQL
  if (err.code) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        statusCode = 400;
        message = 'El registro ya existe';
        break;
      case 'ER_NO_REFERENCED_ROW_2':
        statusCode = 400;
        message = 'Referencia a registro inexistente';
        break;
      case 'ER_ROW_IS_REFERENCED_2':
        statusCode = 400;
        message = 'No se puede eliminar, el registro está siendo utilizado';
        break;
      default:
        if (err.code.startsWith('ER_')) {
          statusCode = 400;
          message = 'Error en la base de datos';
        }
    }
  }

  // Errores de JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token inválido';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expirado';
  }

  // Respuesta de error
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { 
      error: err.message,
      stack: err.stack 
    })
  });
};

module.exports = errorHandler;