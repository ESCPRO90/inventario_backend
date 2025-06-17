const { query } = require('../config/database');

class Proveedor {
  // Crear nuevo proveedor
  static async crear(datos) {
    const {
      codigo,
      nombre,
      nit = null,
      direccion = null,
      telefono = null,
      email = null,
      contacto = null
    } = datos;

    const sql = `
      INSERT INTO proveedores (codigo, nombre, nit, direccion, telefono, email, contacto)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const result = await query(sql, [codigo, nombre, nit, direccion, telefono, email, contacto]);
      return {
        id: result.insertId,
        ...datos
      };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.message.includes('codigo')) {
          throw new Error('El código de proveedor ya existe');
        }
      }
      throw error;
    }
  }

  // Buscar proveedor por ID
  static async buscarPorId(id) {
    const sql = `
      SELECT p.*,
        COUNT(DISTINCT i.producto_id) as productos_suministrados,
        COUNT(DISTINCT e.id) as total_entradas
      FROM proveedores p
      LEFT JOIN inventario i ON p.id = i.proveedor_id
      LEFT JOIN entradas e ON p.id = e.proveedor_id
      WHERE p.id = ? AND p.activo = true
      GROUP BY p.id
    `;
    
    const proveedores = await query(sql, [id]);
    return proveedores[0];
  }

  // Buscar proveedor por código
  static async buscarPorCodigo(codigo) {
    const sql = 'SELECT * FROM proveedores WHERE codigo = ? AND activo = true';
    const proveedores = await query(sql, [codigo]);
    return proveedores[0];
  }

  // Listar todos los proveedores con paginación
  static async listar(opciones = {}) {
    const {
      pagina = 1,
      limite = 20,
      buscar = '',
      orden = 'nombre',
      direccion = 'ASC'
    } = opciones;

    const offset = (pagina - 1) * limite;
    const parametros = [];
    let whereClause = 'WHERE p.activo = true';

    // Búsqueda
    if (buscar) {
      whereClause += ' AND (p.codigo LIKE ? OR p.nombre LIKE ? OR p.nit LIKE ? OR p.contacto LIKE ?)';
      const buscarPattern = `%${buscar}%`;
      parametros.push(buscarPattern, buscarPattern, buscarPattern, buscarPattern);
    }

    // Query para contar total
    const sqlCount = `
      SELECT COUNT(*) as total
      FROM proveedores p
      ${whereClause}
    `;
    
    const [{ total }] = await query(sqlCount, parametros);

    // Query principal
    parametros.push(limite, offset);
    const sql = `
      SELECT p.*,
        COUNT(DISTINCT i.producto_id) as productos_suministrados,
        COUNT(DISTINCT e.id) as total_entradas,
        MAX(e.fecha) as ultima_entrada
      FROM proveedores p
      LEFT JOIN inventario i ON p.id = i.proveedor_id
      LEFT JOIN entradas e ON p.id = e.proveedor_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.${orden} ${direccion}
      LIMIT ? OFFSET ?
    `;

    const proveedores = await query(sql, parametros);

    return {
      proveedores,
      paginacion: {
        total,
        pagina_actual: pagina,
        total_paginas: Math.ceil(total / limite),
        limite
      }
    };
  }

  // Actualizar proveedor
  static async actualizar(id, datos) {
    const camposPermitidos = ['nombre', 'nit', 'direccion', 'telefono', 'email', 'contacto'];
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
    const sql = `UPDATE proveedores SET ${campos.join(', ')} WHERE id = ? AND activo = true`;
    
    const result = await query(sql, valores);
    return result.affectedRows > 0;
  }

  // Desactivar proveedor
  static async desactivar(id) {
    // Verificar si tiene productos en inventario
    const sqlCheck = `
      SELECT COUNT(*) as total 
      FROM inventario 
      WHERE proveedor_id = ? AND cantidad_actual > 0
    `;
    
    const [{ total }] = await query(sqlCheck, [id]);
    
    if (total > 0) {
      throw new Error(`No se puede desactivar el proveedor porque tiene ${total} productos en inventario`);
    }

    const sql = 'UPDATE proveedores SET activo = false WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // Obtener productos suministrados por el proveedor
  static async obtenerProductosSuministrados(proveedorId) {
    const sql = `
      SELECT DISTINCT
        p.id,
        p.codigo,
        p.referencia,
        p.descripcion,
        COUNT(DISTINCT i.lote) as total_lotes,
        SUM(i.cantidad_actual) as stock_actual,
        MAX(e.fecha) as ultima_entrada
      FROM productos p
      JOIN inventario i ON p.id = i.producto_id
      LEFT JOIN entradas_detalle ed ON i.id = ed.inventario_id
      LEFT JOIN entradas e ON ed.entrada_id = e.id
      WHERE i.proveedor_id = ? AND p.activo = true
      GROUP BY p.id
      ORDER BY p.codigo
    `;

    return await query(sql, [proveedorId]);
  }

  // Buscar proveedores para autocomplete
  static async buscarAutocomplete(termino, limite = 10) {
    const sql = `
      SELECT id, codigo, nombre, nit
      FROM proveedores
      WHERE activo = true 
        AND (codigo LIKE ? OR nombre LIKE ? OR nit LIKE ?)
      ORDER BY nombre
      LIMIT ?
    `;

    const buscarPattern = `%${termino}%`;
    return await query(sql, [buscarPattern, buscarPattern, buscarPattern, limite]);
  }

  // Obtener estadísticas del proveedor
  static async obtenerEstadisticas(proveedorId) {
    // Total de productos
    const sqlProductos = `
      SELECT COUNT(DISTINCT producto_id) as total_productos
      FROM inventario
      WHERE proveedor_id = ?
    `;
    
    // Total de entradas
    const sqlEntradas = `
      SELECT 
        COUNT(*) as total_entradas,
        SUM(total) as monto_total,
        MAX(fecha) as ultima_entrada
      FROM entradas
      WHERE proveedor_id = ? AND estado = 'procesada'
    `;
    
    // Productos más suministrados
    const sqlTopProductos = `
      SELECT 
        p.codigo,
        p.descripcion,
        COUNT(DISTINCT e.id) as veces_suministrado,
        SUM(ed.cantidad) as cantidad_total
      FROM productos p
      JOIN entradas_detalle ed ON p.id = ed.producto_id
      JOIN entradas e ON ed.entrada_id = e.id
      WHERE e.proveedor_id = ? AND e.estado = 'procesada'
      GROUP BY p.id
      ORDER BY veces_suministrado DESC
      LIMIT 5
    `;
    
    const [{ total_productos }] = await query(sqlProductos, [proveedorId]);
    const [entradas] = await query(sqlEntradas, [proveedorId]);
    const topProductos = await query(sqlTopProductos, [proveedorId]);
    
    return {
      total_productos,
      total_entradas: entradas.total_entradas || 0,
      monto_total: entradas.monto_total || 0,
      ultima_entrada: entradas.ultima_entrada,
      top_productos: topProductos
    };
  }
}

module.exports = Proveedor;