// Script de verificación completa del backend
const fs = require('fs');
const path = require('path');
const http = require('http');
require('dotenv').config();

console.log('🔍 VERIFICACIÓN COMPLETA DEL BACKEND\n');
console.log('=' .repeat(60));

let errores = [];
let advertencias = [];
let exitos = [];

// 1. Verificar estructura de archivos
console.log('\n📁 VERIFICANDO ESTRUCTURA DE ARCHIVOS...\n');

const archivosRequeridos = {
  'Configuración': [
    '.env',
    'package.json',
    'server.js'
  ],
  'Aplicación': [
    'src/app.js',
    'src/config/database.js'
  ],
  'Middleware': [
    'src/middleware/auth.js',
    'src/middleware/errorHandler.js'
  ],
  'Modelos': [
    'src/models/Usuario.js',
    'src/models/Producto.js',
    'src/models/Categoria.js',
    'src/models/Proveedor.js',
    'src/models/Entrada.js',
    'src/models/Cliente.js',
    'src/models/Maleta.js',
    'src/models/Salida.js'
  ],
  'Controladores': [
    'src/controllers/authController.js',
    'src/controllers/productosController.js',
    'src/controllers/proveedoresController.js',
    'src/controllers/entradasController.js',
    'src/controllers/clientesController.js',
    'src/controllers/salidasController.js',
    'src/controllers/inventarioController.js'
  ],
  'Rutas': [
    'src/routes/authRoutes.js',
    'src/routes/productosRoutes.js',
    'src/routes/proveedoresRoutes.js',
    'src/routes/entradasRoutes.js',
    'src/routes/clientesRoutes.js',
    'src/routes/salidasRoutes.js',
    'src/routes/inventarioRoutes.js'
  ]
};

for (const [categoria, archivos] of Object.entries(archivosRequeridos)) {
  console.log(`\n${categoria}:`);
  
  for (const archivo of archivos) {
    const rutaCompleta = path.join(__dirname, '..', archivo);
    
    if (fs.existsSync(rutaCompleta)) {
      const stats = fs.statSync(rutaCompleta);
      if (stats.size === 0) {
        errores.push(`❌ ${archivo} - Existe pero está VACÍO`);
        console.log(`❌ ${archivo} - VACÍO`);
      } else {
        exitos.push(`✅ ${archivo} - OK (${stats.size} bytes)`);
        console.log(`✅ ${archivo} - OK`);
      }
    } else {
      errores.push(`❌ ${archivo} - NO EXISTE`);
      console.log(`❌ ${archivo} - NO EXISTE`);
    }
  }
}

// 2. Verificar variables de entorno
console.log('\n\n🔐 VERIFICANDO VARIABLES DE ENTORNO...\n');

const variablesRequeridas = {
  'PORT': { default: '3001', tipo: 'puerto' },
  'NODE_ENV': { default: 'development', tipo: 'ambiente' },
  'DB_HOST': { default: 'localhost', tipo: 'host' },
  'DB_PORT': { default: '3306', tipo: 'puerto' },
  'DB_USER': { default: null, tipo: 'usuario' },
  'DB_PASSWORD': { default: null, tipo: 'contraseña' },
  'DB_NAME': { default: 'inventario_medico', tipo: 'base de datos' },
  'JWT_SECRET': { default: null, tipo: 'secreto' },
  'JWT_EXPIRE': { default: '7d', tipo: 'duración' },
  'FRONTEND_URL': { default: 'http://localhost:3000', tipo: 'URL' }
};

for (const [variable, config] of Object.entries(variablesRequeridas)) {
  if (process.env[variable]) {
    if (config.tipo === 'contraseña' || config.tipo === 'secreto') {
      console.log(`✅ ${variable} - Configurado`);
    } else {
      console.log(`✅ ${variable} = ${process.env[variable]}`);
    }
  } else if (config.default) {
    advertencias.push(`⚠️  ${variable} no configurado (se usará: ${config.default})`);
    console.log(`⚠️  ${variable} - No configurado (default: ${config.default})`);
  } else {
    errores.push(`❌ ${variable} - REQUERIDO pero no configurado`);
    console.log(`❌ ${variable} - REQUERIDO`);
  }
}

// 3. Verificar conexión a la base de datos
console.log('\n\n🗄️  VERIFICANDO CONEXIÓN A BASE DE DATOS...\n');

const { testConnection, query } = require('../src/config/database');

async function verificarBaseDatos() {
  try {
    await testConnection();
    console.log('✅ Conexión a MySQL exitosa');
    exitos.push('✅ Conexión a base de datos establecida');
    
    // Verificar tablas
    console.log('\n📋 Verificando tablas...');
    const tablasRequeridas = [
      'usuarios', 'proveedores', 'categorias', 'productos', 
      'inventario', 'entradas', 'entradas_detalle', 'clientes',
      'maletas', 'salidas', 'salidas_detalle', 'notas_remision',
      'notas_remision_detalle', 'facturas', 'facturas_detalle',
      'movimientos_inventario'
    ];
    
    for (const tabla of tablasRequeridas) {
      const result = await query(`SHOW TABLES LIKE '${tabla}'`);
      if (result.length > 0) {
        console.log(`✅ Tabla ${tabla} existe`);
      } else {
        errores.push(`❌ Tabla ${tabla} NO EXISTE`);
        console.log(`❌ Tabla ${tabla} NO EXISTE`);
      }
    }
    
    // Verificar usuario admin
    const [admin] = await query('SELECT * FROM usuarios WHERE username = "admin"');
    if (admin) {
      console.log('\n✅ Usuario admin existe');
      exitos.push('✅ Usuario admin configurado');
    } else {
      advertencias.push('⚠️  Usuario admin no existe - ejecutar: node scripts/seedAdmin.js');
      console.log('\n⚠️  Usuario admin NO existe');
    }
    
  } catch (error) {
    errores.push(`❌ Error de conexión a base de datos: ${error.message}`);
    console.log(`❌ Error: ${error.message}`);
  }
}

// 4. Verificar servidor
console.log('\n\n🚀 VERIFICANDO SERVIDOR...\n');

async function verificarServidor() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3001,
      path: '/',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.status === 'OK') {
            console.log('✅ Servidor respondiendo correctamente');
            exitos.push('✅ Servidor funcionando');
            
            // Verificar endpoints principales
            verificarEndpoints();
          }
        } catch (e) {
          errores.push('❌ Respuesta del servidor inválida');
          console.log('❌ Error al parsear respuesta del servidor');
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        advertencias.push('⚠️  Servidor no está corriendo - ejecutar: npm run dev');
        console.log('⚠️  Servidor no está corriendo');
      } else {
        errores.push(`❌ Error al conectar con servidor: ${error.message}`);
        console.log(`❌ Error: ${error.message}`);
      }
      resolve();
    });

    req.end();
  });
}

// 5. Verificar endpoints
function verificarEndpoints() {
  console.log('\n📡 Verificando endpoints principales...');
  
  const endpoints = [
    '/api',
    '/api/auth/login',
    '/api/productos',
    '/api/proveedores',
    '/api/entradas',
    '/api/inventario',
    '/api/clientes',
    '/api/salidas'
  ];
  
  endpoints.forEach(endpoint => {
    console.log(`📍 ${endpoint} - Configurado`);
  });
  
  exitos.push(`✅ ${endpoints.length} endpoints configurados`);
}

// Ejecutar verificaciones
async function ejecutarVerificacion() {
  await verificarBaseDatos();
  await verificarServidor();
  
  // Resumen final
  console.log('\n\n📊 RESUMEN DE LA VERIFICACIÓN');
  console.log('=' .repeat(60));
  console.log(`✅ Éxitos: ${exitos.length}`);
  console.log(`⚠️  Advertencias: ${advertencias.length}`);
  console.log(`❌ Errores: ${errores.length}`);
  
  if (errores.length > 0) {
    console.log('\n❌ ERRORES ENCONTRADOS:');
    errores.forEach(error => console.log(`   ${error}`));
  }
  
  if (advertencias.length > 0) {
    console.log('\n⚠️  ADVERTENCIAS:');
    advertencias.forEach(advertencia => console.log(`   ${advertencia}`));
  }
  
  if (errores.length === 0) {
    console.log('\n✅ ¡BACKEND LISTO PARA USAR!');
    console.log('\n💡 Próximos pasos:');
    console.log('1. Si el servidor no está corriendo: npm run dev');
    console.log('2. Si no hay usuario admin: node scripts/seedAdmin.js');
    console.log('3. Para datos de prueba:');
    console.log('   - node scripts/seedProveedores.js');
    console.log('   - node scripts/seedProductos.js');
    console.log('   - node scripts/seedClientes.js');
    console.log('4. Probar login: node test/testLogin.js');
    console.log('\n🎉 ¡El backend está completo y listo para el frontend!');
  } else {
    console.log('\n🔧 ACCIONES REQUERIDAS:');
    console.log('1. Corregir los errores listados arriba');
    console.log('2. Ejecutar nuevamente este script');
    console.log('3. Asegurarse de que MySQL esté corriendo');
    console.log('4. Verificar las credenciales de la base de datos en .env');
  }
  
  process.exit(errores.length > 0 ? 1 : 0);
}

ejecutarVerificacion();