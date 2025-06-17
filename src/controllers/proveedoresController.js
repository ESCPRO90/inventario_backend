const { validationResult } = require('express-validator');
const Proveedor = require('../models/Proveedor');

// Listar proveedores
const listarProveedores = async (req, res, next) => {
  try {
    const {
      pagina = 1,
      limite = 20,
      buscar = '',
      orden = 'nombre',
      direccion = 'ASC'
    } = req.query;

    const opciones = {
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      buscar,
      orden,
      direccion: direccion.toUpperCase()
    };

    const resultado = await Proveedor.listar(opciones);

    res.json({
      success: true,
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

// Obtener proveedor por ID
const obtenerProveedor = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const proveedor = await Proveedor.buscarPorId(id);
    
    if (!proveedor) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    // Obtener productos si se solicita
    if (req.query.incluir_productos === 'true') {
      proveedor.productos = await Proveedor.obtenerProductosSuministrados(id);
    }

    // Obtener estadísticas si se solicita
    if (req.query.incluir_estadisticas === 'true') {
      proveedor.estadisticas = await Proveedor.obtenerEstadisticas(id);
    }

    res.json({
      success: true,
      data: { proveedor }
    });
  } catch (error) {
    next(error);
  }
};

// Crear nuevo proveedor
const crearProveedor = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const nuevoProveedor = await Proveedor.crear(req.body);

    res.status(201).json({
      success: true,
      message: 'Proveedor creado exitosamente',
      data: { proveedor: nuevoProveedor }
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar proveedor
const actualizarProveedor = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    
    const actualizado = await Proveedor.actualizar(id, req.body);
    
    if (!actualizado) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    const proveedorActualizado = await Proveedor.buscarPorId(id);

    res.json({
      success: true,
      message: 'Proveedor actualizado exitosamente',
      data: { proveedor: proveedorActualizado }
    });
  } catch (error) {
    next(error);
  }
};

// Desactivar proveedor
const desactivarProveedor = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await Proveedor.desactivar(id);

    res.json({
      success: true,
      message: 'Proveedor desactivado exitosamente'
    });
  } catch (error) {
    if (error.message.includes('productos en inventario')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

// Buscar proveedores (autocomplete)
const buscarProveedores = async (req, res, next) => {
  try {
    const { q, limite = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: { proveedores: [] }
      });
    }

    const proveedores = await Proveedor.buscarAutocomplete(q, parseInt(limite));

    res.json({
      success: true,
      data: { proveedores }
    });
  } catch (error) {
    next(error);
  }
};

// Obtener productos suministrados por el proveedor
const productosDelProveedor = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el proveedor existe
    const proveedor = await Proveedor.buscarPorId(id);
    if (!proveedor) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    const productos = await Proveedor.obtenerProductosSuministrados(id);

    res.json({
      success: true,
      data: { 
        proveedor: {
          id: proveedor.id,
          codigo: proveedor.codigo,
          nombre: proveedor.nombre
        },
        productos,
        total: productos.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Obtener estadísticas del proveedor
const estadisticasProveedor = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el proveedor existe
    const proveedor = await Proveedor.buscarPorId(id);
    if (!proveedor) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    const estadisticas = await Proveedor.obtenerEstadisticas(id);

    res.json({
      success: true,
      data: {
        proveedor: {
          id: proveedor.id,
          codigo: proveedor.codigo,
          nombre: proveedor.nombre
        },
        estadisticas
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarProveedores,
  obtenerProveedor,
  crearProveedor,
  actualizarProveedor,
  desactivarProveedor,
  buscarProveedores,
  productosDelProveedor,
  estadisticasProveedor
};