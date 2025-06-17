const { query, transaction } = require('../config/database');

class Salida {
  // Crear nueva salida con transacción
  static async crear(datos, detalles) {
    return await transaction(async (connection) => {
      const {
        tipo_salida,
        cliente_id = null,
        maleta_id = null,
        fecha,
        usuario_id,
        observaciones = null
      } = datos;

      // Validar que tenga destino
      if (tipo_salida === 'consignacion' && !cliente_id) {
        throw new Error('Las consignaciones requieren un cliente');
      }
      if (tipo_salida === 'maleta' && !maleta_id) {
        throw new Error('Las salidas a maleta requieren una maleta');
      }

      // 1. Crear salida principal
      const sqlSalida = `
        INSERT INTO salidas (
          numero_salida, fecha, tipo_salida, cliente_id, 
          maleta_id, usuario_id, observaciones, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'procesada')
      `;

      // Generar número de salida
      const numeroSalida = await this.generarNumeroSalida(connection);

      const resultSalida = await connection.execute(sqlSalida, [
        numeroSalida,
        fecha,
        tipo_salida,
        cliente_id,
        maleta_id,
        usuario_id,
        observaciones
      ]);

      const salidaId = resultSalida[0].insertId;

      // 2. Procesar cada detalle
      for (const detalle of detalles) {
        const {
          producto_id,
          cantidad,
          precio_unitario = 0,
          lote = null
        } = detalle;

        // Buscar inventario disponible
        let sqlInventario = `
          SELECT i.*, p.precio_venta
          FROM inventario i
          JOIN productos p ON i.producto_id = p.id
          WHERE i.producto_id = ? 
            AND i.estado = 'disponible' 
            AND i.cantidad_actual >= ?
        `;
        
        const parametros = [producto_id, cantidad];
        
        // Si especifica lote, buscar ese lote específico
        if (lote) {
          sqlInventario += ' AND i.lote = ?';
          parametros.push(lote);
        }
        
        sqlInventario += ' ORDER BY i.fecha_vencimiento, i.created_at LIMIT 1';
        
        const [inventarios] = await connection.execute(sqlInventario, parametros);
        
        if (inventarios.length === 0) {
          throw new Error(`No hay suficiente inventario disponible para el producto ${producto_id}`);
        }
        
        const inventario = inventarios[0];
        const precioFinal = precio_unitario || inventario.precio_venta;
        
        // Actualizar inventario
        await connection.execute(
          'UPDATE inventario SET cantidad_actual = cantidad_actual - ? WHERE id = ?',
          [cantidad, inventario.id]
        );

        // Si queda en cero, cambiar estado
        await connection.execute(
          'UPDATE inventario SET estado = "agotado" WHERE id = ? AND cantidad_actual = 0',
          [inventario.id]
        );

        // Insertar detalle de salida
        const sqlDetalle = `
          INSERT INTO salidas_detalle (
            salida_id, producto_id, inventario_id, cantidad,
            precio_unitario, lote, fecha_vencimiento
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await connection.execute(sqlDetalle, [
          salidaId,
          producto_id,
          inventario.id,
          cantidad,
          precioFinal,
          inventario.lote,
          inventario.fecha_vencimiento
        ]);

        // Registrar movimiento en kardex
        const sqlMovimiento = `
          INSERT INTO movimientos_inventario (
            fecha, tipo_movimiento, documento_tipo, documento_id,
            documento_numero, producto_id, inventario_id, cantidad,
            saldo_anterior, saldo_actual, costo_unitario, usuario_id
          ) VALUES (
            NOW(), 'salida', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
        `;

        await connection.execute(sqlMovimiento, [
          tipo_salida,
          salidaId,
          numeroSalida,
          producto_id,
          inventario.id,
          -cantidad,
          inventario.cantidad_actual + cantidad,
          inventario.cantidad_actual,
          precioFinal,
          usuario_id
        ]);
      }

      return {
        id: salidaId,
        numero_salida: numeroSalida
      };
    });
  }

  // Generar número de salida automático
  static async generarNumeroSalida(connection = null) {
    const sql = `
      SELECT numero_salida 
      FROM salidas 
      WHERE numero_salida LIKE 'SAL-%' 
      ORDER BY id DESC 
      LIMIT 1
    `;

    const conn = connection || { execute: async (sql) => [await query(sql)] };
    const [result] = await conn.execute(sql);
    
    if (result.length === 0) {
      return 'SAL-000001';
    }

    const ultimoNumero = result[0].numero_salida;
    const numero = parseInt(ultimoNumero.split('-')[1]) + 1;
    return `SAL-${numero.toString().padStart(6, '0')}`;
  }

  // Buscar salida por ID
  static async buscarPorId(id) {
    const sql = `
      SELECT s.*,
        c.nombre as cliente_nombre,
        m.nombre as maleta_nombre,
        u.nombre_completo as usuario_nombre,
        CASE 
          WHEN s.factura_id IS NOT NULL THEN 'facturada'
          WHEN s.tipo_salida = 'maleta' THEN 'en_maleta'
          WHEN s.tipo_salida = 'consignacion' THEN 'en_consignacion'
          ELSE s.estado
        END as estado_actual
      FROM salidas s
      LEFT JOIN clientes c ON s.cliente_id = c.id
      LEFT JOIN maletas m ON s.maleta_id = m.id
      JOIN usuarios u ON s.usuario_id = u.id
      WHERE s.id = ?
    `;
    
    const salidas = await query(sql, [id]);
    return salidas[0];
  }

  // Obtener detalles de una salida
  static async obtenerDetalles(salidaId) {
    const sql = `
      SELECT sd.*,
        p.codigo as producto_codigo,
        p.descripcion as producto_descripcion,
        p.unidad_medida,
        (sd.cantidad * sd.precio_unitario) as subtotal
      FROM salidas_detalle sd
      JOIN productos p ON sd.producto_id = p.id
      WHERE sd.salida_id = ?
      ORDER BY p.codigo
    `;

    return await query(sql, [salidaId]);
  }

  // Listar salidas con paginación
  static async listar(opciones = {}) {
    const {
      pagina = 1,
      limite = 20,
      buscar = '',
      tipo_salida = null,
      cliente_id = null,
      maleta_id = null,
      estado = null,
      fecha_inicio = null,
      fecha_fin = null,
      pendientes_facturar = false,
      orden = 'fecha',
      direccion = 'DESC'
    } = opciones;

    const offset = (pagina - 1) * limite;
    const parametros = [];
    let whereClause = 'WHERE 1=1';

    // Filtros
    if (buscar) {
      whereClause += ' AND (s.numero_salida LIKE ? OR c.nombre LIKE ? OR m.nombre LIKE ?)';
      const buscarPattern = `%${buscar}%`;
      parametros.push(buscarPattern, buscarPattern, buscarPattern);
    }

    if (tipo_salida) {
      whereClause += ' AND s.tipo_salida = ?';
      parametros.push(tipo_salida);
    }

    if (cliente_id) {
      whereClause += ' AND s.cliente_id = ?';
      parametros.push(cliente_id);
    }

    if (maleta_id) {
      whereClause += ' AND s.maleta_id = ?';
      parametros.push(maleta_id);
    }

    if (estado) {
      whereClause += ' AND s.estado = ?';
      parametros.push(estado);
    }

    if (fecha_inicio) {
      whereClause += ' AND s.fecha >= ?';
      parametros.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereClause += ' AND s.fecha <= ?';
      parametros.push(fecha_fin);
    }

    if (pendientes_facturar) {
      whereClause += ' AND s.tipo_salida IN ("consignacion", "venta") AND s.estado = "procesada" AND s.factura_id IS NULL';
    }

    // Query para contar total
    const sqlCount = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM salidas s
      LEFT JOIN clientes c ON s.cliente_id = c.id
      LEFT JOIN maletas m ON s.maleta_id = m.id
      ${whereClause}
    `;
    
    const [{ total }] = await query(sqlCount, parametros);

    // Query principal
    parametros.push(limite, offset);
    const sql = `
      SELECT s.*,
        c.codigo as cliente_codigo,
        c.nombre as cliente_nombre,
        m.codigo as maleta_codigo,
        m.nombre as maleta_nombre,
        u.nombre_completo as usuario_nombre,
        COUNT(sd.id) as total_items,
        SUM(sd.cantidad) as total_unidades,
        SUM(sd.cantidad * sd.precio_unitario) as valor_total,
        f.numero_factura,
        CASE 
          WHEN s.factura_id IS NOT NULL THEN 'facturada'
          WHEN s.tipo_salida = 'maleta' THEN 'en_maleta'
          WHEN s.tipo_salida = 'consignacion' AND s.estado = 'procesada' THEN 'pendiente_facturar'
          ELSE s.estado
        END as estado_display
      FROM salidas s
      LEFT JOIN clientes c ON s.cliente_id = c.id
      LEFT JOIN maletas m ON s.maleta_id = m.id
      JOIN usuarios u ON s.usuario_id = u.id
      LEFT JOIN salidas_detalle sd ON s.id = sd.salida_id
      LEFT JOIN facturas f ON s.factura_id = f.id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.${orden} ${direccion}
      LIMIT ? OFFSET ?
    `;

    const salidas = await query(sql, parametros);

    return {
      salidas,
      paginacion: {
        total,
        pagina_actual: pagina,
        total_paginas: Math.ceil(total / limite),
        limite
      }
    };
  }

  // Salidas pendientes de facturar
  static async salidasPendientesFacturar(clienteId = null) {
    let whereClause = `
      WHERE s.tipo_salida = 'consignacion' 
        AND s.estado = 'procesada' 
        AND s.factura_id IS NULL
    `;
    
    const parametros = [];
    
    if (clienteId) {
      whereClause += ' AND s.cliente_id = ?';
      parametros.push(clienteId);
    }

    const sql = `
      SELECT s.*,
        c.codigo as cliente_codigo,
        c.nombre as cliente_nombre,
        COUNT(sd.id) as total_items,
        SUM(sd.cantidad) as total_unidades,
        SUM(sd.cantidad * sd.precio_unitario) as valor_total,
        DATEDIFF(CURDATE(), s.fecha) as dias_pendiente
      FROM salidas s
      JOIN clientes c ON s.cliente_id = c.id
      LEFT JOIN salidas_detalle sd ON s.id = sd.salida_id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.fecha
    `;

    return await query(sql, parametros);
  }

  // Productos en maletas
  static async productosEnMaletas(maletaId = null) {
    let whereClause = `
      WHERE s.tipo_salida = 'maleta' 
        AND s.estado = 'procesada'
        AND sd.estado = 'activo'
    `;
    
    const parametros = [];
    
    if (maletaId) {
      whereClause += ' AND s.maleta_id = ?';
      parametros.push(maletaId);
    }

    const sql = `
      SELECT 
        m.id as maleta_id,
        m.codigo as maleta_codigo,
        m.nombre as maleta_nombre,
        m.tipo as maleta_tipo,
        p.codigo as producto_codigo,
        p.descripcion as producto_descripcion,
        sd.lote,
        sd.fecha_vencimiento,
        sd.cantidad,
        s.fecha as fecha_envio,
        s.numero_salida,
        DATEDIFF(sd.fecha_vencimiento, CURDATE()) as dias_para_vencer
      FROM salidas s
      JOIN maletas m ON s.maleta_id = m.id
      JOIN salidas_detalle sd ON s.id = sd.salida_id
      JOIN productos p ON sd.producto_id = p.id
      ${whereClause}
      ORDER BY m.nombre, p.codigo
    `;

    return await query(sql, parametros);
  }

  // Anular salida (reversar inventario)
  static async anular(id, usuarioId) {
    return await transaction(async (connection) => {
      // 1. Verificar que la salida existe y se puede anular
      const [salida] = await connection.execute(
        'SELECT * FROM salidas WHERE id = ? AND estado = "procesada"',
        [id]
      );

      if (salida.length === 0) {
        throw new Error('Salida no encontrada o ya está anulada');
      }

      if (salida[0].factura_id) {
        throw new Error('No se puede anular una salida que ya fue facturada');
      }

      // 2. Obtener detalles de la salida
      const [detalles] = await connection.execute(
        'SELECT * FROM salidas_detalle WHERE salida_id = ?',
        [id]
      );

      // 3. Reversar cada item al inventario
      for (const detalle of detalles) {
        // Actualizar inventario
        await connection.execute(
          'UPDATE inventario SET cantidad_actual = cantidad_actual + ?, estado = "disponible" WHERE id = ?',
          [detalle.cantidad, detalle.inventario_id]
        );

        // Obtener saldo actual
        const [inventario] = await connection.execute(
          'SELECT cantidad_actual FROM inventario WHERE id = ?',
          [detalle.inventario_id]
        );

        // Registrar movimiento de reversión
        await connection.execute(
          `INSERT INTO movimientos_inventario (
            fecha, tipo_movimiento, documento_tipo, documento_id,
            documento_numero, producto_id, inventario_id, cantidad,
            saldo_anterior, saldo_actual, costo_unitario, usuario_id,
            observaciones
          ) VALUES (
            NOW(), 'ajuste', 'anulacion_salida', ?, ?, ?, ?, ?, ?, ?, ?, ?,
            'Anulación de salida'
          )`,
          [
            id,
            salida[0].numero_salida,
            detalle.producto_id,
            detalle.inventario_id,
            detalle.cantidad,
            inventario[0].cantidad_actual - detalle.cantidad,
            inventario[0].cantidad_actual,
            detalle.precio_unitario,
            usuarioId
          ]
        );
      }

      // 4. Actualizar estado de la salida
      await connection.execute(
        'UPDATE salidas SET estado = "anulada" WHERE id = ?',
        [id]
      );

      // 5. Actualizar estado de los detalles
      await connection.execute(
        'UPDATE salidas_detalle SET estado = "anulado" WHERE salida_id = ?',
        [id]
      );

      return true;
    });
  }

  // Estadísticas de salidas
  static async obtenerEstadisticas(filtros = {}) {
    const { fecha_inicio, fecha_fin, tipo_salida } = filtros;
    let whereClause = 'WHERE s.estado != "anulada"';
    const parametros = [];

    if (fecha_inicio) {
      whereClause += ' AND s.fecha >= ?';
      parametros.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereClause += ' AND s.fecha <= ?';
      parametros.push(fecha_fin);
    }

    if (tipo_salida) {
      whereClause += ' AND s.tipo_salida = ?';
      parametros.push(tipo_salida);
    }

    const sql = `
      SELECT 
        COUNT(DISTINCT s.id) as total_salidas,
        COUNT(DISTINCT CASE WHEN s.tipo_salida = 'venta' THEN s.id END) as total_ventas,
        COUNT(DISTINCT CASE WHEN s.tipo_salida = 'consignacion' THEN s.id END) as total_consignaciones,
        COUNT(DISTINCT CASE WHEN s.tipo_salida = 'maleta' THEN s.id END) as total_maletas,
        COUNT(DISTINCT s.cliente_id) as total_clientes,
        COUNT(DISTINCT s.maleta_id) as total_maletas_usadas,
        COUNT(DISTINCT sd.producto_id) as productos_diferentes,
        SUM(sd.cantidad) as unidades_totales,
        SUM(sd.cantidad * sd.precio_unitario) as valor_total
      FROM salidas s
      LEFT JOIN salidas_detalle sd ON s.id = sd.salida_id
      ${whereClause}
    `;

    const [estadisticas] = await query(sql, parametros);
    return estadisticas;
  }
}

module.exports = Salida;