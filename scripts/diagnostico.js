// Script de diagnóstico para encontrar problemas
const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnóstico del sistema\n');

// 1. Verificar archivos principales
const archivosRequeridos = [
  'server.js',
  'src/app.js',
  'src/config/database.js',
  '.env',
  'src/middleware/errorHandler.js',
  'src/middleware/auth.js'
];

console.log('📁 Verificando archivos principales:');
let archivosFaltantes = false;

archivosRequeridos.forEach(archivo => {
  const rutaCompleta = path.join(__dirname, '..', archivo);
  if (fs.existsSync(rutaCompleta)) {
    const stats = fs.statSync(rutaCompleta);
    if (stats.size === 0) {
      console.log(`❌ ${archivo} - Existe pero está VACÍO`);
      archivosFaltantes = true;
    } else {
      console.log(`✅ ${archivo} - OK (${stats.size} bytes)`);
    }
  } else {
    console.log(`❌ ${archivo} - NO EXISTE`);
    archivosFaltantes = true;
  }
});

// 2. Verificar modelos
console.log('\n📦 Verificando modelos:');
const modelos = ['Usuario', 'Producto', 'Categoria', 'Proveedor', 'Entrada'];

modelos.forEach(modelo => {
  const rutaModelo = path.join(__dirname, '..', 'src', 'models', `${modelo}.js`);
  if (fs.existsSync(rutaModelo)) {
    const stats = fs.statSync(rutaModelo);
    if (stats.size === 0) {
      console.log(`❌ ${modelo}.js - Existe pero está VACÍO`);
      archivosFaltantes = true;
    } else {
      console.log(`✅ ${modelo}.js - OK (${stats.size} bytes)`);
    }
  } else {
    console.log(`❌ ${modelo}.js - NO EXISTE`);
    archivosFaltantes = true;
  }
});

// 3. Verificar variables de entorno
console.log('\n🔐 Verificando variables de entorno:');
if (fs.existsSync(path.join(__dirname, '..', '.env'))) {
  require('dotenv').config();
  const variablesRequeridas = [
    'PORT', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 
    'DB_NAME', 'JWT_SECRET'
  ];
  
  variablesRequeridas.forEach(variable => {
    if (process.env[variable]) {
      if (variable.includes('PASSWORD') || variable.includes('SECRET')) {
        console.log(`✅ ${variable} - Configurado`);
      } else {
        console.log(`✅ ${variable} - ${process.env[variable]}`);
      }
    } else {
      console.log(`❌ ${variable} - NO CONFIGURADO`);
    }
  });
} else {
  console.log('❌ Archivo .env no encontrado');
}

// 4. Intentar cargar módulos
console.log('\n🧪 Probando carga de módulos:');
try {
  require('../src/app');
  console.log('✅ app.js se carga correctamente');
} catch (error) {
  console.log('❌ Error al cargar app.js:', error.message);
  console.log('   Ubicación:', error.stack.split('\n')[1]);
}

// 5. Probar conexión a base de datos
console.log('\n🗄️ Probando conexión a base de datos:');
try {
  const { testConnection } = require('../src/config/database');
  testConnection().then(() => {
    console.log('✅ Conexión a MySQL exitosa');
  }).catch(error => {
    console.log('❌ Error de conexión a MySQL:', error.message);
  });
} catch (error) {
  console.log('❌ Error al cargar módulo de base de datos:', error.message);
}

// Resumen
if (archivosFaltantes) {
  console.log('\n⚠️  Hay archivos faltantes o vacíos. Revisa los errores arriba.');
} else {
  console.log('\n✅ Todos los archivos requeridos existen.');
}

console.log('\n💡 Si el problema persiste, ejecuta: node server.js');
console.log('   para ver el error completo.');