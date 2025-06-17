const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

class Usuario {
  // Crear nuevo usuario
  static async crear(datosUsuario) {
    const { username, password, nombre_completo, email, rol = 'bodeguero' } = datosUsuario;
    
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
        if (error.message.includes('username')) {
          throw new Error('El nombre de usuario ya existe');
        }
        if (error.message.includes('email')) {
          throw new Error('El email ya está registrado');
        }
      }
      throw error;
    }
  }
  
  // Buscar usuario por username
  static async buscarPorUsername(username) {
    const sql = 'SELECT * FROM usuarios WHERE username = ? AND activo = true';
    const usuarios = await query(sql, [username]);
    return usuarios[0];
  }
  
  // Buscar usuario por ID
  static async buscarPorId(id) {
    const sql = 'SELECT id, username, nombre_completo, email, rol FROM usuarios WHERE id = ? AND activo = true';
    const usuarios = await query(sql, [id]);
    return usuarios[0];
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
    const campos = [];
    const valores = [];
    
    // Construir query dinámicamente
    Object.keys(datos).forEach(campo => {
      if (['nombre_completo', 'email', 'rol', 'activo'].includes(campo)) {
        campos.push(`${campo} = ?`);
        valores.push(datos[campo]);
      }
    });
    
    if (campos.length === 0) {
      throw new Error('No hay campos válidos para actualizar');
    }
    
    valores.push(id);
    const sql = `UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`;
    
    const result = await query(sql, valores);
    return result.affectedRows > 0;
  }
  
  // Cambiar password
  static async cambiarPassword(id, passwordActual, passwordNuevo) {
    // Verificar password actual
    const usuario = await this.buscarPorId(id);
    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }
    
    const usuarioCompleto = await query('SELECT password FROM usuarios WHERE id = ?', [id]);
    const passwordValido = await this.verificarPassword(passwordActual, usuarioCompleto[0].password);
    
    if (!passwordValido) {
      throw new Error('La contraseña actual es incorrecta');
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