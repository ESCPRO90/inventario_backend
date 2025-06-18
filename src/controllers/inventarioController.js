const { validationResult } = require('express-validator');
const Inventario = require('../models/Inventario');
const { transaction, query: dbQuery } = require('../config/database'); // query for direct use if still needed

// Obtener inventario general
const obtenerInventario = async (req, res, next) => {
  try {
    // express-validator should handle parsing and basic validation at route level
    // The model method Inventario.obtenerInventarioGeneral will handle defaults and SQL construction
    const resultado = await Inventario.obtenerInventarioGeneral(req.query);
    res.json({
      success: true,
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

// Obtener detalle de un lote específico
const obtenerLotePorId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lote = await Inventario.obtenerDetalleLote(id);
    if (!lote) {
      return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    }
    res.json({ success: true, data: lote });
  } catch (error) {
    next(error);
  }
};


// Obtener kardex de un producto
const obtenerKardex = async (req, res, next) => {
  try {
    const { producto_id } = req.params; // This should be validated as int at route level
    const {
      fecha_inicio,
      fecha_fin,
      tipo_movimiento,
      limite = 50 // Default limit
    } = req.query; // Query params should be validated at route level

    // Parameters for the SQL query
    const parametros = [parseInt(producto_id, 10)];
    let whereClause = 'WHERE m.producto_id = ?';

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
    parametros.push(parseInt(limite, 10));

    // SQL query remains largely the same but executed via dbQuery or a new model method
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

    // This specific query might remain here or be moved to a static method in MovimientoInventario model
    const movimientos = await dbQuery(sql, parametros);

    res.json({
      success: true,
      data: {
        producto_id: parseInt(producto_id, 10),
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
  // This function uses multiple specific SQL queries.
  // These could be moved to static methods in Inventario or related models.
  // For now, let's assume they might stay here or be refactored later if complex.
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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array()
    });
  }

  const { inventario_id, cantidad_nueva, motivo, observaciones } = req.body;
  const usuario_id = req.usuario.id;

  try {
    const inventarioActual = await Inventario.obtenerDetalleLote(inventario_id);
    if (!inventarioActual) {
      return res.status(404).json({ success: false, message: 'Lote de inventario no encontrado' });
    }

    const dataAjuste = {
      inventario_id: parseInt(inventario_id, 10),
      cantidad_nueva: parseInt(cantidad_nueva, 10),
      motivo,
      observaciones,
      usuario_id,
      producto_id: inventarioActual.producto_id,
      diferencia: parseInt(cantidad_nueva, 10) - inventarioActual.cantidad_actual,
      saldo_anterior: inventarioActual.cantidad_actual
    };

    await transaction(async (connection) => {
      await Inventario.ajustarInventario(dataAjuste, connection);
    });

    res.json({
      success: true,
      message: 'Inventario ajustado exitosamente',
      data: {
        inventario_id: dataAjuste.inventario_id,
        cantidad_anterior: dataAjuste.saldo_anterior,
        cantidad_nueva: dataAjuste.cantidad_nueva,
        diferencia: dataAjuste.diferencia
      }
    });
  } catch (error) {
    next(error);
  }
};

// Transferir entre lotes
const transferirLotes = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array()
    });
  }

  const { lote_origen_id, lote_destino_id, cantidad, observaciones } = req.body;
  const usuario_id = req.usuario.id;

  try {
    const loteOrigen = await Inventario.obtenerDetalleLote(lote_origen_id);
    const loteDestino = await Inventario.obtenerDetalleLote(lote_destino_id);

    if (!loteOrigen || !loteDestino) {
      return res.status(404).json({ success: false, message: 'Lote de origen o destino no encontrado' });
    }
    if (loteOrigen.producto_id !== loteDestino.producto_id) {
      return res.status(400).json({ success: false, message: 'Los lotes deben ser del mismo producto' });
    }
    if (loteOrigen.cantidad_actual < cantidad) {
      return res.status(400).json({ success: false, message: 'Cantidad insuficiente en el lote origen' });
    }

    const dataTransferencia = {
      lote_origen_id: parseInt(lote_origen_id, 10),
      lote_destino_id: parseInt(lote_destino_id, 10),
      cantidad_a_transferir: parseInt(cantidad, 10),
      producto_id: loteOrigen.producto_id,
      usuario_id,
      observaciones,
      lote_origen_cantidad_anterior: loteOrigen.cantidad_actual,
      lote_destino_cantidad_anterior: loteDestino.cantidad_actual
    };

    await transaction(async (connection) => {
      await Inventario.transferirLotes(dataTransferencia, connection);
    });

    res.json({
      success: true,
      message: 'Transferencia realizada exitosamente',
      data: {
        lote_origen_id: dataTransferencia.lote_origen_id,
        lote_destino_id: dataTransferencia.lote_destino_id,
        cantidad_transferida: dataTransferencia.cantidad_a_transferir
      }
    });
  } catch (error) {
    next(error);
  }
};


// Exportar inventario
const exportarInventario = async (req, res, next) => {
  // This can also use Inventario.obtenerInventarioGeneral if the export needs the same complex filtering/sorting
  // Or it can remain a specific query if export requirements are different.
  // For now, keeping its specific query.
  try {
    const { formato = 'json' } = req.query; // Validate 'formato' at route level

    // This specific query might be complex enough to warrant its own model method
    // e.g., Inventario.exportarInventarioCompleto(opciones)
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

    const inventario = await dbQuery(sql); // Using dbQuery directly for now

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
      return value !== null && value !== undefined ? `"${String(value).replace(/"/g, '""')}"` : '""';
    }).join(',');
  });

  return [csvHeaders, ...csvRows].join('\n');
}

module.exports = {
  obtenerInventario,
  obtenerLotePorId,
  obtenerKardex,
  obtenerResumen,
  ajustarInventario,
  transferirLotes,
  exportarInventario
};