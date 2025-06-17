const { validationResult } = require('express-validator');
const Cliente = require('../models/Cliente');

// Listar clientes
const listarClientes = async (req, res, next) => {
  try {
    const {
      pagina = 1,
      limite = 20,
      buscar = '',
      tipo,
      credito_activo,
      orden = 'nombre',
      direccion = 'ASC'
    } = req.query;

    const opciones = {
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      buscar,
      tipo,
      credito_activo: credito_activo === 'true' ? true : credito_activo === 'false' ? false : null,
      orden,
      direccion: direccion.toUpperCase()
    };

    const resultado = await Cliente.listar(opciones);

    res.json({
      success: true,
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

// Obtener cliente por ID
const obtenerCliente = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const cliente = await Cliente.buscarPorId(id);
    
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // Obtener estado de cuenta si se solicita
    if (req.query.incluir_estado_cuenta === 'true') {
      cliente.estado_cuenta = await Cliente.obtenerEstadoCuenta(id);
    }

    res.json({
      success: true,
      data: { cliente }
    });
  } catch (error) {
    next(error);
  }
};

// Crear nuevo cliente
const crearCliente = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const nuevoCliente = await Cliente.crear(req.body);

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: { cliente: nuevoCliente }
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar cliente
const actualizarCliente = async (req, res, next) => {
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
    
    const actualizado = await Cliente.actualizar(id, req.body);
    
    if (!actualizado) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const clienteActualizado = await Cliente.buscarPorId(id);

    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: { cliente: clienteActualizado }
    });
  } catch (error) {
    next(error);
  }
};

// Desactivar cliente
const desactivarCliente = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await Cliente.desactivar(id);

    res.json({
      success: true,
      message: 'Cliente desactivado exitosamente'
    });
  } catch (error) {
    if (error.message.includes('salidas pendientes')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

// Buscar clientes (autocomplete)
const buscarClientes = async (req, res, next) => {
  try {
    const { q, limite = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: { clientes: [] }
      });
    }

    const clientes = await Cliente.buscarAutocomplete(q, parseInt(limite));

    res.json({
      success: true,
      data: { clientes }
    });
  } catch (error) {
    next(error);
  }
};

// Obtener estado de cuenta
const estadoCuenta = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el cliente existe
    const cliente = await Cliente.buscarPorId(id);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const estadoCuenta = await Cliente.obtenerEstadoCuenta(id);

    res.json({
      success: true,
      data: {
        cliente: {
          id: cliente.id,
          codigo: cliente.codigo,
          nombre: cliente.nombre,
          credito_activo: cliente.credito_activo,
          limite_credito: cliente.limite_credito
        },
        estado_cuenta: estadoCuenta
      }
    });
  } catch (error) {
    next(error);
  }
};

// Verificar crédito
const verificarCredito = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { monto = 0 } = req.query;
    
    // Verificar que el cliente existe
    const cliente = await Cliente.buscarPorId(id);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const estadoCredito = await Cliente.verificarLimiteCredito(id, parseFloat(monto));

    res.json({
      success: true,
      data: {
        cliente: {
          id: cliente.id,
          codigo: cliente.codigo,
          nombre: cliente.nombre
        },
        credito: estadoCredito
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarClientes,
  obtenerCliente,
  crearCliente,
  actualizarCliente,
  desactivarCliente,
  buscarClientes,
  estadoCuenta,
  verificarCredito
};