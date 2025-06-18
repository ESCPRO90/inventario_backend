const express = require('express');
const { body, param, query } = require('express-validator');
const clientesController = require('../controllers/clientesController');
const { verificarToken, esAdminOFacturador } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verificarToken);

// Listar clientes
router.get('/', [
  query('pagina').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo').toInt(),
  query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100').toInt(),
  query('buscar').optional().isString().trim().escape().withMessage('Búsqueda inválida'),
  query('tipo').optional().isIn(['hospital', 'clinica', 'medico', 'otro']).withMessage('Tipo inválido'),
  query('credito_activo').optional().isBoolean().withMessage('credito_activo debe ser booleano').toBoolean(),
  query('orden').optional().isIn(['codigo', 'nombre', 'tipo', 'created_at']).withMessage('Orden inválido'),
  query('direccion').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).toUpperCase().withMessage('Dirección inválida')
], clientesController.listarClientes);

// Buscar clientes (autocomplete)
router.get('/buscar', [
  query('q').notEmpty().withMessage('Término de búsqueda requerido'),
  query('limite').optional().isInt({ min: 1, max: 50 }).withMessage('Límite debe estar entre 1 y 50')
], clientesController.buscarClientes);

// Obtener cliente por ID
router.get('/:id', [
  param('id').isInt().withMessage('ID inválido'),
  query('incluir_estado_cuenta').optional().isBoolean().withMessage('incluir_estado_cuenta debe ser booleano')
], clientesController.obtenerCliente);

// Obtener estado de cuenta
router.get('/:id/estado-cuenta', [
  param('id').isInt().withMessage('ID inválido')
], clientesController.estadoCuenta);

// Verificar crédito disponible
router.get('/:id/verificar-credito', [
  param('id').isInt().withMessage('ID inválido'),
  query('monto').optional().isFloat({ min: 0 }).withMessage('Monto debe ser un número positivo')
], clientesController.verificarCredito);

// Crear cliente (solo admin o facturador)
router.post('/', esAdminOFacturador, [
  body('codigo')
    .trim()
    .notEmpty().withMessage('Código es requerido')
    .isLength({ max: 20 }).withMessage('Código muy largo')
    .matches(/^[A-Z0-9-]+$/).withMessage('Código solo puede contener letras mayúsculas, números y guiones'),
  body('nombre')
    .trim()
    .notEmpty().withMessage('Nombre es requerido')
    .isLength({ min: 3, max: 100 }).withMessage('Nombre debe tener entre 3 y 100 caracteres'),
  body('tipo')
    .optional()
    .isIn(['hospital', 'clinica', 'medico', 'otro']).withMessage('Tipo inválido'),
  body('nit')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('NIT muy largo'),
  body('nrc')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('NRC muy largo'),
  body('direccion')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Dirección muy larga'),
  body('telefono')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('Teléfono muy largo')
    .matches(/^[\d\s\-\+\(\)]+$/).withMessage('Formato de teléfono inválido'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),
  body('contacto')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Nombre de contacto muy largo'),
  body('credito_activo')
    .optional()
    .isBoolean().withMessage('credito_activo debe ser booleano'),
  body('limite_credito')
    .optional()
    .isFloat({ min: 0 }).withMessage('Límite de crédito debe ser mayor o igual a 0')
], clientesController.crearCliente);

// Actualizar cliente (solo admin o facturador)
router.put('/:id', esAdminOFacturador, [
  param('id').isInt().withMessage('ID inválido'),
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 }).withMessage('Nombre debe tener entre 3 y 100 caracteres'),
  body('tipo')
    .optional()
    .isIn(['hospital', 'clinica', 'medico', 'otro']).withMessage('Tipo inválido'),
  body('nit')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('NIT muy largo'),
  body('nrc')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('NRC muy largo'),
  body('direccion')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Dirección muy larga'),
  body('telefono')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('Teléfono muy largo')
    .matches(/^[\d\s\-\+\(\)]*$/).withMessage('Formato de teléfono inválido'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),
  body('contacto')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Nombre de contacto muy largo'),
  body('credito_activo')
    .optional()
    .isBoolean().withMessage('credito_activo debe ser booleano'),
  body('limite_credito')
    .optional()
    .isFloat({ min: 0 }).withMessage('Límite de crédito debe ser mayor o igual a 0')
], clientesController.actualizarCliente);

// Desactivar cliente (solo admin o facturador)
router.delete('/:id', esAdminOFacturador, [
  param('id').isInt().withMessage('ID inválido')
], clientesController.desactivarCliente);

module.exports = router;