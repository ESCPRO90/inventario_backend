const express = require('express');
const { body, param, query } = require('express-validator');
const entradasController = require('../controllers/entradasController');
const { verificarToken, esAdminOBodeguero } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verificarToken);

// Validaciones para detalles
const validarDetalles = [
  body('detalles')
    .isArray({ min: 1 }).withMessage('Debe incluir al menos un producto')
    .custom((detalles) => {
      for (const detalle of detalles) {
        if (!detalle.producto_id || !detalle.cantidad || detalle.precio_unitario === undefined) {
          return false;
        }
      }
      return true;
    }).withMessage('Cada detalle debe tener producto_id, cantidad y precio_unitario'),
  body('detalles.*.producto_id')
    .isInt({ min: 1 }).withMessage('ID de producto inválido'),
  body('detalles.*.cantidad')
    .isInt({ min: 1 }).withMessage('Cantidad debe ser mayor a 0'),
  body('detalles.*.precio_unitario')
    .isFloat({ min: 0 }).withMessage('Precio debe ser mayor o igual a 0'),
  body('detalles.*.lote')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Lote muy largo'),
  body('detalles.*.fecha_vencimiento')
    .optional()
    .isISO8601().withMessage('Fecha de vencimiento inválida')
    .custom((value) => {
      const fecha = new Date(value);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      return fecha > hoy;
    }).withMessage('La fecha de vencimiento debe ser futura')
];

// Listar entradas
router.get('/', [
  query('pagina').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
  query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
  query('proveedor_id').optional().isInt().withMessage('ID de proveedor inválido'),
  query('fecha_inicio').optional().isISO8601().withMessage('Fecha inicio inválida'),
  query('fecha_fin').optional().isISO8601().withMessage('Fecha fin inválida'),
  query('estado').optional().isIn(['pendiente', 'procesada', 'anulada']).withMessage('Estado inválido'),
  query('orden').optional().isIn(['fecha', 'numero_entrada', 'total']).withMessage('Orden inválido'),
  query('direccion').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).withMessage('Dirección inválida')
], entradasController.listarEntradas);

// Estadísticas
router.get('/estadisticas', [
  query('fecha_inicio').optional().isISO8601().withMessage('Fecha inicio inválida'),
  query('fecha_fin').optional().isISO8601().withMessage('Fecha fin inválida'),
  query('proveedor_id').optional().isInt().withMessage('ID de proveedor inválido')
], entradasController.obtenerEstadisticas);

// Entradas recientes
router.get('/recientes', [
  query('limite').optional().isInt({ min: 1, max: 50 }).withMessage('Límite debe estar entre 1 y 50')
], entradasController.entradasRecientes);

// Generar número de entrada
router.get('/generar-numero', esAdminOBodeguero, entradasController.generarNumeroEntrada);

// Validar entrada (preview)
router.post('/validar', esAdminOBodeguero, [
  body('proveedor_id')
    .isInt({ min: 1 }).withMessage('ID de proveedor inválido'),
  ...validarDetalles
], entradasController.validarEntrada);

// Obtener entrada por ID
router.get('/:id', [
  param('id').isInt().withMessage('ID inválido')
], entradasController.obtenerEntrada);

// Crear entrada (solo admin o bodeguero)
router.post('/', esAdminOBodeguero, [
  body('proveedor_id')
    .isInt({ min: 1 }).withMessage('Proveedor es requerido'),
  body('tipo_documento')
    .optional()
    .isIn(['factura', 'remision', 'orden_compra']).withMessage('Tipo de documento inválido'),
  body('numero_documento')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Número de documento muy largo'),
  body('fecha')
    .isISO8601().withMessage('Fecha inválida')
    .custom((value) => {
      const fecha = new Date(value);
      const hoy = new Date();
      return fecha <= hoy;
    }).withMessage('La fecha no puede ser futura'),
  body('observaciones')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Observaciones muy largas'),
  ...validarDetalles
], entradasController.crearEntrada);

// Anular entrada (solo admin)
router.post('/:id/anular', esAdminOBodeguero, [
  param('id').isInt().withMessage('ID inválido')
], entradasController.anularEntrada);

module.exports = router;