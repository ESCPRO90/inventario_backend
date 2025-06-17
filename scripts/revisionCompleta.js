// Script de revisión completa del proyecto
const fs = require('fs');
const path = require('path');

console.log('🔍 REVISIÓN COMPLETA DEL PROYECTO INVENTARIO\n');
console.log('=' .repeat(50));

// Estructura esperada del proyecto
const estructuraProyecto = {
  'Archivos Raíz': {
    archivos: ['server.js', 'package.json', '.env', '.gitignore'],
    opcional: ['.env']
  },
  'src': {
    archivos: ['app.js'],
    opcional: []
  },
  'src/config': {
    archivos: ['database.js'],
    opcional: []
  },
  'src/middleware': {
    archivos: ['auth.js', 'errorHandler.js'],
    opcional: []
  },
  'src/models': {
    archivos: ['Usuario.js', 'Producto.js', 'Categoria.js', 'Proveedor.js', 'Entrada.js'],
    opcional: []
  },
  'src/controllers': {
    archivos: ['authController.js', 'productosController.js', 'proveedoresController.js', 'entradasController.js'],
    opcional: []
  },
  'src/routes': {
    archivos: ['authRoutes.js', 'productosRoutes.js', 'proveedoresRoutes.js', 'entradasRoutes.js'],
    opcional: []
  },
  'scripts': {
    archivos: ['seedAdmin.js', 'seedProductos.js', 'seedProveedores.js'],
    opcional: ['seedAdmin.js', 'seedProductos.js', 'seedProveedores.js']
  },
  'test': {
    archivos: [],
    opcional: []
  }
};

let erroresEncontrados = [];
let advertencias = [];
let archivosRevisados = 0;
let archivosOK = 0;

// Función para verificar archivo
function verificarArchivo(rutaRelativa, esOpcional = false) {
  const rutaCompleta = path.join(__dirname, '..', rutaRelativa);
  archivosRevisados++;
  
  if (!fs.existsSync(rutaCompleta)) {
    if (esOpcional) {
      advertencias.push(`⚠️  ${rutaRelativa} - No existe (opcional)`);
    } else {
      erroresEncontrados.push(`❌ ${rutaRelativa} - NO EXISTE`);
    }
    return false;
  }
  
  const stats = fs.statSync(rutaCompleta);
  if (stats.size === 0) {
    erroresEncontrados.push(`❌ ${rutaRelativa} - ARCHIVO VACÍO`);
    return false;
  }
  
  // Verificación básica de sintaxis
  if (rutaRelativa.endsWith('.js')) {
    try {
      const contenido = fs.readFileSync(rutaCompleta, 'utf8');
      
      // Verificaciones específicas
      if (rutaRelativa.includes('models/') && !rutaRelativa.includes('index')) {
        if (!contenido.includes('module.exports')) {
          erroresEncontrados.push(`❌ ${rutaRelativa} - Falta module.exports`);
          return false;
        }
        if (!contenido.includes('class')) {
          advertencias.push(`⚠️  ${rutaRelativa} - No define una clase`);
        }
      }
      
      if (rutaRelativa.includes('routes/')) {
        if (!contenido.includes('router')) {
          erroresEncontrados.push(`❌ ${rutaRelativa} - No define router`);
          return false;
        }
        if (!contenido.includes('module.exports')) {
          erroresEncontrados.push(`❌ ${rutaRelativa} - Falta module.exports`);
          return false;
        }
      }
      
      if (rutaRelativa.includes('controllers/')) {
        if (!contenido.includes('module.exports')) {
          erroresEncontrados.push(`❌ ${rutaRelativa} - Falta module.exports`);
          return false;
        }
      }
      
    } catch (error) {
      erroresEncontrados.push(`❌ ${rutaRelativa} - Error al leer: ${error.message}`);
      return false;
    }
  }
  
  console.log(`✅ ${rutaRelativa} - OK (${stats.size} bytes)`);
  archivosOK++;
  return true;
}

// Revisar estructura
console.log('📁 ESTRUCTURA DE ARCHIVOS\n');

for (const [carpeta, config] of Object.entries(estructuraProyecto)) {
  console.log(`\n📂 ${carpeta}:`);
  
  config.archivos.forEach(archivo => {
    const rutaRelativa = carpeta === 'Archivos Raíz' 
      ? archivo 
      : path.join(carpeta, archivo);
    
    const esOpcional = config.opcional.includes(archivo);
    verificarArchivo(rutaRelativa, esOpcional);
  });
}

// Verificar package.json
console.log('\n\n📦 VERIFICANDO DEPENDENCIAS\n');
try {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );
  
  const dependenciasRequeridas = [
    'express', 'mysql2', 'dotenv', 'cors', 'bcryptjs', 
    'jsonwebtoken', 'express-validator', 'helmet', 'morgan', 'compression'
  ];
  
  console.log('Dependencias principales:');
  dependenciasRequeridas.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep} - ${packageJson.dependencies[dep]}`);
    } else {
      erroresEncontrados.push(`❌ Falta dependencia: ${dep}`);
      console.log(`❌ ${dep} - NO INSTALADO`);
    }
  });
  
  console.log('\nDependencias de desarrollo:');
  if (packageJson.devDependencies?.nodemon) {
    console.log(`✅ nodemon - ${packageJson.devDependencies.nodemon}`);
  } else {
    advertencias.push(`⚠️  nodemon no está instalado (recomendado para desarrollo)`);
    console.log(`⚠️  nodemon - NO INSTALADO`);
  }
  
} catch (error) {
  erroresEncontrados.push('❌ Error al leer package.json');
}

// Verificar .env
console.log('\n\n🔐 VERIFICANDO VARIABLES DE ENTORNO\n');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  
  const variablesRequeridas = {
    'PORT': '3001',
    'NODE_ENV': 'development',
    'DB_HOST': 'localhost',
    'DB_PORT': '3306',
    'DB_USER': null,
    'DB_PASSWORD': null,
    'DB_NAME': 'inventario_medico',
    'JWT_SECRET': null,
    'JWT_EXPIRE': '7d',
    'FRONTEND_URL': 'http://localhost:3000'
  };
  
  for (const [variable, valorDefault] of Object.entries(variablesRequeridas)) {
    if (process.env[variable]) {
      if (variable.includes('PASSWORD') || variable.includes('SECRET')) {
        console.log(`✅ ${variable} - ****** (configurado)`);
      } else {
        console.log(`✅ ${variable} = ${process.env[variable]}`);
      }
    } else {
      if (valorDefault) {
        advertencias.push(`⚠️  ${variable} no configurado (se usará: ${valorDefault})`);
        console.log(`⚠️  ${variable} - No configurado (default: ${valorDefault})`);
      } else {
        erroresEncontrados.push(`❌ ${variable} - REQUERIDO pero no configurado`);
        console.log(`❌ ${variable} - NO CONFIGURADO (requerido)`);
      }
    }
  }
} else {
  console.log('❌ Archivo .env NO EXISTE');
  console.log('\n📝 Crea un archivo .env con el siguiente contenido:\n');
  console.log(`PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=inventario_medico
JWT_SECRET=tu_clave_secreta_super_segura
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000`);
}

// Intentar importar módulos principales
console.log('\n\n🧪 VERIFICANDO IMPORTS\n');

const modulosParaProbar = [
  { nombre: 'app.js', ruta: '../src/app' },
  { nombre: 'database.js', ruta: '../src/config/database' },
  { nombre: 'auth middleware', ruta: '../src/middleware/auth' },
  { nombre: 'error handler', ruta: '../src/middleware/errorHandler' }
];

for (const modulo of modulosParaProbar) {
  try {
    require(modulo.ruta);
    console.log(`✅ ${modulo.nombre} - Se importa correctamente`);
  } catch (error) {
    erroresEncontrados.push(`❌ Error al importar ${modulo.nombre}: ${error.message}`);
    console.log(`❌ ${modulo.nombre} - Error: ${error.message}`);
  }
}

// Resumen final
console.log('\n\n📊 RESUMEN DE LA REVISIÓN');
console.log('=' .repeat(50));
console.log(`Total de archivos revisados: ${archivosRevisados}`);
console.log(`Archivos OK: ${archivosOK}`);
console.log(`Errores encontrados: ${erroresEncontrados.length}`);
console.log(`Advertencias: ${advertencias.length}`);

if (erroresEncontrados.length > 0) {
  console.log('\n❌ ERRORES CRÍTICOS:');
  erroresEncontrados.forEach(error => console.log(`   ${error}`));
}

if (advertencias.length > 0) {
  console.log('\n⚠️  ADVERTENCIAS:');
  advertencias.forEach(advertencia => console.log(`   ${advertencia}`));
}

if (erroresEncontrados.length === 0) {
  console.log('\n✅ ¡No se encontraron errores críticos!');
  console.log('   El proyecto debería funcionar correctamente.');
} else {
  console.log('\n🔧 ACCIONES RECOMENDADAS:');
  console.log('1. Corrige los errores críticos listados arriba');
  console.log('2. Verifica que todos los archivos tengan contenido');
  console.log('3. Ejecuta: npm install');
  console.log('4. Crea/actualiza el archivo .env');
  console.log('5. Ejecuta: node server.js para ver errores específicos');
}

console.log('\n💡 Para probar el servidor después de corregir:');
console.log('   npm run dev');