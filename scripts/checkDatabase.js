// Script para verificar el estado de la base de datos
require('dotenv').config();
const { query, testConnection } = require('../src/config/database');

async function verificarBaseDatos() {
  console.log('🔍 Verificando base de datos...\n');
  
  try {
    // 1. Probar conexión
    await testConnection();
    
    // 2. Verificar si la tabla usuarios existe
    console.log('📋 Verificando tabla usuarios...');
    const tablas = await query('SHOW TABLES LIKE "usuarios"');
    
    if (tablas.length === 0) {
      console.log('❌ La tabla usuarios no existe!');
      console.log('👉 Ejecuta el script SQL para crear las tablas primero');
      process.exit(1);
    }
    
    console.log('✅ Tabla usuarios encontrada\n');
    
    // 3. Contar usuarios
    console.log('👥 Verificando usuarios existentes...');
    const [count] = await query('SELECT COUNT(*) as total FROM usuarios');
    console.log(`Total de usuarios: ${count.total}`);
    
    // 4. Listar usuarios
    if (count.total > 0) {
      const usuarios = await query('SELECT id, username, nombre_completo, email, rol, activo FROM usuarios');
      console.log('\nUsuarios en la base de datos:');
      console.table(usuarios);
    } else {
      console.log('⚠️  No hay usuarios en la base de datos');
      console.log('👉 Ejecuta: node scripts/seedAdmin.js');
    }
    
    // 5. Verificar si existe el usuario admin
    const [admin] = await query('SELECT username, activo FROM usuarios WHERE username = "admin"');
    if (admin) {
      console.log(`\n✅ Usuario admin existe (activo: ${admin.activo ? 'Sí' : 'No'})`);
      
      // Si quieres resetear la contraseña del admin
      console.log('\n💡 Para resetear la contraseña del admin, ejecuta:');
      console.log('   node scripts/resetAdminPassword.js');
    } else {
      console.log('\n❌ Usuario admin NO existe');
      console.log('👉 Ejecuta: node scripts/seedAdmin.js');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n❌ La base de datos "inventario_medico" no existe');
      console.log('👉 Crea la base de datos ejecutando el script SQL');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n❌ No se puede conectar a MySQL');
      console.log('👉 Verifica que MySQL esté corriendo');
    }
  } finally {
    process.exit();
  }
}

verificarBaseDatos();