const { validationResult } = require('express-validator');
const Entrada = require('../models/Entrada');
const Producto = require('../models/Producto');
const Proveedor = require('../models/Proveedor');

// Listar entradas
const listarEntradas = async (req, res, next) => {
  try {
    const {
      pagina = 1,
      limite = 20,
      buscar = '',
      proveedor_id,
      fecha_inicio,
      fecha_fin,
      estado,
      orden = 'fecha',
      direccion = 'DESC'
    } = req.query;

    const opciones = {
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      buscar,
      proveedor_id: proveedor_id ? parseInt(proveedor_id) : null,
      fecha_inicio,
      fecha_fin,
      estado,
      orden,
      direccion: direccion.toUpperCase()
    };

    const resultado = await Entrada.listar(opciones);

    res.json({
      success: true,
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

// Obtener entrada por ID
const obtenerEntrada = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const entrada = await Entrada.buscarPorId(id);
    
    if (!entrada) {
      return res.status(404).json({
        success: false,
        message: 'Entrada no encontrada'
      });
    }

    // Obtener detalles
    entrada.detalles = await Entrada.obtenerDetalles(id);

    res.json({
      success: true,
      data: { entrada }
    });
  } catch (error) {
    next(error);
  }
};

// Crear nueva entrada
const crearEntrada = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const { proveedor_id, tipo_documento, numero_documento, fecha, observaciones, detalles } = req.body;

    // Validaciones adicionales
    if (!detalles || detalles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'La entrada debe tener al menos un producto'
      });
    }

    // Verificar que el proveedor existe
    const proveedor = await Proveedor.buscarPorId(proveedor_id);
    if (!proveedor) {
      return res.status(400).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    // Verificar que todos los productos existen
    for (const detalle of detalles) {
      const producto = await Producto.buscarPorId(detalle.producto_id);
      if (!producto) {
        return res.status(400).json({
          success: false,
          message: `Producto con ID ${detalle.producto_id} no encontrado`
        });
      }

      // Verificar lote si el producto lo requiere
      if (producto.requiere_lote && !detalle.lote) {
        return res.status(400).json({
          success: false,
          message: `El producto ${producto.codigo} requiere número de lote`
        });
      }

      // Verificar vencimiento si el producto lo requiere
      if (producto.requiere_vencimiento && !detalle.fecha_vencimiento) {
        return res.status(400).json({
          success: false,
          message: `El producto ${producto.codigo} requiere fecha de vencimiento`
        });
      }
    }

    // Crear entrada
    const datosEntrada = {
      proveedor_id,
      tipo_documento,
      numero_documento,
      fecha,
      usuario_id: req.usuario.id,
      observaciones
    };

    const nuevaEntrada = await Entrada.crear(datosEntrada, detalles);

    // Obtener entrada completa
    const entradaCompleta = await Entrada.buscarPorId(nuevaEntrada.id);
    entradaCompleta.detalles = await Entrada.obtenerDetalles(nuevaEntrada.id);

    res.status(201).json({
      success: true,
      message: 'Entrada creada exitosamente',
      data: { entrada: entradaCompleta }
    });
  } catch (error) {
    next(error);
  }
};

// Anular entrada
const anularEntrada = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await Entrada.anular(id, req.usuario.id);

    res.json({
      success: true,
      message: 'Entrada anulada exitosamente'
    });
  } catch (error) {
    if (error.message.includes('No se puede anular')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

// Obtener estadísticas
const obtenerEstadisticas = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin, proveedor_id } = req.query;

    const filtros = {
      fecha_inicio,
      fecha_fin,
      proveedor_id: proveedor_id ? parseInt(proveedor_id) : null
    };

    const estadisticas = await Entrada.obtenerEstadisticas(filtros);

    res.json({
      success: true,
      data: { estadisticas }
    });
  } catch (error) {
    next(error);
  }
};

// Entradas recientes
const entradasRecientes = async (req, res, next) => {
  try {
    const { limite = 10 } = req.query;
    
    const entradas = await Entrada.entradasRecientes(parseInt(limite));

    res.json({
      success: true,
      data: { 
        entradas,
        total: entradas.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Generar número de entrada (helper)
const generarNumeroEntrada = async (req, res, next) => {
  try {
    const numero = await Entrada.generarNumeroEntrada();

    res.json({
      success: true,
      data: { numero_entrada: numero }
    });
  } catch (error) {
    next(error);
  }
};

// Validar entrada antes de crear
const validarEntrada = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const { proveedor_id, detalles } = req.body;
    const validaciones = {
      proveedor_valido: false,
      productos_validos: true,
      detalles_validados: []
    };

    // Validar proveedor
    const proveedor = await Proveedor.buscarPorId(proveedor_id);
    if (proveedor) {
      validaciones.proveedor_valido = true;
      validaciones.proveedor = {
        id: proveedor.id,
        codigo: proveedor.codigo,
        nombre: proveedor.nombre
      };
    }

    // Validar productos
    for (const detalle of detalles) {
      const producto = await Producto.buscarPorId(detalle.producto_id);
      const detalleValidado = {
        producto_id: detalle.producto_id,
        valido: false,
        errores: []
      };

      if (producto) {
        detalleValidado.valido = true;
        detalleValidado.producto = {
          codigo: producto.codigo,
          descripcion: producto.descripcion,
          requiere_lote: producto.requiere_lote,
          requiere_vencimiento: producto.requiere_vencimiento
        };

        // Validar requerimientos
        if (producto.requiere_lote && !detalle.lote) {
          detalleValidado.valido = false;
          detalleValidado.errores.push('Lote requerido');
        }

        if (producto.requiere_vencimiento && !detalle.fecha_vencimiento) {
          detalleValidado.valido = false;
          detalleValidado.errores.push('Fecha de vencimiento requerida');
        }

        if (detalle.cantidad <= 0) {
          detalleValidado.valido = false;
          detalleValidado.errores.push('Cantidad debe ser mayor a 0');
        }

        if (detalle.precio_unitario < 0) {
          detalleValidado.valido = false;
          detalleValidado.errores.push('Precio no puede ser negativo');
        }
      } else {
        detalleValidado.errores.push('Producto no encontrado');
        validaciones.productos_validos = false;
      }

      validaciones.detalles_validados.push(detalleValidado);
    }

    res.json({
      success: true,
      data: { validaciones }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarEntradas,
  obtenerEntrada,
  crearEntrada,
  anularEntrada,
  obtenerEstadisticas,
  entradasRecientes,
  generarNumeroEntrada,
  validarEntrada
};