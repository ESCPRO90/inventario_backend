const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { ValidationError, ConflictError, NotFoundError, BusinessLogicError } = require('../utils/customErrors');

class Usuario {
  // Crear nuevo usuario
  static async crear(datosUsuario) {
    const { username, password, nombre_completo, email, rol = 'bodeguero' } = datosUsuario;
    const errors = [];

    // Validación básica inicial
    if (!username || username.trim().length < 3) {
      errors.push({ field: 'username', message: 'El nombre de usuario es requerido y debe tener al menos 3 caracteres.' });
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) { // Regex simple para formato de email
      errors.push({ field: 'email', message: 'El email es requerido y debe tener un formato válido.' });
    }
    if (!password || password.length < 6) {
      errors.push({ field: 'password', message: 'La contraseña es requerida y debe tener al menos 6 caracteres.' });
    }

    if (errors.length > 0) {
      throw new ValidationError('Errores de validación al crear usuario', errors);
    }
    // Fin de validación básica

    // Hashear password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const sql = `
      INSERT INTO usuarios (username, password, nombre_completo, email, rol)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    try {
      const result = await query(sql, [username, hashedPassword, nombre_completo, email, rol]);
      return {
        id: result.insertId,
        username,
        nombre_completo,
        email,
        rol
      };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.message.includes('username_UNIQUE') || error.message.includes('username')) { // Adapt to actual constraint name
          throw new ConflictError('El nombre de usuario ya existe.');
        }
        if (error.message.includes('email_UNIQUE') || error.message.includes('email')) { // Adapt to actual constraint name
          throw new ConflictError('El email ya está registrado.');
        }
      }
      throw error; // Re-throw other DB errors to be caught by errorHandler
    }
  }
  
  // Buscar usuario por username
  static async buscarPorUsername(username) {
    const sql = 'SELECT * FROM usuarios WHERE username = ? AND activo = true';
    const [usuario] = await query(sql, [username]);
    if (!usuario) {
      // No throwing NotFoundError here as it's often used to check existence for login
      // Controller will handle "invalid credentials"
    }
    return usuario;
  }
  
  // Buscar usuario por ID
  static async buscarPorId(id) {
    const sql = 'SELECT id, username, nombre_completo, email, rol, activo FROM usuarios WHERE id = ?'; // Include activo
    const [usuario] = await query(sql, [id]);
    if (!usuario) {
      throw new NotFoundError(`Usuario con ID ${id} no encontrado.`);
    }
    // Optionally, if you want to ensure only active users are "found" by default by this method:
    // if (!usuario.activo) {
    //   throw new NotFoundError(`Usuario con ID ${id} no encontrado o está inactivo.`);
    // }
    return usuario;
  }
  
  // Verificar password
  static async verificarPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }
  
  // Generar JWT
  static generarToken(usuario) {
    const payload = {
      id: usuario.id,
      username: usuario.username,
      rol: usuario.rol
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });
  }
  
  // Actualizar último acceso
  static async actualizarUltimoAcceso(id) {
    const sql = 'UPDATE usuarios SET updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    await query(sql, [id]);
  }
  
  // Listar todos los usuarios (para admin)
  static async listarTodos() {
    const sql = `
      SELECT id, username, nombre_completo, email, rol, activo, created_at, updated_at 
      FROM usuarios 
      ORDER BY created_at DESC
    `;
    return await query(sql);
  }
  
  // Actualizar usuario
  static async actualizar(id, datos) {
    // Basic validation for updatable fields (can be expanded)
    const { nombre_completo, email, rol, activo } = datos;
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      throw new ValidationError('Formato de email inválido.');
    }

    const campos = [];
    const valores = [];
    
    // Construir query dinámicamente
    Object.keys(datos).forEach(campo => {
      if (['nombre_completo', 'email', 'rol', 'activo'].includes(campo) && datos[campo] !== undefined) {
        campos.push(`${campo} = ?`);
        valores.push(datos[campo]);
      }
    });
    
    if (campos.length === 0) {
      throw new BusinessLogicError('No hay campos válidos para actualizar.', 400);
    }
    
    valores.push(id);
    const sql = `UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`;
    
    try {
      const result = await query(sql, valores);
      if (result.affectedRows === 0) {
        throw new NotFoundError(`Usuario con ID ${id} no encontrado para actualizar.`);
      }
      return true;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' && error.message.includes('email')) {
        throw new ConflictError('El email ya está registrado por otro usuario.');
      }
      throw error;
    }
  }
  
  // Cambiar password
  static async cambiarPassword(id, passwordActual, passwordNuevo) {
    const usuario = await this.buscarPorId(id); // buscarPorId will throw NotFoundError if not found
    if (!usuario.activo) {
      throw new BusinessLogicError('Usuario inactivo, no se puede cambiar la contraseña.', 400);
    }

    // We need the hashed password for comparison, buscarPorId doesn't return it.
    const [usuarioConPassword] = await query('SELECT password FROM usuarios WHERE id = ?', [id]);
    if (!usuarioConPassword) { // Should not happen if buscarPorId succeeded, but as a safeguard
        throw new NotFoundError('Usuario no encontrado.');
    }

    const passwordValido = await this.verificarPassword(passwordActual, usuarioConPassword.password);
    
    if (!passwordValido) {
      throw new BusinessLogicError('La contraseña actual es incorrecta.', 400);
    }

    if (!passwordNuevo || passwordNuevo.length < 6) {
        throw new ValidationError('La nueva contraseña debe tener al menos 6 caracteres.');
    }
    
    // Hashear nuevo password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordNuevo, salt);
    
    const sql = 'UPDATE usuarios SET password = ? WHERE id = ?';
    await query(sql, [hashedPassword, id]);
    
    return true;
  }
  
  // Desactivar usuario (soft delete)
  static async desactivar(id) {
    const sql = 'UPDATE usuarios SET activo = false WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Usuario;