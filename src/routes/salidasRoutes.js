const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { verificarToken, esAdmin, esAdminOBodeguero, esAdminOFacturador } = require('../middleware/auth');

// Importar el controlador - ASEGÚRATE DE QUE LA RUTA SEA CORRECTA
const {
  listarSalidas,
  obtenerSalida,
  crearSalida,
  actualizarSalida,
  completarSalida,
  cancelarSalida,
  eliminarSalida,
  generarReporte,
  obtenerEstadisticas,
  duplicarSalida
} = require('../controllers/salidasController');

// Aplicar autenticación general
router.use(verificarToken);

// Validadores
const validarCreacion = [
  body('tipo_salida').notEmpty().withMessage('Tipo de salida es requerido'),
  body('detalles').isArray().withMessage('Detalles debe ser un array'),
  body('detalles.*.producto_id').isInt().withMessage('ID de producto debe ser un número'),
  body('detalles.*.cantidad').isInt({ min: 1 }).withMessage('Cantidad debe ser mayor a 0')
];

const validarActualizacion = [
  param('id').isInt().withMessage('ID debe ser un número'),
  body('tipo_salida').optional().notEmpty().withMessage('Tipo de salida no puede estar vacío')
];

const validarId = [
  param('id').isInt().withMessage('ID debe ser un número')
];

// RUTAS

// GET /api/salidas - Listar salidas
router.get('/', esAdminOFacturador, [
  query('pagina').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo').toInt(),
  query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100').toInt(),
  query('buscar').optional().isString().trim().escape().withMessage('Búsqueda inválida'),
  query('tipo_salida').optional().isString().isIn(['venta', 'consignacion', 'maleta', 'donacion', 'ajuste', 'muestra']).withMessage('Tipo de salida inválido'),
  query('cliente_id').optional().isInt({ min: 1 }).withMessage('ID de cliente inválido').toInt(),
  query('maleta_id').optional().isInt({ min: 1 }).withMessage('ID de maleta inválido').toInt(),
  query('usuario_id').optional().isInt({ min: 1 }).withMessage('ID de usuario inválido').toInt(),
  query('estado_salida').optional().isString().isIn(['pendiente', 'procesada', 'completada', 'anulada', 'facturada']).withMessage('Estado de salida inválido'),
  query('fecha_desde').optional().isISO8601().withMessage('Fecha desde inválida').toDate(),
  query('fecha_hasta').optional().isISO8601().withMessage('Fecha hasta inválida').toDate(),
  query('pendientes_facturar').optional().isBoolean().withMessage('Pendientes de facturar debe ser booleano').toBoolean(),
  query('orden').optional().isAlpha('es-ES', {ignore: '._'}).escape().withMessage('Orden inválido'),
  query('direccion').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).toUpperCase().withMessage('Dirección inválida')
], listarSalidas);

// GET /api/salidas/reporte - Generar reporte
router.get('/reporte', esAdminOFacturador, [
  query('fecha_desde').optional().isISO8601().withMessage('Fecha desde inválida').toDate(),
  query('fecha_hasta').optional().isISO8601().withMessage('Fecha hasta inválida').toDate(),
  query('cliente_id').optional().isInt({ min: 1 }).withMessage('ID de cliente inválido').toInt(),
  query('usuario_id').optional().isInt({ min: 1 }).withMessage('ID de usuario inválido').toInt(),
  query('tipo_salida').optional().isString().isIn(['venta', 'consignacion', 'maleta', 'donacion', 'ajuste', 'muestra']).withMessage('Tipo de salida inválido'),
  query('estado_salida').optional().isString().isIn(['pendiente', 'procesada', 'completada', 'anulada', 'facturada']).withMessage('Estado de salida inválido'),
  query('formato').optional().isIn(['json', 'pdf', 'excel']).withMessage('Formato inválido (json, pdf, excel)')
], generarReporte);

// GET /api/salidas/estadisticas - Obtener estadísticas
router.get('/estadisticas', esAdminOFacturador, [
  query('fecha_desde').optional().isISO8601().withMessage('Fecha desde inválida').toDate(),
  query('fecha_hasta').optional().isISO8601().withMessage('Fecha hasta inválida').toDate(),
  query('tipo_salida').optional().isString().isIn(['venta', 'consignacion', 'maleta', 'donacion', 'ajuste', 'muestra']).withMessage('Tipo de salida inválido')
  // Adicionar otros filtros que puedan ser relevantes para estadísticas
], obtenerEstadisticas);

// GET /api/salidas/:id - Obtener salida por ID
router.get('/:id', esAdminOFacturador, validarId, obtenerSalida); // validarId already checks param('id').isInt()

// POST /api/salidas - Crear nueva salida
router.post('/', esAdminOBodeguero, validarCreacion, crearSalida);

// POST /api/salidas/:id/duplicar - Duplicar salida
router.post('/:id/duplicar', esAdminOBodeguero, validarId, duplicarSalida);

// PUT /api/salidas/:id - Actualizar salida
router.put('/:id', esAdminOBodeguero, validarActualizacion, actualizarSalida);

// PATCH /api/salidas/:id/completar - Completar salida
router.patch('/:id/completar', esAdminOBodeguero, validarId, completarSalida);

// PATCH /api/salidas/:id/cancelar - Cancelar salida
router.patch('/:id/cancelar', esAdminOBodeguero, [
  ...validarId,
  body('motivo_cancelacion').notEmpty().withMessage('Motivo de cancelación es requerido')
], cancelarSalida);

// DELETE /api/salidas/:id - Eliminar salida
router.delete('/:id', esAdmin, validarId, eliminarSalida); // Eliminar podría ser solo Admin

module.exports = router;