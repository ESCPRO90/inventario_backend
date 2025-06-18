class BaseError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class AuthenticationError extends BaseError {
  constructor(message = 'No autenticado') {
    super(message, 401);
  }
}

class AuthorizationError extends BaseError {
  constructor(message = 'No autorizado') {
    super(message, 403);
  }
}

class NotFoundError extends BaseError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404);
  }
}

class ValidationError extends BaseError {
  constructor(message = 'Error de validación', errorsArray = []) {
    super(message, 400);
    this.errorsArray = errorsArray;
  }
}

class ConflictError extends BaseError {
  constructor(message = 'Conflicto de recurso') {
    super(message, 409);
  }
}

class BusinessLogicError extends BaseError {
  constructor(message = 'Error en la lógica de negocio', statusCode = 400) {
    super(message, statusCode);
  }
}

module.exports = {
  BaseError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ConflictError,
  BusinessLogicError,
};
