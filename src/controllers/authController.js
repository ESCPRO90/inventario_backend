const { validationResult } = require('express-validator');
const Usuario = require('../models/Usuario');

// Registrar nuevo usuario
const registrar = async (req, res, next) => {
  try {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }
    
    const { username, password, nombre_completo, email, rol } = req.body;
    
    // Crear usuario
    const nuevoUsuario = await Usuario.crear({
      username,
      password,
      nombre_completo,
      email,
      rol
    });
    
    // Generar token
    const token = Usuario.generarToken(nuevoUsuario);
    
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        usuario: nuevoUsuario,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login
const login = async (req, res, next) => {
  try {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }
    
    const { username, password } = req.body;
    
    // Buscar usuario
    const usuario = await Usuario.buscarPorUsername(username);
    
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }
    
    // Verificar password
    const passwordValido = await Usuario.verificarPassword(password, usuario.password);
    
    if (!passwordValido) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }
    
    // Actualizar último acceso
    await Usuario.actualizarUltimoAcceso(usuario.id);
    
    // Generar token
    const token = Usuario.generarToken(usuario);
    
    // Preparar datos del usuario (sin password)
    const { password: _, ...usuarioSinPassword } = usuario;
    
    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        usuario: usuarioSinPassword,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// Obtener perfil del usuario actual
const perfil = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        usuario: req.usuario
      }
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar perfil
const actualizarPerfil = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }
    
    const { nombre_completo, email } = req.body;
    const userId = req.usuario.id;
    
    // Actualizar usuario
    const actualizado = await Usuario.actualizar(userId, {
      nombre_completo,
      email
    });
    
    if (!actualizado) {
      return res.status(400).json({
        success: false,
        message: 'No se pudo actualizar el perfil'
      });
    }
    
    // Obtener usuario actualizado
    const usuarioActualizado = await Usuario.buscarPorId(userId);
    
    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: {
        usuario: usuarioActualizado
      }
    });
  } catch (error) {
    next(error);
  }
};

// Cambiar contraseña
const cambiarPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }
    
    const { password_actual, password_nuevo } = req.body;
    const userId = req.usuario.id;
    
    await Usuario.cambiarPassword(userId, password_actual, password_nuevo);
    
    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    if (error.message === 'La contraseña actual es incorrecta') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

// Listar usuarios (solo admin)
const listarUsuarios = async (req, res, next) => {
  try {
    const usuarios = await Usuario.listarTodos();
    
    res.json({
      success: true,
      data: {
        usuarios,
        total: usuarios.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Crear usuario (solo admin)
const crearUsuario = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }
    
    const nuevoUsuario = await Usuario.crear(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: {
        usuario: nuevoUsuario
      }
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar usuario (solo admin)
const actualizarUsuario = async (req, res, next) => {
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
    
    // No permitir que un usuario se modifique a sí mismo desde aquí
    if (parseInt(id) === req.usuario.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes modificarte a ti mismo desde esta ruta'
      });
    }
    
    const actualizado = await Usuario.actualizar(id, req.body);
    
    if (!actualizado) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    const usuarioActualizado = await Usuario.buscarPorId(id);
    
    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: {
        usuario: usuarioActualizado
      }
    });
  } catch (error) {
    next(error);
  }
};

// Desactivar usuario (solo admin)
const desactivarUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // No permitir que un admin se desactive a sí mismo
    if (parseInt(id) === req.usuario.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes desactivarte a ti mismo'
      });
    }
    
    const desactivado = await Usuario.desactivar(id);
    
    if (!desactivado) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Usuario desactivado exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Logout (opcional - principalmente para invalidar token en el frontend)
const logout = async (req, res, next) => {
  try {
    // En una implementación más compleja, aquí podrías:
    // - Agregar el token a una lista negra
    // - Registrar el logout en una tabla de auditoría
    // - Limpiar sesiones activas
    
    res.json({
      success: true,
      message: 'Logout exitoso'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registrar,
  login,
  perfil,
  actualizarPerfil,
  cambiarPassword,
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
  logout
};