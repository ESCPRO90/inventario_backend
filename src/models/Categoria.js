const { query } = require('../config/database');

class Categoria {
  // Crear nueva categoría
  static async crear(datos) {
    const { nombre, descripcion = null } = datos;

    const sql = 'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)';
    
    try {
      const result = await query(sql, [nombre, descripcion]);
      return {
        id: result.insertId,
        nombre,
        descripcion
      };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('La categoría ya existe');
      }
      throw error;
    }
  }

  // Listar todas las categorías
  static async listar() {
    const sql = `
      SELECT 
        c.*,
        COUNT(DISTINCT p.id) as total_productos
      FROM categorias c
      LEFT JOIN productos p ON c.id = p.categoria_id AND p.activo = true
      WHERE c.activo = true
      GROUP BY c.id
      ORDER BY c.nombre
    `;
    
    return await query(sql);
  }

  // Buscar por ID
  static async buscarPorId(id) {
    const sql = 'SELECT * FROM categorias WHERE id = ? AND activo = true';
    const categorias = await query(sql, [id]);
    return categorias[0];
  }

  // Actualizar categoría
  static async actualizar(id, datos) {
    const { nombre, descripcion } = datos;
    
    const sql = 'UPDATE categorias SET nombre = ?, descripcion = ? WHERE id = ?';
    const result = await query(sql, [nombre, descripcion, id]);
    
    return result.affectedRows > 0;
  }

  // Desactivar categoría
  static async desactivar(id) {
    // Verificar si tiene productos asociados
    const sqlCheck = `
      SELECT COUNT(*) as total 
      FROM productos 
      WHERE categoria_id = ? AND activo = true
    `;
    
    const [{ total }] = await query(sqlCheck, [id]);
    
    if (total > 0) {
      throw new Error(`No se puede desactivar la categoría porque tiene ${total} productos asociados`);
    }

    const sql = 'UPDATE categorias SET activo = false WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Categoria;