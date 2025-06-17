const express = require('express');
const { body, param, query } = require('express-validator');
const proveedoresController = require('../controllers/proveedoresController');
const { verificarToken, esAdminOBodeguero } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verificarToken);

// Listar proveedores
router.get('/', [
  query('pagina').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
  query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
  query('orden').optional().isIn(['codigo', 'nombre', 'created_at']).withMessage('Orden inválido'),
  query('direccion').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).withMessage('Dirección inválida')
], proveedoresController.listarProveedores);

// Buscar proveedores (autocomplete)
router.get('/buscar', [
  query('q').notEmpty().withMessage('Término de búsqueda requerido'),
  query('limite').optional().isInt({ min: 1, max: 50 }).withMessage('Límite debe estar entre 1 y 50')
], proveedoresController.buscarProveedores);

// Obtener proveedor por ID
router.get('/:id', [
  param('id').isInt().withMessage('ID inválido'),
  query('incluir_productos').optional().isBoolean().withMessage('incluir_productos debe ser booleano'),
  query('incluir_estadisticas').optional().isBoolean().withMessage('incluir_estadisticas debe ser booleano')
], proveedoresController.obtenerProveedor);

// Obtener productos del proveedor
router.get('/:id/productos', [
  param('id').isInt().withMessage('ID inválido')
], proveedoresController.productosDelProveedor);

// Obtener estadísticas del proveedor
router.get('/:id/estadisticas', [
  param('id').isInt().withMessage('ID inválido')
], proveedoresController.estadisticasProveedor);

// Crear proveedor (solo admin o bodeguero)
router.post('/', esAdminOBodeguero, [
  body('codigo')
    .trim()
    .notEmpty().withMessage('Código es requerido')
    .isLength({ max: 20 }).withMessage('Código muy largo')
    .matches(/^[A-Z0-9-]+$/).withMessage('Código solo puede contener letras mayúsculas, números y guiones'),
  body('nombre')
    .trim()
    .notEmpty().withMessage('Nombre es requerido')
    .isLength({ min: 3, max: 100 }).withMessage('Nombre debe tener entre 3 y 100 caracteres'),
  body('nit')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('NIT muy largo'),
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
    .isLength({ max: 100 }).withMessage('Nombre de contacto muy largo')
], proveedoresController.crearProveedor);

// Actualizar proveedor (solo admin o bodeguero)
router.put('/:id', esAdminOBodeguero, [
  param('id').isInt().withMessage('ID inválido'),
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 }).withMessage('Nombre debe tener entre 3 y 100 caracteres'),
  body('nit')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('NIT muy largo'),
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
    .isLength({ max: 100 }).withMessage('Nombre de contacto muy largo')
], proveedoresController.actualizarProveedor);

// Desactivar proveedor (solo admin o bodeguero)
router.delete('/:id', esAdminOBodeguero, [
  param('id').isInt().withMessage('ID inválido')
], proveedoresController.desactivarProveedor);

module.exports = router;