// Script para crear el usuario administrador inicial
require('dotenv').config();
const Usuario = require('../src/models/Usuario');
const { testConnection } = require('../src/config/database');

async function crearAdminInicial() {
  try {
    // Probar conexión
    await testConnection();
    
    console.log('🔧 Creando usuario administrador inicial...');
    
    // Datos del admin
    const adminData = {
      username: 'admin',
      password: 'admin123', // CAMBIAR EN PRODUCCIÓN
      nombre_completo: 'Administrador del Sistema',
      email: 'admin@inventario.com',
      rol: 'admin'
    };
    
    // Verificar si ya existe
    const existente = await Usuario.buscarPorUsername('admin');
    
    if (existente) {
      console.log('⚠️  El usuario admin ya existe');
      process.exit(0);
    }
    
    // Crear admin
    const admin = await Usuario.crear(adminData);
    
    console.log('✅ Usuario administrador creado exitosamente');
    console.log('📧 Username:', adminData.username);
    console.log('🔑 Password:', adminData.password);
    console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer login');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear admin:', error.message);
    process.exit(1);
  }
}

// Ejecutar
crearAdminInicial();