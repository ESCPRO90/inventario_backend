// Script para crear categorías y productos de prueba
require('dotenv').config();
const { query, testConnection } = require('../src/config/database');

async function seedProductos() {
  try {
    await testConnection();
    console.log('🌱 Creando datos de prueba para productos...\n');

    // 1. Crear categorías
    console.log('📁 Creando categorías...');
    const categorias = [
      { nombre: 'Cardiovascular', descripcion: 'Productos para procedimientos cardiovasculares' },
      { nombre: 'Gastroenterología', descripcion: 'Productos para procedimientos gastroenterológicos' },
      { nombre: 'Urología', descripcion: 'Productos para procedimientos urológicos' },
      { nombre: 'Vascular Periférico', descripcion: 'Productos para procedimientos vasculares periféricos' },
      { nombre: 'Neurovascular', descripcion: 'Productos para procedimientos neurovasculares' }
    ];

    const categoriasIds = {};
    
    for (const cat of categorias) {
      try {
        const result = await query(
          'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?) ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion)',
          [cat.nombre, cat.descripcion]
        );
        
        if (result.insertId) {
          categoriasIds[cat.nombre] = result.insertId;
          console.log(`✅ Categoría creada: ${cat.nombre}`);
        } else {
          // Si ya existe, obtener su ID
          const [existing] = await query('SELECT id FROM categorias WHERE nombre = ?', [cat.nombre]);
          categoriasIds[cat.nombre] = existing.id;
          console.log(`ℹ️  Categoría actualizada: ${cat.nombre}`);
        }
      } catch (error) {
        console.error(`❌ Error con categoría ${cat.nombre}:`, error.message);
      }
    }

    // 2. Crear productos de ejemplo
    console.log('\n📦 Creando productos...');
    const productos = [
      // Cardiovascular
      {
        codigo: 'STENT-COR-001',
        referencia: 'BOS-SYNERGY-2.5X16',
        descripcion: 'Stent Coronario Liberador de Everolimus SYNERGY 2.5x16mm',
        categoria_id: categoriasIds['Cardiovascular'],
        unidad_medida: 'UNIDAD',
        precio_compra: 850.00,
        precio_venta: 1200.00,
        stock_minimo: 3,
        stock_maximo: 15
      },
      {
        codigo: 'BALON-COR-001',
        referencia: 'BOS-QUANTUM-2.0X15',
        descripcion: 'Balón de Angioplastia Coronaria QUANTUM APEX 2.0x15mm',
        categoria_id: categoriasIds['Cardiovascular'],
        unidad_medida: 'UNIDAD',
        precio_compra: 180.00,
        precio_venta: 280.00,
        stock_minimo: 5,
        stock_maximo: 20
      },
      {
        codigo: 'GUIA-COR-001',
        referencia: 'ABB-PILOT-50',
        descripcion: 'Guía Coronaria PILOT 50 0.014" x 190cm',
        categoria_id: categoriasIds['Cardiovascular'],
        unidad_medida: 'UNIDAD',
        precio_compra: 45.00,
        precio_venta: 75.00,
        stock_minimo: 10,
        stock_maximo: 50
      },
      
      // Gastroenterología
      {
        codigo: 'CLIP-ENDO-001',
        referencia: 'BOS-RESOLUTION-360',
        descripcion: 'Clip Hemostático Resolution 360 11mm',
        categoria_id: categoriasIds['Gastroenterología'],
        unidad_medida: 'UNIDAD',
        precio_compra: 120.00,
        precio_venta: 180.00,
        stock_minimo: 10,
        stock_maximo: 40
      },
      {
        codigo: 'ESFINTER-001',
        referencia: 'BOS-FUSION-10MM',
        descripcion: 'Esfinterótomo FUSION OMNITome 10mm',
        categoria_id: categoriasIds['Gastroenterología'],
        unidad_medida: 'UNIDAD',
        precio_compra: 95.00,
        precio_venta: 145.00,
        stock_minimo: 5,
        stock_maximo: 20
      },
      
      // Urología
      {
        codigo: 'CESTA-URO-001',
        referencia: 'BOS-ZEROTIP-1.9',
        descripcion: 'Cesta de Nitinol Zero Tip 1.9Fr x 115cm',
        categoria_id: categoriasIds['Urología'],
        unidad_medida: 'UNIDAD',
        precio_compra: 165.00,
        precio_venta: 250.00,
        stock_minimo: 5,
        stock_maximo: 20
      },
      {
        codigo: 'STENT-URE-001',
        referencia: 'BOS-PERCUFLEX-6FRX26',
        descripcion: 'Stent Ureteral PERCUFLEX Plus 6Fr x 26cm',
        categoria_id: categoriasIds['Urología'],
        unidad_medida: 'UNIDAD',
        precio_compra: 55.00,
        precio_venta: 85.00,
        stock_minimo: 10,
        stock_maximo: 30
      },
      
      // Vascular Periférico
      {
        codigo: 'STENT-PER-001',
        referencia: 'BOS-INNOVA-7X40',
        descripcion: 'Stent Vascular Periférico INNOVA 7x40mm',
        categoria_id: categoriasIds['Vascular Periférico'],
        unidad_medida: 'UNIDAD',
        precio_compra: 680.00,
        precio_venta: 950.00,
        stock_minimo: 2,
        stock_maximo: 10
      },
      {
        codigo: 'BALON-PER-001',
        referencia: 'BOS-MUSTANG-5X40',
        descripcion: 'Balón PTA MUSTANG 5x40mm',
        categoria_id: categoriasIds['Vascular Periférico'],
        unidad_medida: 'UNIDAD',
        precio_compra: 145.00,
        precio_venta: 220.00,
        stock_minimo: 5,
        stock_maximo: 20
      }
    ];

    let productosCreados = 0;
    let productosActualizados = 0;

    for (const prod of productos) {
      try {
        // Intentar insertar o actualizar si ya existe
        const result = await query(
          `INSERT INTO productos (
            codigo, referencia, descripcion, categoria_id, unidad_medida,
            precio_compra, precio_venta, requiere_lote, requiere_vencimiento,
            stock_minimo, stock_maximo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, true, true, ?, ?)
          ON DUPLICATE KEY UPDATE
            referencia = VALUES(referencia),
            descripcion = VALUES(descripcion),
            categoria_id = VALUES(categoria_id),
            precio_compra = VALUES(precio_compra),
            precio_venta = VALUES(precio_venta),
            stock_minimo = VALUES(stock_minimo),
            stock_maximo = VALUES(stock_maximo)`,
          [
            prod.codigo, prod.referencia, prod.descripcion, prod.categoria_id,
            prod.unidad_medida, prod.precio_compra, prod.precio_venta,
            prod.stock_minimo, prod.stock_maximo
          ]
        );

        if (result.insertId) {
          productosCreados++;
          console.log(`✅ Producto creado: ${prod.codigo} - ${prod.descripcion.substring(0, 50)}...`);
        } else {
          productosActualizados++;
          console.log(`ℹ️  Producto actualizado: ${prod.codigo}`);
        }
      } catch (error) {
        console.error(`❌ Error con producto ${prod.codigo}:`, error.message);
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`- Productos creados: ${productosCreados}`);
    console.log(`- Productos actualizados: ${productosActualizados}`);
    console.log('\n✅ Proceso completado!');

  } catch (error) {
    console.error('❌ Error general:', error.message);
  } finally {
    process.exit();
  }
}

// Ejecutar
seedProductos();