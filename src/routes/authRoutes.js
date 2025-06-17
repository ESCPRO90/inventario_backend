const express = require('express');
const { body, param } = require('express-validator');
const authController = require('../controllers/authController');
const { verificarToken, esAdmin } = require('../middleware/auth');

const router = express.Router();

// Validaciones comunes
const validacionesUsuario = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('El username debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('El username solo puede contener letras, números y guiones bajos'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('nombre_completo')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre completo debe tener entre 3 y 100 caracteres'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  body('rol')
    .optional()
    .isIn(['admin', 'bodeguero', 'facturador', 'vendedor'])
    .withMessage('Rol inválido')
];

// RUTAS PÚBLICAS

// Registro inicial (solo para el primer usuario admin)
router.post('/registro', 
  validacionesUsuario,
  authController.registrar
);

// Login
router.post('/login', [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('El username es requerido'),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
], authController.login);

// RUTAS PROTEGIDAS - Requieren autenticación

// Perfil del usuario actual
router.get('/perfil', 
  verificarToken, 
  authController.perfil
);

// Actualizar perfil propio
router.put('/perfil', 
  verificarToken,
  [
    body('nombre_completo')
      .optional()
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Email inválido')
      .normalizeEmail()
  ],
  authController.actualizarPerfil
);

// Cambiar contraseña propia
router.put('/cambiar-password', 
  verificarToken,
  [
    body('password_actual')
      .notEmpty()
      .withMessage('La contraseña actual es requerida'),
    body('password_nuevo')
      .isLength({ min: 6 })
      .withMessage('La nueva contraseña debe tener al menos 6 caracteres')
      .custom((value, { req }) => value !== req.body.password_actual)
      .withMessage('La nueva contraseña debe ser diferente a la actual')
  ],
  authController.cambiarPassword
);

// Logout
router.post('/logout', 
  verificarToken, 
  authController.logout
);

// RUTAS DE ADMINISTRACIÓN - Solo admin

// Listar todos los usuarios
router.get('/usuarios', 
  verificarToken, 
  esAdmin, 
  authController.listarUsuarios
);

// Crear nuevo usuario
router.post('/usuarios', 
  verificarToken, 
  esAdmin,
  validacionesUsuario,
  authController.crearUsuario
);

// Actualizar usuario
router.put('/usuarios/:id', 
  verificarToken, 
  esAdmin,
  [
    param('id').isInt().withMessage('ID inválido'),
    body('nombre_completo')
      .optional()
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Email inválido')
      .normalizeEmail(),
    body('rol')
      .optional()
      .isIn(['admin', 'bodeguero', 'facturador', 'vendedor'])
      .withMessage('Rol inválido'),
    body('activo')
      .optional()
      .isBoolean()
      .withMessage('El campo activo debe ser booleano')
  ],
  authController.actualizarUsuario
);

// Desactivar usuario
router.delete('/usuarios/:id', 
  verificarToken, 
  esAdmin,
  [
    param('id').isInt().withMessage('ID inválido')
  ],
  authController.desactivarUsuario
);

module.exports = router;