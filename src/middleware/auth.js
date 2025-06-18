const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const { AuthenticationError, AuthorizationError, NotFoundError } = require('../utils/customErrors');

// Verificar token JWT
const verificarToken = async (req, res, next) => {
  try {
    // Obtener token del header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return next(new AuthenticationError('No se proporcionó token de autenticación'));
    }
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Can throw JsonWebTokenError or TokenExpiredError
    
    // Buscar usuario
    const usuario = await Usuario.buscarPorId(decoded.id);
    
    if (!usuario) {
      // Even if token is valid, user might have been deleted/deactivated
      return next(new AuthenticationError('Token inválido - Usuario no encontrado o inactivo'));
    }
    
    // Agregar usuario a la request
    req.usuario = usuario;
    req.token = token;
    
    next();
  } catch (error) {
    // Catch JWT specific errors and other unexpected errors
    if (error.name === 'JsonWebTokenError') {
      return next(new AuthenticationError('Token inválido'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Token expirado'));
    }
    // For other errors during the process (e.g., DB connection issue in buscarPorId if not caught by model)
    return next(new AuthenticationError('Error al verificar autenticación: ' + error.message));
  }
};

// Verificar rol específico
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      // This should ideally not happen if verificarToken is always run before
      return next(new AuthenticationError('No autenticado. Se requiere token.'));
    }
    
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(new AuthorizationError('No tienes permisos para realizar esta acción'));
    }
    
    next();
  };
};

// Verificar si es admin
const esAdmin = verificarRol('admin');

// Verificar si es admin o facturador
const esAdminOFacturador = verificarRol('admin', 'facturador');

// Verificar si es admin o bodeguero
const esAdminOBodeguero = verificarRol('admin', 'bodeguero');

// Middleware opcional - si hay token lo verifica, si no, continúa
const autenticacionOpcional = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const usuario = await Usuario.buscarPorId(decoded.id);
      
      if (usuario) {
        req.usuario = usuario;
        req.token = token;
      }
    }
    
    next();
  } catch (error) {
    // Si hay error con el token, simplemente continuar sin usuario
    next();
  }
};

module.exports = {
  verificarToken,
  verificarRol,
  esAdmin,
  esAdminOFacturador,
  esAdminOBodeguero,
  autenticacionOpcional
};