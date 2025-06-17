const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

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
router.get('/', listarSalidas);

// GET /api/salidas/reporte - Generar reporte
router.get('/reporte', generarReporte);

// GET /api/salidas/estadisticas - Obtener estadísticas
router.get('/estadisticas', obtenerEstadisticas);

// GET /api/salidas/:id - Obtener salida por ID
router.get('/:id', validarId, obtenerSalida);

// POST /api/salidas - Crear nueva salida
router.post('/', validarCreacion, crearSalida);

// POST /api/salidas/:id/duplicar - Duplicar salida
router.post('/:id/duplicar', validarId, duplicarSalida);

// PUT /api/salidas/:id - Actualizar salida
router.put('/:id', validarActualizacion, actualizarSalida);

// PATCH /api/salidas/:id/completar - Completar salida
router.patch('/:id/completar', validarId, completarSalida);

// PATCH /api/salidas/:id/cancelar - Cancelar salida
router.patch('/:id/cancelar', [
  ...validarId,
  body('motivo_cancelacion').notEmpty().withMessage('Motivo de cancelación es requerido')
], cancelarSalida);

// DELETE /api/salidas/:id - Eliminar salida
router.delete('/:id', validarId, eliminarSalida);

module.exports = router;