// Script para resetear la contraseña del admin
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, testConnection } = require('../src/config/database');

async function resetearPasswordAdmin() {
  try {
    await testConnection();
    
    console.log('🔧 Reseteando contraseña del admin...\n');
    
    // Nueva contraseña
    const nuevaPassword = 'admin123';
    
    // Hashear password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(nuevaPassword, salt);
    
    // Actualizar en la base de datos
    const result = await query(
      'UPDATE usuarios SET password = ?, activo = true WHERE username = ?',
      [hashedPassword, 'admin']
    );
    
    if (result.affectedRows > 0) {
      console.log('✅ Contraseña reseteada exitosamente');
      console.log('📧 Username: admin');
      console.log('🔑 Password: admin123');
    } else {
      console.log('❌ Usuario admin no encontrado');
      console.log('👉 Ejecuta primero: node scripts/seedAdmin.js');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit();
  }
}

resetearPasswordAdmin();