const { validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');

// Obtener inventario general
const obtenerInventario = async (req, res, next) => {
  try {
    const {
      pagina = 1,
      limite = 20,
      buscar = '',
      producto_id,
      proveedor_id,
      estado = 'disponible',
      proximos_vencer,
      orden = 'producto_codigo',
      direccion = 'ASC'
    } = req.query;

    const offset = (pagina - 1) * limite;
    const parametros = [];
    let whereClause = 'WHERE 1=1';

    // Filtros
    if (buscar) {
      whereClause += ' AND (p.codigo LIKE ? OR p.descripcion LIKE ? OR i.lote LIKE ?)';
      const buscarPattern = `%${buscar}%`;
      parametros.push(buscarPattern, buscarPattern, buscarPattern);
    }

    if (producto_id) {
      whereClause += ' AND i.producto_id = ?';
      parametros.push(producto_id);
    }

    if (proveedor_id) {
      whereClause += ' AND i.proveedor_id = ?';
      parametros.push(proveedor_id);
    }

    if (estado) {
      whereClause += ' AND i.estado = ?';
      parametros.push(estado);
    }

    if (proximos_vencer) {
      whereClause += ' AND i.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY)';
      parametros.push(proximos_vencer);
    }

    // Query para contar total
    const sqlCount = `
      SELECT COUNT(*) as total
      FROM inventario i
      JOIN productos p ON i.producto_id = p.id
      ${whereClause}
    `;
    
    const [{ total }] = await dbQuery(sqlCount, parametros);

    // Query principal
    parametros.push(limite, offset);
    const sql = `
      SELECT 
        i.*,
        p.codigo as producto_codigo,
        p.referencia as producto_referencia,
        p.descripcion as producto_descripcion,
        p.unidad_medida,
        pr.codigo as proveedor_codigo,
        pr.nombre as proveedor_nombre,
        DATEDIFF(i.fecha_vencimiento, CURDATE()) as dias_para_vencer,
        (i.cantidad_actual * p.precio_venta) as valor_inventario
      FROM inventario i
      JOIN productos p ON i.producto_id = p.id
      JOIN proveedores pr ON i.proveedor_id = pr.id
      ${whereClause}
      ORDER BY ${orden} ${direccion}
      LIMIT ? OFFSET ?
    `;

    const inventario = await dbQuery(sql, parametros);

    res.json({
      success: true,
      data: {
        inventario,
        paginacion: {
          total,
          pagina_actual: pagina,
          total_paginas: Math.ceil(total / limite),
          limite
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Obtener kardex de un producto
const obtenerKardex = async (req, res, next) => {
  try {
    const { producto_id } = req.params;
    const {
      fecha_inicio,
      fecha_fin,
      tipo_movimiento,
      limite = 50
    } = req.query;

    let whereClause = 'WHERE m.producto_id = ?';
    const parametros = [producto_id];

    if (fecha_inicio) {
      whereClause += ' AND DATE(m.fecha) >= ?';
      parametros.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereClause += ' AND DATE(m.fecha) <= ?';
      parametros.push(fecha_fin);
    }

    if (tipo_movimiento) {
      whereClause += ' AND m.tipo_movimiento = ?';
      parametros.push(tipo_movimiento);
    }

    parametros.push(parseInt(limite));

    const sql = `
      SELECT 
        m.*,
        p.codigo as producto_codigo,
        p.descripcion as producto_descripcion,
        u.nombre_completo as usuario_nombre,
        i.lote,
        CASE 
          WHEN m.tipo_movimiento = 'entrada' THEN 'Entrada'
          WHEN m.tipo_movimiento = 'salida' THEN 'Salida'
          WHEN m.tipo_movimiento = 'ajuste' THEN 'Ajuste'
          WHEN m.tipo_movimiento = 'devolucion' THEN 'Devolución'
        END as tipo_movimiento_display
      FROM movimientos_inventario m
      JOIN productos p ON m.producto_id = p.id
      JOIN usuarios u ON m.usuario_id = u.id
      LEFT JOIN inventario i ON m.inventario_id = i.id
      ${whereClause}
      ORDER BY m.fecha DESC, m.id DESC
      LIMIT ?
    `;

    const movimientos = await dbQuery(sql, parametros);

    res.json({
      success: true,
      data: {
        producto_id,
        movimientos,
        total: movimientos.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Obtener resumen de inventario
const obtenerResumen = async (req, res, next) => {
  try {
    // Total de productos
    const sqlTotalProductos = `
      SELECT 
        COUNT(DISTINCT producto_id) as total_productos,
        COUNT(*) as total_lotes,
        SUM(cantidad_actual) as total_unidades,
        SUM(cantidad_actual * p.precio_venta) as valor_total
      FROM inventario i
      JOIN productos p ON i.producto_id = p.id
      WHERE i.estado = 'disponible'
    `;

    // Productos por vencer
    const sqlPorVencer = `
      SELECT COUNT(*) as total
      FROM inventario
      WHERE estado = 'disponible'
        AND fecha_vencimiento IS NOT NULL
        AND fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        AND cantidad_actual > 0
    `;

    // Productos con stock bajo
    const sqlStockBajo = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM productos p
      WHERE p.activo = true 
        AND p.stock_minimo > 0
        AND (
          SELECT COALESCE(SUM(cantidad_actual), 0)
          FROM inventario
          WHERE producto_id = p.id AND estado = 'disponible'
        ) <= p.stock_minimo
    `;

    // Distribución por proveedor
    const sqlPorProveedor = `
      SELECT 
        pr.nombre as proveedor,
        COUNT(DISTINCT i.producto_id) as productos,
        SUM(i.cantidad_actual) as unidades
      FROM inventario i
      JOIN proveedores pr ON i.proveedor_id = pr.id
      WHERE i.estado = 'disponible' AND i.cantidad_actual > 0
      GROUP BY pr.id
      ORDER BY unidades DESC
      LIMIT 5
    `;

    const [resumenGeneral] = await dbQuery(sqlTotalProductos);
    const [porVencer] = await dbQuery(sqlPorVencer);
    const [stockBajo] = await dbQuery(sqlStockBajo);
    const topProveedores = await dbQuery(sqlPorProveedor);

    res.json({
      success: true,
      data: {
        resumen: {
          ...resumenGeneral,
          productos_por_vencer: porVencer.total,
          productos_stock_bajo: stockBajo.total
        },
        top_proveedores: topProveedores
      }
    });
  } catch (error) {
    next(error);
  }
};

// Ajustar inventario
const ajustarInventario = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const {
      inventario_id,
      cantidad_nueva,
      motivo,
      observaciones
    } = req.body;

    // Obtener inventario actual
    const [inventarioActual] = await dbQuery(
      'SELECT * FROM inventario WHERE id = ?',
      [inventario_id]
    );

    if (!inventarioActual) {
      return res.status(404).json({
        success: false,
        message: 'Lote de inventario no encontrado'
      });
    }

    const diferencia = cantidad_nueva - inventarioActual.cantidad_actual;

    // Actualizar inventario
    await dbQuery(
      'UPDATE inventario SET cantidad_actual = ?, estado = ? WHERE id = ?',
      [
        cantidad_nueva,
        cantidad_nueva === 0 ? 'agotado' : 'disponible',
        inventario_id
      ]
    );

    // Registrar movimiento
    await dbQuery(
      `INSERT INTO movimientos_inventario (
        fecha, tipo_movimiento, documento_tipo, documento_numero,
        producto_id, inventario_id, cantidad, saldo_anterior, 
        saldo_actual, usuario_id, observaciones
      ) VALUES (
        NOW(), 'ajuste', ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        motivo,
        `AJU-${Date.now()}`,
        inventarioActual.producto_id,
        inventario_id,
        diferencia,
        inventarioActual.cantidad_actual,
        cantidad_nueva,
        req.usuario.id,
        observaciones
      ]
    );

    res.json({
      success: true,
      message: 'Inventario ajustado exitosamente',
      data: {
        inventario_id,
        cantidad_anterior: inventarioActual.cantidad_actual,
        cantidad_nueva,
        diferencia
      }
    });
  } catch (error) {
    next(error);
  }
};

// Transferir entre lotes
const transferirLotes = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const {
      lote_origen_id,
      lote_destino_id,
      cantidad,
      observaciones
    } = req.body;

    // Verificar lotes
    const [loteOrigen] = await dbQuery(
      'SELECT * FROM inventario WHERE id = ?',
      [lote_origen_id]
    );

    const [loteDestino] = await dbQuery(
      'SELECT * FROM inventario WHERE id = ?',
      [lote_destino_id]
    );

    if (!loteOrigen || !loteDestino) {
      return res.status(404).json({
        success: false,
        message: 'Lote no encontrado'
      });
    }

    if (loteOrigen.producto_id !== loteDestino.producto_id) {
      return res.status(400).json({
        success: false,
        message: 'Los lotes deben ser del mismo producto'
      });
    }

    if (loteOrigen.cantidad_actual < cantidad) {
      return res.status(400).json({
        success: false,
        message: 'Cantidad insuficiente en el lote origen'
      });
    }

    // Actualizar lotes
    await dbQuery(
      'UPDATE inventario SET cantidad_actual = cantidad_actual - ? WHERE id = ?',
      [cantidad, lote_origen_id]
    );

    await dbQuery(
      'UPDATE inventario SET cantidad_actual = cantidad_actual + ? WHERE id = ?',
      [cantidad, lote_destino_id]
    );

    // Registrar movimientos
    const numeroTransferencia = `TRF-${Date.now()}`;

    // Movimiento de salida
    await dbQuery(
      `INSERT INTO movimientos_inventario (
        fecha, tipo_movimiento, documento_tipo, documento_numero,
        producto_id, inventario_id, cantidad, saldo_anterior, 
        saldo_actual, usuario_id, observaciones
      ) VALUES (
        NOW(), 'ajuste', 'transferencia', ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        numeroTransferencia,
        loteOrigen.producto_id,
        lote_origen_id,
        -cantidad,
        loteOrigen.cantidad_actual,
        loteOrigen.cantidad_actual - cantidad,
        req.usuario.id,
        `Transferencia a lote ${loteDestino.lote}. ${observaciones || ''}`
      ]
    );

    // Movimiento de entrada
    await dbQuery(
      `INSERT INTO movimientos_inventario (
        fecha, tipo_movimiento, documento_tipo, documento_numero,
        producto_id, inventario_id, cantidad, saldo_anterior, 
        saldo_actual, usuario_id, observaciones
      ) VALUES (
        NOW(), 'ajuste', 'transferencia', ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        numeroTransferencia,
        loteDestino.producto_id,
        lote_destino_id,
        cantidad,
        loteDestino.cantidad_actual,
        loteDestino.cantidad_actual + cantidad,
        req.usuario.id,
        `Transferencia desde lote ${loteOrigen.lote}. ${observaciones || ''}`
      ]
    );

    res.json({
      success: true,
      message: 'Transferencia realizada exitosamente',
      data: {
        numero_transferencia: numeroTransferencia,
        lote_origen: loteOrigen.lote,
        lote_destino: loteDestino.lote,
        cantidad
      }
    });
  } catch (error) {
    next(error);
  }
};

// Exportar inventario
const exportarInventario = async (req, res, next) => {
  try {
    const { formato = 'json' } = req.query;

    const sql = `
      SELECT 
        p.codigo,
        p.referencia,
        p.descripcion,
        c.nombre as categoria,
        pr.nombre as proveedor,
        i.lote,
        i.fecha_vencimiento,
        i.cantidad_inicial,
        i.cantidad_actual,
        i.ubicacion,
        i.estado,
        DATEDIFF(i.fecha_vencimiento, CURDATE()) as dias_para_vencer,
        p.precio_compra,
        p.precio_venta,
        (i.cantidad_actual * p.precio_venta) as valor_inventario
      FROM inventario i
      JOIN productos p ON i.producto_id = p.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      JOIN proveedores pr ON i.proveedor_id = pr.id
      WHERE i.cantidad_actual > 0
      ORDER BY p.codigo, i.fecha_vencimiento
    `;

    const inventario = await dbQuery(sql);

    if (formato === 'csv') {
      const csv = convertirACSV(inventario);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=inventario.csv');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: { inventario }
    });
  } catch (error) {
    next(error);
  }
};

// Función auxiliar para convertir a CSV
function convertirACSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      return value !== null ? `"${value}"` : '""';
    }).join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
}

module.exports = {
  obtenerInventario,
  obtenerKardex,
  obtenerResumen,
  ajustarInventario,
  transferirLotes,
  exportarInventario
};