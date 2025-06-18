const express = require('express');
const { body, param, query } = require('express-validator');
const productosController = require('../controllers/productosController');
const { verificarToken, esAdminOBodeguero } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verificarToken);

// RUTAS DE PRODUCTOS

// Listar productos con paginación y filtros
router.get('/', [
  query('pagina').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo').toInt(),
  query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100').toInt(),
  query('buscar').optional().isString().trim().escape().withMessage('Búsqueda inválida'),
  query('categoria_id').optional().isInt({ min: 1 }).withMessage('ID de categoría inválido').toInt(),
  query('disponibles').optional().isBoolean().withMessage('Parámetro "disponibles" debe ser booleano').toBoolean(),
  query('orden').optional().isIn(['codigo', 'descripcion', 'stock_actual', 'created_at', 'precio_venta']).withMessage('Orden inválido'),
  query('direccion').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).toUpperCase().withMessage('Dirección inválida')
], productosController.listarProductos);

// Buscar productos (autocomplete)
router.get('/buscar', [
  query('q').notEmpty().withMessage('Término de búsqueda requerido').trim().escape(),
  query('limite').optional().isInt({ min: 1, max: 50 }).withMessage('Límite debe estar entre 1 y 50').toInt()
], productosController.buscarProductos);

// Productos con stock bajo
router.get('/stock-bajo', productosController.productosStockBajo); // No query params typically

// Productos próximos a vencer
router.get('/proximos-vencer', [
  query('dias').optional().isInt({ min: 1, max: 365 }).withMessage('Días debe estar entre 1 y 365').toInt()
], productosController.productosProximosVencer);

// Listar categorías - DEBE IR ANTES DE /:id
router.get('/categorias/listar', [
  query('pagina').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo').toInt(),
  query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100').toInt(),
  query('buscar').optional().isString().trim().escape().withMessage('Búsqueda inválida'),
  query('orden').optional().isAlpha('es-ES', {ignore: '._'}).escape().withMessage('Orden inválido'),
  query('direccion').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).toUpperCase().withMessage('Dirección inválida')
], productosController.listarCategorias);

// Obtener producto por ID
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID de producto inválido').toInt(),
  query('incluir_stock').optional().isBoolean().withMessage('incluir_stock debe ser booleano').toBoolean()
], productosController.obtenerProducto);

// Crear producto (solo admin o bodeguero)
router.post('/', esAdminOBodeguero, [
  body('codigo')
    .trim()
    .notEmpty().withMessage('Código es requerido')
    .isLength({ max: 50 }).withMessage('Código muy largo'),
  body('referencia')
    .trim()
    .notEmpty().withMessage('Referencia es requerida')
    .isLength({ max: 100 }).withMessage('Referencia muy larga'),
  body('descripcion')
    .trim()
    .notEmpty().withMessage('Descripción es requerida'),
  body('categoria_id')
    .optional()
    .isInt().withMessage('ID de categoría inválido'),
  body('unidad_medida')
    .optional()
    .isIn(['UNIDAD', 'CAJA', 'PAQUETE', 'FRASCO', 'TUBO', 'BOLSA'])
    .withMessage('Unidad de medida inválida'),
  body('precio_compra')
    .optional()
    .isFloat({ min: 0 }).withMessage('Precio de compra debe ser mayor o igual a 0'),
  body('precio_venta')
    .optional()
    .isFloat({ min: 0 }).withMessage('Precio de venta debe ser mayor o igual a 0'),
  body('requiere_lote')
    .optional()
    .isBoolean().withMessage('requiere_lote debe ser booleano'),
  body('requiere_vencimiento')
    .optional()
    .isBoolean().withMessage('requiere_vencimiento debe ser booleano'),
  body('stock_minimo')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock mínimo debe ser mayor o igual a 0'),
  body('stock_maximo')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock máximo debe ser mayor o igual a 0')
    .custom((value, { req }) => {
      if (value > 0 && req.body.stock_minimo && value <= req.body.stock_minimo) {
        throw new Error('Stock máximo debe ser mayor que stock mínimo');
      }
      return true;
    })
], productosController.crearProducto);

// Actualizar producto (solo admin o bodeguero)
router.put('/:id', esAdminOBodeguero, [
  param('id').isInt().withMessage('ID inválido'),
  body('referencia')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Referencia muy larga'),
  body('descripcion')
    .optional()
    .trim()
    .notEmpty().withMessage('Descripción no puede estar vacía'),
  body('categoria_id')
    .optional()
    .isInt().withMessage('ID de categoría inválido'),
  body('unidad_medida')
    .optional()
    .isIn(['UNIDAD', 'CAJA', 'PAQUETE', 'FRASCO', 'TUBO', 'BOLSA'])
    .withMessage('Unidad de medida inválida'),
  body('precio_compra')
    .optional()
    .isFloat({ min: 0 }).withMessage('Precio de compra debe ser mayor o igual a 0'),
  body('precio_venta')
    .optional()
    .isFloat({ min: 0 }).withMessage('Precio de venta debe ser mayor o igual a 0'),
  body('requiere_lote')
    .optional()
    .isBoolean().withMessage('requiere_lote debe ser booleano'),
  body('requiere_vencimiento')
    .optional()
    .isBoolean().withMessage('requiere_vencimiento debe ser booleano'),
  body('stock_minimo')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock mínimo debe ser mayor o igual a 0'),
  body('stock_maximo')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock máximo debe ser mayor o igual a 0')
], productosController.actualizarProducto);

// Desactivar producto (solo admin o bodeguero)
router.delete('/:id', esAdminOBodeguero, [
  param('id').isInt().withMessage('ID inválido')
], productosController.desactivarProducto);

// RUTAS DE CATEGORÍAS

// Crear categoría (solo admin o bodeguero)
router.post('/categorias', esAdminOBodeguero, [
  body('nombre')
    .trim()
    .notEmpty().withMessage('Nombre es requerido')
    .isLength({ max: 50 }).withMessage('Nombre muy largo'),
  body('descripcion')
    .optional()
    .trim()
], productosController.crearCategoria);

// Actualizar categoría (solo admin o bodeguero)
router.put('/categorias/:id', esAdminOBodeguero, [
  param('id').isInt().withMessage('ID inválido'),
  body('nombre')
    .trim()
    .notEmpty().withMessage('Nombre es requerido')
    .isLength({ max: 50 }).withMessage('Nombre muy largo'),
  body('descripcion')
    .optional()
    .trim()
], productosController.actualizarCategoria);

// Desactivar categoría (solo admin o bodeguero)
router.delete('/categorias/:id', esAdminOBodeguero, [
  param('id').isInt().withMessage('ID inválido')
], productosController.desactivarCategoria);

module.exports = router;