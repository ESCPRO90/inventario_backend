const { validationResult } = require('express-validator');
const Salida = require('../models/Salida');
const Maleta = require('../models/Maleta');
const Cliente = require('../models/Cliente');
const Producto = require('../models/Producto');
const { BusinessLogicError, NotFoundError, ValidationError } = require('../utils/customErrors');

// Listar salidas
const listarSalidas = async (req, res, next) => {
  try {
    const {
      pagina = 1,
      limite = 20,
      buscar = '',
      tipo_salida,
      cliente_id,
      maleta_id,
      estado,
      fecha_inicio,
      fecha_fin,
      pendientes_facturar,
      orden = 'fecha',
      direccion = 'DESC'
    } = req.query;

    const opciones = {
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      buscar,
      tipo_salida,
      cliente_id: cliente_id ? parseInt(cliente_id) : null,
      maleta_id: maleta_id ? parseInt(maleta_id) : null,
      estado,
      fecha_inicio,
      fecha_fin,
      pendientes_facturar: pendientes_facturar === 'true',
      orden,
      direccion: direccion.toUpperCase()
    };

    const resultado = await Salida.listar(opciones);

    res.json({
      success: true,
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

// Obtener salida por ID
const obtenerSalida = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const salida = await Salida.buscarPorId(id);
    
    if (!salida) {
      return res.status(404).json({
        success: false,
        message: 'Salida no encontrada'
      });
    }

    // Obtener detalles
    salida.detalles = await Salida.obtenerDetalles(id);

    res.json({
      success: true,
      data: salida
    });
  } catch (error) {
    next(error);
  }
};

// Crear nueva salida
const crearSalida = async (req, res, next) => {
  try {
    // Validar errores de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(errors); // Pass to errorHandler
    }

    const {
      tipo_salida,
      cliente_id,
      maleta_id,
      observaciones,
      detalles = []
    } = req.body;

    // Validar que el cliente existe (si se proporciona)
    if (cliente_id) {
      const cliente = await Cliente.buscarPorId(cliente_id); // Assumes buscarPorId throws NotFoundError
      if (!cliente) { // Defensive check, though model should throw
        throw new NotFoundError(`Cliente con ID ${cliente_id} no encontrado.`);
      }
    }

    // Validar que la maleta existe (si se proporciona)
    if (maleta_id) {
      const maleta = await Maleta.buscarPorId(maleta_id); // Assumes buscarPorId throws NotFoundError
      if (!maleta) { // Defensive check
        throw new NotFoundError(`Maleta con ID ${maleta_id} no encontrada.`);
      }
    }

    if (!detalles || detalles.length === 0) {
        throw new BusinessLogicError('La salida debe tener al menos un producto en los detalles.');
    }

    // Batch fetch product details (including stock)
    const productoIds = [...new Set(detalles.map(d => d.producto_id))];
    if (productoIds.length === 0 && tipo_salida !== 'donacion') { // Donacion might not need products initially
        throw new BusinessLogicError('No se especificaron productos en los detalles.');
    }

    const productosData = await Producto.buscarMuchosPorIds(productoIds); // Includes stock_actual
    const productosMap = new Map(productosData.map(p => [p.id, p]));

    const validationErrors = [];
    for (const detalle of detalles) {
      const producto = productosMap.get(detalle.producto_id);
      if (!producto) {
        validationErrors.push({
          producto_id: detalle.producto_id,
          message: `Producto con ID ${detalle.producto_id} no encontrado.`
        });
        continue;
      }

      // Validar stock disponible (stock_actual comes from buscarMuchosPorIds)
      if (producto.stock_actual < detalle.cantidad) {
        validationErrors.push({
          producto_id: detalle.producto_id,
          codigo_producto: producto.codigo,
          message: `Stock insuficiente para el producto ${producto.codigo}. Stock disponible: ${producto.stock_actual}, Solicitado: ${detalle.cantidad}.`
        });
      }
    }

    if (validationErrors.length > 0) {
      throw new ValidationError('Errores de validación en los detalles de la salida.', validationErrors);
    }

    const datosSalida = {
      tipo_salida,
      cliente_id,
      maleta_id,
      observaciones,
      estado: 'procesada', // Typically, a salida is 'procesada' upon creation if stock is confirmed
      fecha: new Date(),
      usuario_id: req.usuario ? req.usuario.id : null // Ensure req.usuario exists
    };

    if (!datosSalida.usuario_id) {
      throw new AuthenticationError('No se pudo determinar el usuario para registrar la salida.');
    }

    const nuevaSalida = await Salida.crear(datosSalida, detalles);

    res.status(201).json({
      success: true,
      message: 'Salida creada exitosamente',
      data: nuevaSalida
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar salida
const actualizarSalida = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validar errores de entrada
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errores: errores.array()
      });
    }

    // Verificar que la salida existe
    const salidaExistente = await Salida.buscarPorId(id);
    if (!salidaExistente) {
      return res.status(404).json({
        success: false,
        message: 'Salida no encontrada'
      });
    }

    // No permitir actualizar salidas completadas o facturadas
    if (salidaExistente.estado === 'completada' || salidaExistente.facturada) {
      return res.status(400).json({
        success: false,
        message: 'No se puede modificar una salida completada o facturada'
      });
    }

    const {
      tipo_salida,
      cliente_id,
      maleta_id,
      observaciones,
      estado,
      detalles
    } = req.body;

    const datosActualizacion = {
      tipo_salida,
      cliente_id,
      maleta_id,
      observaciones,
      estado,
      fecha_actualizacion: new Date()
    };

    const salidaActualizada = await Salida.actualizar(id, datosActualizacion, detalles);

    res.json({
      success: true,
      message: 'Salida actualizada exitosamente',
      data: salidaActualizada
    });
  } catch (error) {
    next(error);
  }
};

// Completar salida
const completarSalida = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const salida = await Salida.buscarPorId(id);
    if (!salida) {
      return res.status(404).json({
        success: false,
        message: 'Salida no encontrada'
      });
    }

    if (salida.estado === 'completada') {
      return res.status(400).json({
        success: false,
        message: 'La salida ya está completada'
      });
    }

    const salidaCompletada = await Salida.completar(id);

    res.json({
      success: true,
      message: 'Salida completada exitosamente',
      data: salidaCompletada
    });
  } catch (error) {
    next(error);
  }
};

// Cancelar salida
const cancelarSalida = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { motivo_cancelacion } = req.body;
    
    const salida = await Salida.buscarPorId(id);
    if (!salida) {
      return res.status(404).json({
        success: false,
        message: 'Salida no encontrada'
      });
    }

    if (salida.estado === 'completada') {
      return res.status(400).json({
        success: false,
        message: 'No se puede cancelar una salida completada'
      });
    }

    if (salida.facturada) {
      return res.status(400).json({
        success: false,
        message: 'No se puede cancelar una salida facturada'
      });
    }

    const salidaCancelada = await Salida.cancelar(id, motivo_cancelacion);

    res.json({
      success: true,
      message: 'Salida cancelada exitosamente',
      data: salidaCancelada
    });
  } catch (error) {
    next(error);
  }
};

// Eliminar salida
const eliminarSalida = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const salida = await Salida.buscarPorId(id);
    if (!salida) {
      return res.status(404).json({
        success: false,
        message: 'Salida no encontrada'
      });
    }

    // Solo permitir eliminar salidas pendientes
    if (salida.estado !== 'pendiente') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden eliminar salidas en estado pendiente'
      });
    }

    await Salida.eliminar(id);

    res.json({
      success: true,
      message: 'Salida eliminada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Generar reporte de salidas
const generarReporte = async (req, res, next) => {
  try {
    const {
      fecha_inicio,
      fecha_fin,
      tipo_salida,
      cliente_id,
      estado,
      formato = 'json'
    } = req.query;

    const filtros = {
      fecha_inicio,
      fecha_fin,
      tipo_salida,
      cliente_id: cliente_id ? parseInt(cliente_id) : null,
      estado
    };

    const reporte = await Salida.generarReporte(filtros);

    if (formato === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_salidas.csv');
      return res.send(reporte.csv);
    }

    res.json({
      success: true,
      data: reporte
    });
  } catch (error) {
    next(error);
  }
};

// Obtener estadísticas de salidas
const obtenerEstadisticas = async (req, res, next) => {
  try {
    const {
      fecha_inicio,
      fecha_fin,
      agrupacion = 'mes'
    } = req.query;

    const estadisticas = await Salida.obtenerEstadisticas({
      fecha_inicio,
      fecha_fin,
      agrupacion
    });

    res.json({
      success: true,
      data: estadisticas
    });
  } catch (error) {
    next(error);
  }
};

// Duplicar salida
const duplicarSalida = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const salidaOriginal = await Salida.buscarPorId(id);
    if (!salidaOriginal) {
      return res.status(404).json({
        success: false,
        message: 'Salida no encontrada'
      });
    }

    const salidaDuplicada = await Salida.duplicar(id);

    res.status(201).json({
      success: true,
      message: 'Salida duplicada exitosamente',
      data: salidaDuplicada
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};