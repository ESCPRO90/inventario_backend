const { query, transaction } = require('../config/database');

class Producto {
  // Crear nuevo producto
  static async crear(datos) {
    const {
      codigo,
      referencia,
      descripcion,
      categoria_id,
      unidad_medida = 'UNIDAD',
      precio_compra = 0,
      precio_venta = 0,
      requiere_lote = true,
      requiere_vencimiento = true,
      stock_minimo = 0,
      stock_maximo = 0
    } = datos;

    const sql = `
      INSERT INTO productos (
        codigo, referencia, descripcion, categoria_id, unidad_medida,
        precio_compra, precio_venta, requiere_lote, requiere_vencimiento,
        stock_minimo, stock_maximo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const result = await query(sql, [
        codigo, referencia, descripcion, categoria_id, unidad_medida,
        precio_compra, precio_venta, requiere_lote, requiere_vencimiento,
        stock_minimo, stock_maximo
      ]);

      return {
        id: result.insertId,
        ...datos
      };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('El código de producto ya existe');
      }
      throw error;
    }
  }

  // Buscar producto por ID
  static async buscarPorId(id) {
    const sql = `
      SELECT p.*, c.nombre as categoria_nombre,
        COALESCE(SUM(i.cantidad_actual), 0) as stock_actual
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN inventario i ON p.id = i.producto_id AND i.estado = 'disponible'
      WHERE p.id = ? AND p.activo = true
      GROUP BY p.id
    `;
    
    const productos = await query(sql, [id]);
    return productos[0];
  }

  // Buscar producto por código
  static async buscarPorCodigo(codigo) {
    const sql = `
      SELECT p.*, c.nombre as categoria_nombre,
        COALESCE(SUM(i.cantidad_actual), 0) as stock_actual
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN inventario i ON p.id = i.producto_id AND i.estado = 'disponible'
      WHERE p.codigo = ? AND p.activo = true
      GROUP BY p.id
    `;
    
    const productos = await query(sql, [codigo]);
    return productos[0];
  }

  // Listar todos los productos con paginación
  static async listar(opciones = {}) {
    const {
      pagina = 1,
      limite = 20,
      buscar = '',
      categoria_id = null,
      orden = 'codigo',
      direccion = 'ASC'
    } = opciones;

    const offset = (pagina - 1) * limite;
    const parametros = [];
    let whereClause = 'WHERE p.activo = true';

    // Búsqueda
    if (buscar) {
      whereClause += ' AND (p.codigo LIKE ? OR p.referencia LIKE ? OR p.descripcion LIKE ?)';
      const buscarPattern = `%${buscar}%`;
      parametros.push(buscarPattern, buscarPattern, buscarPattern);
    }

    // Filtro por categoría
    if (categoria_id) {
      whereClause += ' AND p.categoria_id = ?';
      parametros.push(categoria_id);
    }

    // Query para contar total
    const sqlCount = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM productos p
      ${whereClause}
    `;
    
    const [{ total }] = await query(sqlCount, parametros);

    // Query principal
    parametros.push(limite, offset);
    const sql = `
      SELECT p.*, c.nombre as categoria_nombre,
        COALESCE(SUM(i.cantidad_actual), 0) as stock_actual,
        COUNT(DISTINCT i.id) as lotes_disponibles
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN inventario i ON p.id = i.producto_id AND i.estado = 'disponible'
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.${orden} ${direccion}
      LIMIT ? OFFSET ?
    `;

    const productos = await query(sql, parametros);

    return {
      productos,
      paginacion: {
        total,
        pagina_actual: pagina,
        total_paginas: Math.ceil(total / limite),
        limite
      }
    };
  }

  // Actualizar producto
  static async actualizar(id, datos) {
    const camposPermitidos = [
      'referencia', 'descripcion', 'categoria_id', 'unidad_medida',
      'precio_compra', 'precio_venta', 'requiere_lote', 'requiere_vencimiento',
      'stock_minimo', 'stock_maximo'
    ];

    const campos = [];
    const valores = [];

    Object.keys(datos).forEach(campo => {
      if (camposPermitidos.includes(campo) && datos[campo] !== undefined) {
        campos.push(`${campo} = ?`);
        valores.push(datos[campo]);
      }
    });

    if (campos.length === 0) {
      throw new Error('No hay campos válidos para actualizar');
    }

    valores.push(id);
    const sql = `UPDATE productos SET ${campos.join(', ')} WHERE id = ? AND activo = true`;
    
    const result = await query(sql, valores);
    return result.affectedRows > 0;
  }

  // Desactivar producto (soft delete)
  static async desactivar(id) {
    // Verificar si tiene stock
    const producto = await this.buscarPorId(id);
    if (!producto) {
      throw new Error('Producto no encontrado');
    }

    if (producto.stock_actual > 0) {
      throw new Error('No se puede desactivar un producto con stock disponible');
    }

    const sql = 'UPDATE productos SET activo = false WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // Obtener stock detallado por lotes
  static async obtenerStockDetallado(productoId) {
    const sql = `
      SELECT 
        i.id,
        i.lote,
        i.fecha_vencimiento,
        i.cantidad_actual,
        i.ubicacion,
        pr.nombre as proveedor,
        DATEDIFF(i.fecha_vencimiento, CURDATE()) as dias_para_vencer
      FROM inventario i
      JOIN proveedores pr ON i.proveedor_id = pr.id
      WHERE i.producto_id = ? 
        AND i.estado = 'disponible' 
        AND i.cantidad_actual > 0
      ORDER BY i.fecha_vencimiento, i.created_at
    `;

    return await query(sql, [productoId]);
  }

  // Verificar stock disponible
  static async verificarStock(productoId, cantidad) {
    const sql = `
      SELECT COALESCE(SUM(cantidad_actual), 0) as stock_disponible
      FROM inventario
      WHERE producto_id = ? AND estado = 'disponible'
    `;

    const [{ stock_disponible }] = await query(sql, [productoId]);
    return stock_disponible >= cantidad;
  }

  // Productos con stock bajo
  static async productosStockBajo() {
    const sql = `
      SELECT 
        p.id,
        p.codigo,
        p.referencia,
        p.descripcion,
        p.stock_minimo,
        COALESCE(SUM(i.cantidad_actual), 0) as stock_actual,
        c.nombre as categoria
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN inventario i ON p.id = i.producto_id AND i.estado = 'disponible'
      WHERE p.activo = true AND p.stock_minimo > 0
      GROUP BY p.id
      HAVING stock_actual <= p.stock_minimo
      ORDER BY (stock_actual / p.stock_minimo), p.codigo
    `;

    return await query(sql);
  }

  // Productos próximos a vencer
  static async productosProximosVencer(dias = 30) {
    const sql = `
      SELECT 
        p.codigo,
        p.descripcion,
        i.lote,
        i.fecha_vencimiento,
        i.cantidad_actual,
        pr.nombre as proveedor,
        DATEDIFF(i.fecha_vencimiento, CURDATE()) as dias_para_vencer
      FROM inventario i
      JOIN productos p ON i.producto_id = p.id
      JOIN proveedores pr ON i.proveedor_id = pr.id
      WHERE i.estado = 'disponible' 
        AND i.cantidad_actual > 0
        AND i.fecha_vencimiento IS NOT NULL
        AND DATEDIFF(i.fecha_vencimiento, CURDATE()) <= ?
        AND DATEDIFF(i.fecha_vencimiento, CURDATE()) > 0
      ORDER BY i.fecha_vencimiento, p.codigo
    `;

    return await query(sql, [dias]);
  }

  // Buscar productos para autocomplete
  static async buscarAutocomplete(termino, limite = 10) {
    const sql = `
      SELECT 
        p.id,
        p.codigo,
        p.referencia,
        p.descripcion,
        COALESCE(SUM(i.cantidad_actual), 0) as stock_actual
      FROM productos p
      LEFT JOIN inventario i ON p.id = i.producto_id AND i.estado = 'disponible'
      WHERE p.activo = true 
        AND (p.codigo LIKE ? OR p.referencia LIKE ? OR p.descripcion LIKE ?)
      GROUP BY p.id
      LIMIT ?
    `;

    const buscarPattern = `%${termino}%`;
    return await query(sql, [buscarPattern, buscarPattern, buscarPattern, limite]);
  }

  /**
   * Busca múltiples productos por sus IDs.
   * Incluye información de stock actual.
   * @param {number[]} ids - Array de IDs de productos.
   * @returns {Promise<object[]>} - Array de objetos de producto.
   */
  static async buscarMuchosPorIds(ids) {
    if (!ids || ids.length === 0) {
      return [];
    }
    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      SELECT p.*, c.nombre as categoria_nombre,
        COALESCE(SUM(i.cantidad_actual), 0) as stock_actual
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN inventario i ON p.id = i.producto_id AND i.estado = 'disponible'
      WHERE p.id IN (${placeholders}) AND p.activo = true
      GROUP BY p.id
    `;
    return await query(sql, ids);
  }

  /**
   * Obtiene el stock actual para múltiples productos.
   * @param {number[]} ids - Array de IDs de productos.
   * @returns {Promise<object[]>} - Array de objetos { producto_id, stock_total }
   */
  static async obtenerStockActualPorIds(ids) {
    if (!ids || ids.length === 0) {
      return [];
    }
    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      SELECT p.id as producto_id, COALESCE(SUM(i.cantidad_actual), 0) as stock_total
      FROM productos p
      LEFT JOIN inventario i ON p.id = i.producto_id AND i.estado = 'disponible'
      WHERE p.id IN (${placeholders}) AND p.activo = true
      GROUP BY p.id
    `;
    return await query(sql, ids);
  }
}

module.exports = Producto;