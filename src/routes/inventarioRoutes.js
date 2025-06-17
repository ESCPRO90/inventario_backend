const express = require('express');
const { body, param, query } = require('express-validator');
const inventarioController = require('../controllers/inventarioController');
const { verificarToken, esAdminOBodeguero } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verificarToken);

// Obtener inventario general
router.get('/', [
  query('pagina').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
  query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
  query('producto_id').optional().isInt().withMessage('ID de producto inválido'),
  query('proveedor_id').optional().isInt().withMessage('ID de proveedor inválido'),
  query('estado').optional().isIn(['disponible', 'reservado', 'vencido', 'agotado']).withMessage('Estado inválido'),
  query('proximos_vencer').optional().isInt({ min: 1, max: 365 }).withMessage('Días debe estar entre 1 y 365'),
  query('orden').optional().isIn(['producto_codigo', 'fecha_vencimiento', 'cantidad_actual', 'lote']).withMessage('Orden inválido'),
  query('direccion').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).withMessage('Dirección inválida')
], inventarioController.obtenerInventario);

// Obtener resumen de inventario
router.get('/resumen', inventarioController.obtenerResumen);

// Exportar inventario
router.get('/exportar', [
  query('formato').optional().isIn(['json', 'csv']).withMessage('Formato debe ser json o csv')
], inventarioController.exportarInventario);

// Obtener kardex de un producto
router.get('/kardex/:producto_id', [
  param('producto_id').isInt().withMessage('ID de producto inválido'),
  query('fecha_inicio').optional().isISO8601().withMessage('Fecha inicio inválida'),
  query('fecha_fin').optional().isISO8601().withMessage('Fecha fin inválida'),
  query('tipo_movimiento').optional().isIn(['entrada', 'salida', 'ajuste', 'devolucion']).withMessage('Tipo de movimiento inválido'),
  query('limite').optional().isInt({ min: 1, max: 200 }).withMessage('Límite debe estar entre 1 y 200')
], inventarioController.obtenerKardex);

// Ajustar inventario (solo admin o bodeguero)
router.post('/ajustar', esAdminOBodeguero, [
  body('inventario_id')
    .isInt({ min: 1 }).withMessage('ID de inventario inválido'),
  body('cantidad_nueva')
    .isInt({ min: 0 }).withMessage('Cantidad debe ser mayor o igual a 0'),
  body('motivo')
    .trim()
    .notEmpty().withMessage('Motivo es requerido')
    .isIn(['ajuste_inventario', 'correccion', 'merma', 'caducidad', 'otro'])
    .withMessage('Motivo inválido'),
  body('observaciones')
    .trim()
    .notEmpty().withMessage('Observaciones son requeridas')
    .isLength({ max: 500 }).withMessage('Observaciones muy largas')
], inventarioController.ajustarInventario);

// Transferir entre lotes (solo admin o bodeguero)
router.post('/transferir', esAdminOBodeguero, [
  body('lote_origen_id')
    .isInt({ min: 1 }).withMessage('ID de lote origen inválido'),
  body('lote_destino_id')
    .isInt({ min: 1 }).withMessage('ID de lote destino inválido')
    .custom((value, { req }) => value !== req.body.lote_origen_id)
    .withMessage('Los lotes origen y destino deben ser diferentes'),
  body('cantidad')
    .isInt({ min: 1 }).withMessage('Cantidad debe ser mayor a 0'),
  body('observaciones')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Observaciones muy largas')
], inventarioController.transferirLotes);

module.exports = router;