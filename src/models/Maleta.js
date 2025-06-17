const { query } = require('../config/database');

class Maleta {
  // Crear nueva maleta
  static async crear(datos) {
    const {
      codigo,
      nombre,
      tipo,
      responsable = null,
      ubicacion = null
    } = datos;

    const sql = `
      INSERT INTO maletas (codigo, nombre, tipo, responsable, ubicacion)
      VALUES (?, ?, ?, ?, ?)
    `;

    try {
      const result = await query(sql, [codigo, nombre, tipo, responsable, ubicacion]);
      return {
        id: result.insertId,
        ...datos
      };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('El código de maleta ya existe');
      }
      throw error;
    }
  }

  // Buscar maleta por ID
  static async buscarPorId(id) {
    const sql = `
      SELECT m.*,
        COUNT(DISTINCT sd.producto_id) as productos_diferentes,
        SUM(CASE WHEN sd.estado = 'activo' THEN sd.cantidad ELSE 0 END) as unidades_actuales,
        COUNT(DISTINCT s.id) as total_envios,
        COUNT(DISTINCT nr.id) as total_remisiones
      FROM maletas m
      LEFT JOIN salidas s ON m.id = s.maleta_id
      LEFT JOIN salidas_detalle sd ON s.id = sd.salida_id
      LEFT JOIN notas_remision nr ON m.id = nr.maleta_id
      WHERE m.id = ? AND m.activo = true
      GROUP BY m.id
    `;
    
    const maletas = await query(sql, [id]);
    return maletas[0];
  }

  // Listar todas las maletas
  static async listar() {
    const sql = `
      SELECT m.*,
        COUNT(DISTINCT CASE WHEN sd.estado = 'activo' THEN sd.producto_id END) as productos_actuales,
        SUM(CASE WHEN sd.estado = 'activo' THEN sd.cantidad ELSE 0 END) as unidades_actuales,
        MAX(s.fecha) as ultimo_envio
      FROM maletas m
      LEFT JOIN salidas s ON m.id = s.maleta_id AND s.tipo_salida = 'maleta'
      LEFT JOIN salidas_detalle sd ON s.id = sd.salida_id
      WHERE m.activo = true
      GROUP BY m.id
      ORDER BY m.tipo, m.nombre
    `;

    return await query(sql);
  }

  // Actualizar maleta
  static async actualizar(id, datos) {
    const camposPermitidos = ['nombre', 'tipo', 'responsable', 'ubicacion'];
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
    const sql = `UPDATE maletas SET ${campos.join(', ')} WHERE id = ? AND activo = true`;
    
    const result = await query(sql, valores);
    return result.affectedRows > 0;
  }

  // Desactivar maleta
  static async desactivar(id) {
    // Verificar si tiene productos
    const sqlCheck = `
      SELECT COUNT(*) as total 
      FROM salidas s
      JOIN salidas_detalle sd ON s.id = sd.salida_id
      WHERE s.maleta_id = ? 
        AND s.tipo_salida = 'maleta'
        AND sd.estado = 'activo'
    `;
    
    const [{ total }] = await query(sqlCheck, [id]);
    
    if (total > 0) {
      throw new Error(`No se puede desactivar la maleta porque tiene ${total} productos activos`);
    }

    const sql = 'UPDATE maletas SET activo = false WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // Obtener contenido actual de la maleta
  static async obtenerContenido(maletaId) {
    const sql = `
      SELECT 
        p.id as producto_id,
        p.codigo,
        p.descripcion,
        p.unidad_medida,
        sd.lote,
        sd.fecha_vencimiento,
        sd.cantidad,
        sd.precio_unitario,
        s.numero_salida,
        s.fecha as fecha_envio,
        sd.id as salida_detalle_id,
        DATEDIFF(sd.fecha_vencimiento, CURDATE()) as dias_para_vencer
      FROM salidas s
      JOIN salidas_detalle sd ON s.id = sd.salida_id
      JOIN productos p ON sd.producto_id = p.id
      WHERE s.maleta_id = ? 
        AND s.tipo_salida = 'maleta' 
        AND s.estado = 'procesada'
        AND sd.estado = 'activo'
      ORDER BY p.codigo, sd.fecha_vencimiento
    `;

    return await query(sql, [maletaId]);
  }

  // Historial de movimientos de la maleta
  static async obtenerHistorial(maletaId, limite = 50) {
    const sql = `
      SELECT 
        'envio' as tipo_movimiento,
        s.id as documento_id,
        s.numero_salida as numero_documento,
        s.fecha,
        NULL as cliente_nombre,
        u.nombre_completo as usuario,
        COUNT(sd.id) as items,
        SUM(sd.cantidad) as unidades,
        'Envío a maleta' as descripcion
      FROM salidas s
      JOIN usuarios u ON s.usuario_id = u.id
      LEFT JOIN salidas_detalle sd ON s.id = sd.salida_id
      WHERE s.maleta_id = ? AND s.tipo_salida = 'maleta'
      GROUP BY s.id
      
      UNION ALL
      
      SELECT 
        'remision' as tipo_movimiento,
        nr.id as documento_id,
        nr.numero_remision as numero_documento,
        nr.fecha,
        c.nombre as cliente_nombre,
        u.nombre_completo as usuario,
        COUNT(nrd.id) as items,
        SUM(nrd.cantidad) as unidades,
        CONCAT('Remisión a ', c.nombre) as descripcion
      FROM notas_remision nr
      JOIN clientes c ON nr.cliente_id = c.id
      JOIN usuarios u ON nr.usuario_id = u.id
      LEFT JOIN notas_remision_detalle nrd ON nr.id = nrd.remision_id
      WHERE nr.maleta_id = ?
      GROUP BY nr.id
      
      ORDER BY fecha DESC
      LIMIT ?
    `;

    return await query(sql, [maletaId, maletaId, limite]);
  }

  // Estadísticas de la maleta
  static async obtenerEstadisticas(maletaId) {
    // Productos más utilizados
    const sqlTopProductos = `
      SELECT 
        p.codigo,
        p.descripcion,
        COUNT(DISTINCT s.id) as veces_enviado,
        SUM(sd.cantidad) as cantidad_total
      FROM salidas s
      JOIN salidas_detalle sd ON s.id = sd.salida_id
      JOIN productos p ON sd.producto_id = p.id
      WHERE s.maleta_id = ? AND s.tipo_salida = 'maleta'
      GROUP BY p.id
      ORDER BY veces_enviado DESC
      LIMIT 10
    `;

    // Resumen general
    const sqlResumen = `
      SELECT 
        COUNT(DISTINCT s.id) as total_envios,
        COUNT(DISTINCT nr.id) as total_remisiones,
        COUNT(DISTINCT nr.cliente_id) as clientes_atendidos,
        MIN(s.fecha) as primer_envio,
        MAX(s.fecha) as ultimo_envio
      FROM maletas m
      LEFT JOIN salidas s ON m.id = s.maleta_id AND s.tipo_salida = 'maleta'
      LEFT JOIN notas_remision nr ON m.id = nr.maleta_id
      WHERE m.id = ?
    `;

    const topProductos = await query(sqlTopProductos, [maletaId]);
    const [resumen] = await query(sqlResumen, [maletaId]);

    return {
      resumen,
      top_productos: topProductos
    };
  }
}

module.exports = Maleta;