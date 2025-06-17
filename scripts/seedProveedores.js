// Script para crear proveedores de prueba
require('dotenv').config();
const { query, testConnection } = require('../src/config/database');

async function seedProveedores() {
  try {
    await testConnection();
    console.log('🌱 Creando proveedores de prueba...\n');

    const proveedores = [
      {
        codigo: 'BOSTON-SCI',
        nombre: 'Boston Scientific Corporation',
        nit: '04-2345678-9',
        direccion: 'Marlborough, Massachusetts, USA',
        telefono: '+1-508-683-4000',
        email: 'ventas.latam@bsci.com',
        contacto: 'María González'
      },
      {
        codigo: 'ABBOTT',
        nombre: 'Abbott Laboratories',
        nit: '04-3456789-0',
        direccion: 'Abbott Park, Illinois, USA',
        telefono: '+1-224-667-6100',
        email: 'contacto.centroamerica@abbott.com',
        contacto: 'Carlos Rodríguez'
      },
      {
        codigo: 'MEDTRONIC',
        nombre: 'Medtronic PLC',
        nit: '04-4567890-1',
        direccion: 'Dublin, Ireland',
        telefono: '+353-1-438-1700',
        email: 'ventas.ca@medtronic.com',
        contacto: 'Ana Martínez'
      },
      {
        codigo: 'COOK-MED',
        nombre: 'Cook Medical',
        nit: '04-5678901-2',
        direccion: 'Bloomington, Indiana, USA',
        telefono: '+1-812-339-2235',
        email: 'orders.latam@cookmedical.com',
        contacto: 'Luis Hernández'
      },
      {
        codigo: 'TERUMO',
        nombre: 'Terumo Corporation',
        nit: '04-6789012-3',
        direccion: 'Tokyo, Japan',
        telefono: '+81-3-3217-6500',
        email: 'ventas.centroamerica@terumo.com',
        contacto: 'Patricia López'
      },
      {
        codigo: 'BARD-BD',
        nombre: 'Becton Dickinson (BD/Bard)',
        nit: '04-7890123-4',
        direccion: 'Franklin Lakes, New Jersey, USA',
        telefono: '+1-201-847-6800',
        email: 'customerservice.ca@bd.com',
        contacto: 'Roberto Díaz'
      },
      {
        codigo: 'OLYMPUS',
        nombre: 'Olympus Medical Systems',
        nit: '04-8901234-5',
        direccion: 'Tokyo, Japan',
        telefono: '+81-3-3340-2111',
        email: 'sales-latam@olympus.com',
        contacto: 'Sandra Ramírez'
      },
      {
        codigo: 'STRYKER',
        nombre: 'Stryker Corporation',
        nit: '04-9012345-6',
        direccion: 'Kalamazoo, Michigan, USA',
        telefono: '+1-269-385-2600',
        email: 'latam.customerservice@stryker.com',
        contacto: 'Diego Morales'
      },
      {
        codigo: 'CARDINAL',
        nombre: 'Cardinal Health',
        nit: '04-0123456-7',
        direccion: 'Dublin, Ohio, USA',
        telefono: '+1-614-757-5000',
        email: 'ventas.centroamerica@cardinalhealth.com',
        contacto: 'Mónica Castro'
      },
      {
        codigo: 'LOCAL-DIST',
        nombre: 'Distribuidora Médica Local S.A. de C.V.',
        nit: '06-1234567-8',
        direccion: 'San Salvador, El Salvador',
        telefono: '2234-5678',
        email: 'ventas@distmedicalocal.com',
        contacto: 'Fernando Aguilar'
      }
    ];

    let proveedoresCreados = 0;
    let proveedoresActualizados = 0;

    for (const prov of proveedores) {
      try {
        // Intentar insertar o actualizar si ya existe
        const result = await query(
          `INSERT INTO proveedores (codigo, nombre, nit, direccion, telefono, email, contacto)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             nombre = VALUES(nombre),
             nit = VALUES(nit),
             direccion = VALUES(direccion),
             telefono = VALUES(telefono),
             email = VALUES(email),
             contacto = VALUES(contacto)`,
          [prov.codigo, prov.nombre, prov.nit, prov.direccion, prov.telefono, prov.email, prov.contacto]
        );

        if (result.insertId) {
          proveedoresCreados++;
          console.log(`✅ Proveedor creado: ${prov.codigo} - ${prov.nombre}`);
        } else {
          proveedoresActualizados++;
          console.log(`ℹ️  Proveedor actualizado: ${prov.codigo}`);
        }
      } catch (error) {
        console.error(`❌ Error con proveedor ${prov.codigo}:`, error.message);
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`- Proveedores creados: ${proveedoresCreados}`);
    console.log(`- Proveedores actualizados: ${proveedoresActualizados}`);
    console.log('\n✅ Proceso completado!');

  } catch (error) {
    console.error('❌ Error general:', error.message);
  } finally {
    process.exit();
  }
}

// Ejecutar
seedProveedores();