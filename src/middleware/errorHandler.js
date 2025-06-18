const {
  BaseError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ConflictError,
  BusinessLogicError
} = require('../utils/customErrors');

// Middleware para manejo centralizado de errores
const errorHandler = (err, req, res, next) => {
  // Log del error para debugging (Consider using a more robust logger like Winston or Pino in production)
  console.error('Error Capturado:', {
    name: err.name,
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    errorsArray: err.errorsArray, // For ValidationError
    code: err.code, // For MySQL errors
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';
  let errors = err.errorsArray; // Specific for ValidationError

  // Handle custom errors first
  if (err instanceof BaseError) {
    statusCode = err.statusCode;
    message = err.message;
    if (err instanceof ValidationError) {
      errors = err.errorsArray;
    }
  } else if (err.array && typeof err.array === 'function') {
    // Handle express-validator errors (can be converted to ValidationError)
    statusCode = 400;
    message = 'Error de validación';
    errors = err.array();
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    // These should now be wrapped in AuthenticationError by `verificarToken`
    // but as a fallback or if used elsewhere:
    statusCode = 401;
    message = err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido';
  } else if (err.code) { // Handle specific MySQL errors if not already wrapped
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        statusCode = 409; // Conflict is more appropriate
        message = 'El registro ya existe o hay un conflicto con un campo único.';
        break;
      case 'ER_NO_REFERENCED_ROW_2':
        statusCode = 400; // Bad request due to invalid foreign key
        message = 'Referencia a un registro inexistente en una tabla relacionada.';
        break;
      case 'ER_ROW_IS_REFERENCED_2':
        statusCode = 400; // Bad request, cannot delete/update
        message = 'No se puede eliminar o actualizar, el registro está siendo utilizado por otras partes del sistema.';
        break;
      default:
        if (err.code.startsWith('ER_')) {
          statusCode = 500; // Potentially a server-side DB issue if not caught as bad request
          message = 'Error en la base de datos. Contacte al administrador.';
        }
    }
  }
  // For any other error that might not have a statusCode, default to 500

  const errorResponse = {
    success: false,
    message,
  };

  if (errors && errors.length > 0) {
    errorResponse.errors = errors;
  }

  if (process.env.NODE_ENV === 'development') {
    errorResponse.errorDetails = {
      name: err.name,
      originalMessage: err.message,
      stack: err.stack
    };
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;