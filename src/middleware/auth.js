const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

// Verificar token JWT
const verificarToken = async (req, res, next) => {
  try {
    // Obtener token del header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No se proporcionó token de autenticación'
      });
    }
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar usuario
    const usuario = await Usuario.buscarPorId(decoded.id);
    
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido - Usuario no encontrado'
      });
    }
    
    // Agregar usuario a la request
    req.usuario = usuario;
    req.token = token;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error al verificar autenticación'
    });
  }
};

// Verificar rol específico
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }
    
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción'
      });
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