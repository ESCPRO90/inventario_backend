const { validationResult } = require('express-validator');
const Producto = require('../models/Producto');
const Categoria = require('../models/Categoria');

// Listar productos con paginación y filtros
const listarProductos = async (req, res, next) => {
  try {
    const {
      pagina = 1,
      limite = 20,
      buscar = '',
      categoria_id = null,
      orden = 'codigo',
      direccion = 'ASC'
    } = req.query;

    const opciones = {
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      buscar,
      categoria_id: categoria_id ? parseInt(categoria_id) : null,
      orden,
      direccion: direccion.toUpperCase()
    };

    const resultado = await Producto.listar(opciones);

    res.json({
      success: true,
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

// Obtener producto por ID
const obtenerProducto = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const producto = await Producto.buscarPorId(id);
    
    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Obtener stock detallado si se solicita
    if (req.query.incluir_stock === 'true') {
      producto.stock_detalle = await Producto.obtenerStockDetallado(id);
    }

    res.json({
      success: true,
      data: { producto }
    });
  } catch (error) {
    next(error);
  }
};

// Crear nuevo producto
const crearProducto = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const nuevoProducto = await Producto.crear(req.body);

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: { producto: nuevoProducto }
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar producto
const actualizarProducto = async (req, res, next) => {
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
    
    const actualizado = await Producto.actualizar(id, req.body);
    
    if (!actualizado) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    const productoActualizado = await Producto.buscarPorId(id);

    res.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      data: { producto: productoActualizado }
    });
  } catch (error) {
    next(error);
  }
};

// Desactivar producto
const desactivarProducto = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await Producto.desactivar(id);

    res.json({
      success: true,
      message: 'Producto desactivado exitosamente'
    });
  } catch (error) {
    if (error.message.includes('stock disponible')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

// Buscar productos (autocomplete)
const buscarProductos = async (req, res, next) => {
  try {
    const { q, limite = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: { productos: [] }
      });
    }

    const productos = await Producto.buscarAutocomplete(q, parseInt(limite));

    res.json({
      success: true,
      data: { productos }
    });
  } catch (error) {
    next(error);
  }
};

// Productos con stock bajo
const productosStockBajo = async (req, res, next) => {
  try {
    const productos = await Producto.productosStockBajo();

    res.json({
      success: true,
      data: { 
        productos,
        total: productos.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Productos próximos a vencer
const productosProximosVencer = async (req, res, next) => {
  try {
    const { dias = 30 } = req.query;
    
    const productos = await Producto.productosProximosVencer(parseInt(dias));

    res.json({
      success: true,
      data: { 
        productos,
        total: productos.length,
        dias_anticipacion: parseInt(dias)
      }
    });
  } catch (error) {
    next(error);
  }
};

// CONTROLADORES DE CATEGORÍAS

// Listar categorías
const listarCategorias = async (req, res, next) => {
  try {
    const categorias = await Categoria.listar();

    res.json({
      success: true,
      data: { 
        categorias,
        total: categorias.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Crear categoría
const crearCategoria = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const nuevaCategoria = await Categoria.crear(req.body);

    res.status(201).json({
      success: true,
      message: 'Categoría creada exitosamente',
      data: { categoria: nuevaCategoria }
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar categoría
const actualizarCategoria = async (req, res, next) => {
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
    
    const actualizado = await Categoria.actualizar(id, req.body);
    
    if (!actualizado) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Categoría actualizada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Desactivar categoría
const desactivarCategoria = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await Categoria.desactivar(id);

    res.json({
      success: true,
      message: 'Categoría desactivada exitosamente'
    });
  } catch (error) {
    if (error.message.includes('productos asociados')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

module.exports = {
  // Productos
  listarProductos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  desactivarProducto,
  buscarProductos,
  productosStockBajo,
  productosProximosVencer,
  // Categorías
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  desactivarCategoria
};