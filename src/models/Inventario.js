const { query, pool } = require('../config/database');

class Inventario {
  /**
   * Obtener inventario general con filtros, paginación y ordenamiento.
   */
  static async obtenerInventarioGeneral(opciones = {}) {
    const {
      pagina = 1,
      limite = 20,
      buscar = '',
      producto_id,
      proveedor_id,
      estado = 'disponible',
      proximos_vencer,
      orden = 'producto_codigo', // Default sort column
      direccion = 'ASC' // Default sort direction
    } = opciones;

    const offset = (parseInt(pagina, 10) - 1) * parseInt(limite, 10);
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
      parametros.push(parseInt(producto_id, 10));
    }
    if (proveedor_id) {
      whereClause += ' AND i.proveedor_id = ?';
      parametros.push(parseInt(proveedor_id, 10));
    }
    if (estado) {
      whereClause += ' AND i.estado = ?';
      parametros.push(estado);
    }
    if (proximos_vencer) {
      whereClause += ' AND i.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY)';
      parametros.push(parseInt(proximos_vencer, 10));
    }

    // Whitelist for allowed sort columns & validation (defense in depth)
    const allowedOrderColumns = [
      'producto_codigo', 'producto_descripcion', 'proveedor_nombre',
      'lote', 'fecha_vencimiento', 'cantidad_actual', 'dias_para_vencer',
      'valor_inventario', 'i.created_at', 'p.codigo', 'p.descripcion', 'pr.nombre', 'i.lote', // aliases
      'i.cantidad_actual', 'i.fecha_vencimiento' // direct table columns
    ];
    const sortColumn = allowedOrderColumns.includes(orden) ? orden : 'producto_codigo';
    const sortDirection = ['ASC', 'DESC'].includes(direccion.toUpperCase()) ? direccion.toUpperCase() : 'ASC';

    // Query para contar total
    const sqlCount = `
      SELECT COUNT(i.id) as total
      FROM inventario i
      JOIN productos p ON i.producto_id = p.id
      JOIN proveedores pr ON i.proveedor_id = pr.id
      ${whereClause}
    `;
    const [{ total }] = await query(sqlCount, parametros);

    // Query principal
    const sqlSelect = `
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
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `;
    const queryParamsSelect = [...parametros, parseInt(limite, 10), offset];
    const inventario = await query(sqlSelect, queryParamsSelect);

    return {
      inventario,
      paginacion: {
        total,
        pagina_actual: parseInt(pagina, 10),
        total_paginas: Math.ceil(total / parseInt(limite, 10)),
        limite: parseInt(limite, 10)
      }
    };
  }

  /**
   * Verifica si un lote (item de inventario) existe por su ID.
   */
  static async verificarExistenciaLote(id) {
    const [lote] = await query('SELECT id FROM inventario WHERE id = ?', [id]);
    return !!lote;
  }

  /**
   * Obtiene el detalle de un lote (item de inventario) por su ID.
   */
  static async obtenerDetalleLote(id) {
    const [lote] = await query(
      `SELECT
         i.*,
         p.codigo as producto_codigo,
         p.descripcion as producto_descripcion,
         pr.nombre as proveedor_nombre
       FROM inventario i
       JOIN productos p ON i.producto_id = p.id
       JOIN proveedores pr ON i.proveedor_id = pr.id
       WHERE i.id = ?`,
      [id]
    );
    return lote;
  }

  /**
   * Ajustar inventario (positivo o negativo).
   * Este método debe ser llamado dentro de una transacción.
   * @param {object} data - Datos del ajuste.
   * @param {object} connection - Conexión de base de datos transaccional.
   */
  static async ajustarInventario(data, connection) {
    const { inventario_id, cantidad_nueva, motivo, observaciones, usuario_id, producto_id, diferencia, saldo_anterior } = data;
    const q = connection ? connection.execute.bind(connection) : query;


    // 1. Actualizar la cantidad en la tabla 'inventario'
    await q(
      'UPDATE inventario SET cantidad_actual = ?, estado = ? WHERE id = ?',
      [cantidad_nueva, cantidad_nueva > 0 ? 'disponible' : 'agotado', inventario_id]
    );

    // 2. Registrar en 'movimientos_inventario' (asumiendo esta tabla existe)
    // El nombre 'historial_inventario' fue mencionado, pero el controlador usa 'movimientos_inventario'
    const sqlMovimiento = `
      INSERT INTO movimientos_inventario (
        fecha, tipo_movimiento, documento_tipo, documento_numero,
        producto_id, inventario_id, cantidad, saldo_anterior,
        saldo_actual, usuario_id, observaciones
      ) VALUES (NOW(), 'ajuste', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    // documento_numero puede ser un ID de ajuste o algo similar. Usando motivo por ahora.
    await q(sqlMovimiento, [
      motivo, `AJU-${Date.now()}`, producto_id, inventario_id,
      diferencia, saldo_anterior, cantidad_nueva, usuario_id, observaciones
    ]);

    return { success: true, message: 'Inventario ajustado correctamente.' };
  }

  /**
   * Transferir cantidad entre lotes.
   * Este método debe ser llamado dentro de una transacción.
   * @param {object} data - Datos de la transferencia.
   * @param {object} connection - Conexión de base de datos transaccional.
   */
  static async transferirLotes(data, connection) {
    const {
      lote_origen_id, lote_destino_id, cantidad_a_transferir,
      producto_id, usuario_id, observaciones,
      lote_origen_cantidad_anterior, lote_destino_cantidad_anterior // Necesitamos estos para el historial
    } = data;
    const q = connection ? connection.execute.bind(connection) : query;


    // 1. Disminuir stock del lote origen
    await q(
      'UPDATE inventario SET cantidad_actual = cantidad_actual - ? WHERE id = ?',
      [cantidad_a_transferir, lote_origen_id]
    );
    // Podría ser necesario actualizar estado si cantidad_actual llega a 0

    // 2. Aumentar stock del lote destino
    await q(
      'UPDATE inventario SET cantidad_actual = cantidad_actual + ? WHERE id = ?',
      [cantidad_a_transferir, lote_destino_id]
    );

    const numeroTransferencia = `TRF-${Date.now()}`;
    const commonObservacionesOrigen = `Transferencia a lote ID ${lote_destino_id}. ${observaciones || ''}`;
    const commonObservacionesDestino = `Transferencia desde lote ID ${lote_origen_id}. ${observaciones || ''}`;

    // 3. Registrar movimiento de salida para lote origen
    const sqlMovimientoSalida = `
      INSERT INTO movimientos_inventario (
        fecha, tipo_movimiento, documento_tipo, documento_numero,
        producto_id, inventario_id, cantidad, saldo_anterior,
        saldo_actual, usuario_id, observaciones
      ) VALUES (NOW(), 'ajuste', 'transferencia_salida', ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await q(sqlMovimientoSalida, [
      numeroTransferencia, producto_id, lote_origen_id, -cantidad_a_transferir,
      lote_origen_cantidad_anterior, lote_origen_cantidad_anterior - cantidad_a_transferir,
      usuario_id, commonObservacionesOrigen
    ]);

    // 4. Registrar movimiento de entrada para lote destino
    const sqlMovimientoEntrada = `
      INSERT INTO movimientos_inventario (
        fecha, tipo_movimiento, documento_tipo, documento_numero,
        producto_id, inventario_id, cantidad, saldo_anterior,
        saldo_actual, usuario_id, observaciones
      ) VALUES (NOW(), 'ajuste', 'transferencia_entrada', ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await q(sqlMovimientoEntrada, [
      numeroTransferencia, producto_id, lote_destino_id, cantidad_a_transferir,
      lote_destino_cantidad_anterior, lote_destino_cantidad_anterior + cantidad_a_transferir,
      usuario_id, commonObservacionesDestino
    ]);

    return { success: true, message: 'Transferencia realizada correctamente.' };
  }
}

module.exports = Inventario;
