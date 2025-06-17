const { query } = require('../config/database');

class Cliente {
  // Crear nuevo cliente
  static async crear(datos) {
    const {
      codigo,
      nombre,
      tipo = 'hospital',
      nit = null,
      nrc = null,
      direccion = null,
      telefono = null,
      email = null,
      contacto = null,
      credito_activo = false,
      limite_credito = 0
    } = datos;

    const sql = `
      INSERT INTO clientes (
        codigo, nombre, tipo, nit, nrc, direccion, telefono, 
        email, contacto, credito_activo, limite_credito
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const result = await query(sql, [
        codigo, nombre, tipo, nit, nrc, direccion, telefono,
        email, contacto, credito_activo, limite_credito
      ]);

      return {
        id: result.insertId,
        ...datos
      };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('El código de cliente ya existe');
      }
      throw error;
    }
  }

  // Buscar cliente por ID
  static async buscarPorId(id) {
    const sql = `
      SELECT c.*,
        COUNT(DISTINCT s.id) as total_salidas,
        COUNT(DISTINCT nr.id) as total_remisiones,
        COUNT(DISTINCT f.id) as total_facturas,
        COALESCE(SUM(f.total), 0) as total_facturado
      FROM clientes c
      LEFT JOIN salidas s ON c.id = s.cliente_id
      LEFT JOIN notas_remision nr ON c.id = nr.cliente_id
      LEFT JOIN facturas f ON c.id = f.cliente_id
      WHERE c.id = ? AND c.activo = true
      GROUP BY c.id
    `;
    
    const clientes = await query(sql, [id]);
    return clientes[0];
  }

  // Buscar cliente por código
  static async buscarPorCodigo(codigo) {
    const sql = 'SELECT * FROM clientes WHERE codigo = ? AND activo = true';
    const clientes = await query(sql, [codigo]);
    return clientes[0];
  }

  // Listar clientes con paginación
  static async listar(opciones = {}) {
    const {
      pagina = 1,
      limite = 20,
      buscar = '',
      tipo = null,
      credito_activo = null,
      orden = 'nombre',
      direccion = 'ASC'
    } = opciones;

    const offset = (pagina - 1) * limite;
    const parametros = [];
    let whereClause = 'WHERE c.activo = true';

    // Búsqueda
    if (buscar) {
      whereClause += ' AND (c.codigo LIKE ? OR c.nombre LIKE ? OR c.nit LIKE ? OR c.contacto LIKE ?)';
      const buscarPattern = `%${buscar}%`;
      parametros.push(buscarPattern, buscarPattern, buscarPattern, buscarPattern);
    }

    // Filtro por tipo
    if (tipo) {
      whereClause += ' AND c.tipo = ?';
      parametros.push(tipo);
    }

    // Filtro por crédito activo
    if (credito_activo !== null) {
      whereClause += ' AND c.credito_activo = ?';
      parametros.push(credito_activo);
    }

    // Query para contar total
    const sqlCount = `
      SELECT COUNT(*) as total
      FROM clientes c
      ${whereClause}
    `;
    
    const [{ total }] = await query(sqlCount, parametros);

    // Query principal
    parametros.push(limite, offset);
    const sql = `
      SELECT c.*,
        COUNT(DISTINCT s.id) as total_salidas,
        COUNT(DISTINCT f.id) as total_facturas,
        COALESCE(SUM(f.total), 0) as total_facturado,
        MAX(f.fecha) as ultima_factura
      FROM clientes c
      LEFT JOIN salidas s ON c.id = s.cliente_id
      LEFT JOIN facturas f ON c.id = f.cliente_id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.${orden} ${direccion}
      LIMIT ? OFFSET ?
    `;

    const clientes = await query(sql, parametros);

    return {
      clientes,
      paginacion: {
        total,
        pagina_actual: pagina,
        total_paginas: Math.ceil(total / limite),
        limite
      }
    };
  }

  // Actualizar cliente
  static async actualizar(id, datos) {
    const camposPermitidos = [
      'nombre', 'tipo', 'nit', 'nrc', 'direccion', 
      'telefono', 'email', 'contacto', 'credito_activo', 'limite_credito'
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
    const sql = `UPDATE clientes SET ${campos.join(', ')} WHERE id = ? AND activo = true`;
    
    const result = await query(sql, valores);
    return result.affectedRows > 0;
  }

  // Desactivar cliente
  static async desactivar(id) {
    // Verificar si tiene salidas pendientes
    const sqlCheck = `
      SELECT COUNT(*) as total 
      FROM salidas 
      WHERE cliente_id = ? 
        AND estado IN ('pendiente', 'procesada') 
        AND factura_id IS NULL
    `;
    
    const [{ total }] = await query(sqlCheck, [id]);
    
    if (total > 0) {
      throw new Error(`No se puede desactivar el cliente porque tiene ${total} salidas pendientes de facturar`);
    }

    const sql = 'UPDATE clientes SET activo = false WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // Buscar clientes para autocomplete
  static async buscarAutocomplete(termino, limite = 10) {
    const sql = `
      SELECT id, codigo, nombre, tipo, nit
      FROM clientes
      WHERE activo = true 
        AND (codigo LIKE ? OR nombre LIKE ? OR nit LIKE ?)
      ORDER BY nombre
      LIMIT ?
    `;

    const buscarPattern = `%${termino}%`;
    return await query(sql, [buscarPattern, buscarPattern, buscarPattern, limite]);
  }

  // Obtener estado de cuenta
  static async obtenerEstadoCuenta(clienteId) {
    // Facturas pendientes
    const sqlFacturasPendientes = `
      SELECT 
        id,
        numero_factura,
        fecha,
        total,
        DATEDIFF(CURDATE(), fecha) as dias_vencido
      FROM facturas
      WHERE cliente_id = ? 
        AND estado = 'emitida'
      ORDER BY fecha
    `;

    // Salidas pendientes de facturar
    const sqlSalidasPendientes = `
      SELECT 
        s.id,
        s.numero_salida,
        s.fecha,
        SUM(sd.cantidad * sd.precio_unitario) as total,
        DATEDIFF(CURDATE(), s.fecha) as dias_pendiente
      FROM salidas s
      JOIN salidas_detalle sd ON s.id = sd.salida_id
      WHERE s.cliente_id = ? 
        AND s.tipo_salida = 'consignacion'
        AND s.estado = 'procesada'
        AND s.factura_id IS NULL
      GROUP BY s.id
      ORDER BY s.fecha
    `;

    // Resumen
    const sqlResumen = `
      SELECT 
        COALESCE(SUM(CASE WHEN f.estado = 'emitida' THEN f.total ELSE 0 END), 0) as total_por_pagar,
        COALESCE(SUM(CASE WHEN f.estado = 'pagada' THEN f.total ELSE 0 END), 0) as total_pagado,
        COUNT(DISTINCT CASE WHEN f.estado = 'emitida' THEN f.id END) as facturas_pendientes,
        COUNT(DISTINCT s.id) as salidas_pendientes_facturar
      FROM clientes c
      LEFT JOIN facturas f ON c.id = f.cliente_id
      LEFT JOIN salidas s ON c.id = s.cliente_id 
        AND s.tipo_salida = 'consignacion'
        AND s.estado = 'procesada'
        AND s.factura_id IS NULL
      WHERE c.id = ?
    `;

    const facturasPendientes = await query(sqlFacturasPendientes, [clienteId]);
    const salidasPendientes = await query(sqlSalidasPendientes, [clienteId]);
    const [resumen] = await query(sqlResumen, [clienteId]);

    return {
      resumen,
      facturas_pendientes: facturasPendientes,
      salidas_pendientes: salidasPendientes
    };
  }

  // Verificar límite de crédito
  static async verificarLimiteCredito(clienteId, montoNuevo = 0) {
    const sql = `
      SELECT 
        c.credito_activo,
        c.limite_credito,
        COALESCE(SUM(f.total), 0) as deuda_actual
      FROM clientes c
      LEFT JOIN facturas f ON c.id = f.cliente_id AND f.estado = 'emitida'
      WHERE c.id = ?
      GROUP BY c.id
    `;

    const [cliente] = await query(sql, [clienteId]);

    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }

    if (!cliente.credito_activo) {
      return {
        tiene_credito: false,
        mensaje: 'Cliente no tiene crédito activo'
      };
    }

    const deudaTotal = parseFloat(cliente.deuda_actual) + parseFloat(montoNuevo);
    const limiteDisponible = parseFloat(cliente.limite_credito) - parseFloat(cliente.deuda_actual);

    return {
      tiene_credito: true,
      limite_credito: parseFloat(cliente.limite_credito),
      deuda_actual: parseFloat(cliente.deuda_actual),
      limite_disponible: limiteDisponible,
      puede_facturar: deudaTotal <= parseFloat(cliente.limite_credito)
    };
  }
}

module.exports = Cliente;