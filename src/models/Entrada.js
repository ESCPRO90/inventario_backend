const { query, transaction } = require('../config/database');

class Entrada {
  // Crear nueva entrada con transacción
  static async crear(datos, detalles) {
    return await transaction(async (connection) => {
      const {
        proveedor_id,
        tipo_documento = 'factura',
        numero_documento = null,
        fecha,
        usuario_id,
        observaciones = null
      } = datos;

      // 1. Crear entrada principal
      const sqlEntrada = `
        INSERT INTO entradas (
          numero_entrada, fecha, proveedor_id, tipo_documento, 
          numero_documento, usuario_id, observaciones, total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `;

      // Generar número de entrada
      const numeroEntrada = await this.generarNumeroEntrada(connection);

      const resultEntrada = await connection.execute(sqlEntrada, [
        numeroEntrada,
        fecha,
        proveedor_id,
        tipo_documento,
        numero_documento,
        usuario_id,
        observaciones
      ]);

      const entradaId = resultEntrada[0].insertId;
      let totalEntrada = 0;

      // 2. Procesar cada detalle
      for (const detalle of detalles) {
        const {
          producto_id,
          cantidad,
          precio_unitario,
          lote,
          fecha_vencimiento
        } = detalle;

        // Insertar en inventario
        const sqlInventario = `
          INSERT INTO inventario (
            producto_id, proveedor_id, lote, fecha_vencimiento,
            cantidad_inicial, cantidad_actual, estado
          ) VALUES (?, ?, ?, ?, ?, ?, 'disponible')
        `;

        const resultInventario = await connection.execute(sqlInventario, [
          producto_id,
          proveedor_id,
          lote,
          fecha_vencimiento,
          cantidad,
          cantidad
        ]);

        const inventarioId = resultInventario[0].insertId;

        // Insertar detalle de entrada
        const sqlDetalle = `
          INSERT INTO entradas_detalle (
            entrada_id, producto_id, cantidad, precio_unitario,
            lote, fecha_vencimiento, inventario_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await connection.execute(sqlDetalle, [
          entradaId,
          producto_id,
          cantidad,
          precio_unitario,
          lote,
          fecha_vencimiento,
          inventarioId
        ]);

        // Registrar movimiento en kardex
        const sqlMovimiento = `
          INSERT INTO movimientos_inventario (
            fecha, tipo_movimiento, documento_tipo, documento_id,
            documento_numero, producto_id, inventario_id, cantidad,
            saldo_anterior, saldo_actual, costo_unitario, usuario_id
          ) VALUES (
            NOW(), 'entrada', 'entrada', ?, ?, ?, ?, ?, 0, ?, ?, ?
          )
        `;

        await connection.execute(sqlMovimiento, [
          entradaId,
          numeroEntrada,
          producto_id,
          inventarioId,
          cantidad,
          cantidad,
          precio_unitario,
          usuario_id
        ]);

        totalEntrada += cantidad * precio_unitario;
      }

      // 3. Actualizar total de la entrada
      await connection.execute(
        'UPDATE entradas SET total = ? WHERE id = ?',
        [totalEntrada, entradaId]
      );

      return {
        id: entradaId,
        numero_entrada: numeroEntrada,
        total: totalEntrada
      };
    });
  }

  // Generar número de entrada automático
  static async generarNumeroEntrada(connection = null) {
    const sql = `
      SELECT numero_entrada 
      FROM entradas 
      WHERE numero_entrada LIKE 'ENT-%' 
      ORDER BY id DESC 
      LIMIT 1
    `;

    const conn = connection || { execute: async (sql) => [await query(sql)] };
    const [result] = await conn.execute(sql);
    
    if (result.length === 0) {
      return 'ENT-000001';
    }

    const ultimoNumero = result[0].numero_entrada;
    const numero = parseInt(ultimoNumero.split('-')[1]) + 1;
    return `ENT-${numero.toString().padStart(6, '0')}`;
  }

  // Buscar entrada por ID
  static async buscarPorId(id) {
    const sql = `
      SELECT e.*,
        p.nombre as proveedor_nombre,
        u.nombre_completo as usuario_nombre
      FROM entradas e
      JOIN proveedores p ON e.proveedor_id = p.id
      JOIN usuarios u ON e.usuario_id = u.id
      WHERE e.id = ?
    `;
    
    const entradas = await query(sql, [id]);
    return entradas[0];
  }

  // Obtener detalles de una entrada
  static async obtenerDetalles(entradaId) {
    const sql = `
      SELECT ed.*,
        p.codigo as producto_codigo,
        p.descripcion as producto_descripcion,
        p.unidad_medida,
        (ed.cantidad * ed.precio_unitario) as subtotal
      FROM entradas_detalle ed
      JOIN productos p ON ed.producto_id = p.id
      WHERE ed.entrada_id = ?
      ORDER BY p.codigo
    `;

    return await query(sql, [entradaId]);
  }

  // Listar entradas con paginación
  static async listar(opciones = {}) {
    const {
      pagina = 1,
      limite = 20,
      buscar = '',
      proveedor_id = null,
      fecha_inicio = null,
      fecha_fin = null,
      estado = null,
      orden = 'fecha',
      direccion = 'DESC'
    } = opciones;

    const offset = (pagina - 1) * limite;
    const parametros = [];
    let whereClause = 'WHERE 1=1';

    // Filtros
    if (buscar) {
      whereClause += ' AND (e.numero_entrada LIKE ? OR e.numero_documento LIKE ? OR p.nombre LIKE ?)';
      const buscarPattern = `%${buscar}%`;
      parametros.push(buscarPattern, buscarPattern, buscarPattern);
    }

    if (proveedor_id) {
      whereClause += ' AND e.proveedor_id = ?';
      parametros.push(proveedor_id);
    }

    if (fecha_inicio) {
      whereClause += ' AND e.fecha >= ?';
      parametros.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereClause += ' AND e.fecha <= ?';
      parametros.push(fecha_fin);
    }

    if (estado) {
      whereClause += ' AND e.estado = ?';
      parametros.push(estado);
    }

    // Query para contar total
    const sqlCount = `
      SELECT COUNT(DISTINCT e.id) as total
      FROM entradas e
      JOIN proveedores p ON e.proveedor_id = p.id
      ${whereClause}
    `;
    
    const [{ total }] = await query(sqlCount, parametros);

    // Query principal
    parametros.push(limite, offset);
    const sql = `
      SELECT e.*,
        p.codigo as proveedor_codigo,
        p.nombre as proveedor_nombre,
        u.nombre_completo as usuario_nombre,
        COUNT(ed.id) as total_items,
        SUM(ed.cantidad) as total_unidades
      FROM entradas e
      JOIN proveedores p ON e.proveedor_id = p.id
      JOIN usuarios u ON e.usuario_id = u.id
      LEFT JOIN entradas_detalle ed ON e.id = ed.entrada_id
      ${whereClause}
      GROUP BY e.id
      ORDER BY e.${orden} ${direccion}
      LIMIT ? OFFSET ?
    `;

    const entradas = await query(sql, parametros);

    return {
      entradas,
      paginacion: {
        total,
        pagina_actual: pagina,
        total_paginas: Math.ceil(total / limite),
        limite
      }
    };
  }

  // Anular entrada (reversar inventario)
  static async anular(id, usuarioId) {
    return await transaction(async (connection) => {
      // 1. Verificar que la entrada existe y está procesada
      const [entrada] = await connection.execute(
        'SELECT * FROM entradas WHERE id = ? AND estado = "procesada"',
        [id]
      );

      if (entrada.length === 0) {
        throw new Error('Entrada no encontrada o ya está anulada');
      }

      // 2. Obtener detalles de la entrada
      const [detalles] = await connection.execute(
        'SELECT * FROM entradas_detalle WHERE entrada_id = ?',
        [id]
      );

      // 3. Reversar cada item del inventario
      for (const detalle of detalles) {
        // Verificar que el inventario tiene suficiente cantidad
        const [inventario] = await connection.execute(
          'SELECT * FROM inventario WHERE id = ?',
          [detalle.inventario_id]
        );

        if (inventario[0].cantidad_actual < detalle.cantidad) {
          throw new Error(
            `No se puede anular: el lote ${detalle.lote} no tiene suficiente cantidad disponible`
          );
        }

        // Actualizar inventario
        await connection.execute(
          'UPDATE inventario SET cantidad_actual = cantidad_actual - ? WHERE id = ?',
          [detalle.cantidad, detalle.inventario_id]
        );

        // Si queda en cero, cambiar estado
        await connection.execute(
          'UPDATE inventario SET estado = "agotado" WHERE id = ? AND cantidad_actual = 0',
          [detalle.inventario_id]
        );

        // Registrar movimiento negativo
        await connection.execute(
          `INSERT INTO movimientos_inventario (
            fecha, tipo_movimiento, documento_tipo, documento_id,
            documento_numero, producto_id, inventario_id, cantidad,
            saldo_anterior, saldo_actual, costo_unitario, usuario_id,
            observaciones
          ) VALUES (
            NOW(), 'ajuste', 'anulacion_entrada', ?, ?, ?, ?, ?, ?, ?, ?, ?,
            'Anulación de entrada'
          )`,
          [
            id,
            entrada[0].numero_entrada,
            detalle.producto_id,
            detalle.inventario_id,
            -detalle.cantidad,
            inventario[0].cantidad_actual,
            inventario[0].cantidad_actual - detalle.cantidad,
            detalle.precio_unitario,
            usuarioId
          ]
        );
      }

      // 4. Actualizar estado de la entrada
      await connection.execute(
        'UPDATE entradas SET estado = "anulada" WHERE id = ?',
        [id]
      );

      return true;
    });
  }

  // Estadísticas de entradas
  static async obtenerEstadisticas(filtros = {}) {
    const { fecha_inicio, fecha_fin, proveedor_id } = filtros;
    let whereClause = 'WHERE e.estado = "procesada"';
    const parametros = [];

    if (fecha_inicio) {
      whereClause += ' AND e.fecha >= ?';
      parametros.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereClause += ' AND e.fecha <= ?';
      parametros.push(fecha_fin);
    }

    if (proveedor_id) {
      whereClause += ' AND e.proveedor_id = ?';
      parametros.push(proveedor_id);
    }

    const sql = `
      SELECT 
        COUNT(DISTINCT e.id) as total_entradas,
        COUNT(DISTINCT e.proveedor_id) as total_proveedores,
        SUM(e.total) as monto_total,
        AVG(e.total) as monto_promedio,
        COUNT(DISTINCT ed.producto_id) as productos_diferentes,
        SUM(ed.cantidad) as unidades_totales
      FROM entradas e
      LEFT JOIN entradas_detalle ed ON e.id = ed.entrada_id
      ${whereClause}
    `;

    const [estadisticas] = await query(sql, parametros);
    return estadisticas;
  }

  // Entradas recientes
  static async entradasRecientes(limite = 10) {
    const sql = `
      SELECT e.*,
        p.nombre as proveedor_nombre,
        u.nombre_completo as usuario_nombre,
        COUNT(ed.id) as total_items
      FROM entradas e
      JOIN proveedores p ON e.proveedor_id = p.id
      JOIN usuarios u ON e.usuario_id = u.id
      LEFT JOIN entradas_detalle ed ON e.id = ed.entrada_id
      WHERE e.estado = 'procesada'
      GROUP BY e.id
      ORDER BY e.fecha DESC, e.id DESC
      LIMIT ?
    `;

    return await query(sql, [limite]);
  }
}

module.exports = Entrada;