const { validationResult } = require('express-validator');
const Usuario = require('../models/Usuario');
const { AuthenticationError, ValidationError, NotFoundError, BusinessLogicError } = require('../utils/customErrors');

// Registrar nuevo usuario
const registrar = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Pass express-validator errors to the central error handler
      // Option 1: Throw a custom ValidationError
      // throw new ValidationError('Errores de validación de entrada', errors.array());
      // Option 2: Let errorHandler handle the specific structure of express-validator errors
      return next(errors); // errorHandler can check for err.array
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
      return next(errors); // Let errorHandler handle express-validator errors
    }
    
    const { username, password } = req.body;
    
    // Buscar usuario
    const usuario = await Usuario.buscarPorUsername(username); // Model won't throw NotFoundError here by design for login
    
    if (!usuario) {
      return next(new AuthenticationError('Credenciales inválidas'));
    }
    
    // Verificar password
    const passwordValido = await Usuario.verificarPassword(password, usuario.password);
    
    if (!passwordValido) {
      return next(new AuthenticationError('Credenciales inválidas'));
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
      return next(errors);
    }
    
    const { nombre_completo, email } = req.body;
    const userId = req.usuario.id; // req.usuario is set by verificarToken
    
    // Usuario.actualizar will throw NotFoundError or other errors if update fails
    await Usuario.actualizar(userId, {
      nombre_completo,
      email
    });
    
    // Obtener usuario actualizado (buscarPorId throws NotFoundError if user somehow deleted)
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
      return next(errors);
    }
    
    const { password_actual, password_nuevo } = req.body;
    const userId = req.usuario.id;
    
    // Usuario.cambiarPassword will throw NotFoundError or BusinessLogicError
    await Usuario.cambiarPassword(userId, password_actual, password_nuevo);
    
    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    // Let errorHandler handle specific errors thrown by the model
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
      return next(errors);
    }
    
    // Usuario.crear will throw ValidationError or ConflictError
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
      return next(errors);
    }
    
    const { id } = req.params; // param id is validated by router
    
    // No permitir que un usuario se modifique a sí mismo desde aquí
    if (parseInt(id, 10) === req.usuario.id) {
      // Throwing a BusinessLogicError for the errorHandler to handle
      return next(new BusinessLogicError('No puedes modificarte a ti mismo desde esta ruta', 400));
    }
    
    // Usuario.actualizar will throw NotFoundError or other errors
    await Usuario.actualizar(id, req.body);
    
    const usuarioActualizado = await Usuario.buscarPorId(id); // buscarPorId throws NotFoundError
    
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
    const { id } = req.params; // param id is validated by router
    
    // No permitir que un admin se desactive a sí mismo
    if (parseInt(id, 10) === req.usuario.id) {
      return next(new BusinessLogicError('No puedes desactivarte a ti mismo', 400));
    }
    
    const desactivado = await Usuario.desactivar(id); // Model should throw NotFoundError if not found
    
    if (!desactivado) {
      // This case should ideally be handled by Usuario.desactivar throwing NotFoundError
      return next(new NotFoundError(`Usuario con ID ${id} no encontrado para desactivar.`));
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