// Script para crear clientes de prueba
require('dotenv').config();
const { query, testConnection } = require('../src/config/database');

async function seedClientes() {
  try {
    await testConnection();
    console.log('🌱 Creando clientes de prueba...\n');

    const clientes = [
      // Hospitales principales
      {
        codigo: 'HOSP-DIAG',
        nombre: 'Hospital de Diagnóstico',
        tipo: 'hospital',
        nit: '0614-010203-001-2',
        nrc: '12345-6',
        direccion: 'Paseo General Escalón y 99 Av. Norte, San Salvador',
        telefono: '2506-2000',
        email: 'compras@hospitaldiagnostico.com',
        contacto: 'Licda. Carmen Mejía',
        credito_activo: true,
        limite_credito: 50000.00
      },
      {
        codigo: 'HOSP-ROSA',
        nombre: 'Hospital Rosales',
        tipo: 'hospital',
        nit: '0614-020304-002-3',
        nrc: '23456-7',
        direccion: '25 Av. Norte y Alameda Roosevelt, San Salvador',
        telefono: '2231-9200',
        email: 'suministros@hospitalrosales.gob.sv',
        contacto: 'Dr. Juan Hernández',
        credito_activo: true,
        limite_credito: 100000.00
      },
      {
        codigo: 'HOSP-BLOOM',
        nombre: 'Hospital Nacional de Niños Benjamín Bloom',
        tipo: 'hospital',
        nit: '0614-030405-003-4',
        nrc: '34567-8',
        direccion: '25 Avenida Norte y 23 Calle Poniente, San Salvador',
        telefono: '2225-4114',
        email: 'compras@hospitalbloom.gob.sv',
        contacto: 'Dra. María García',
        credito_activo: true,
        limite_credito: 75000.00
      },
      {
        codigo: 'HOSP-MEDICO',
        nombre: 'Hospital Médico Quirúrgico',
        tipo: 'hospital',
        nit: '0614-040506-004-5',
        nrc: '45678-9',
        direccion: 'Alameda Juan Pablo II, San Salvador',
        telefono: '2263-0066',
        email: 'administracion@hmq.com.sv',
        contacto: 'Lic. Roberto Pérez',
        credito_activo: true,
        limite_credito: 60000.00
      },
      
      // Clínicas
      {
        codigo: 'CLIN-SCANER',
        nombre: 'Centro de Diagnóstico y Cirugía Scanner',
        tipo: 'clinica',
        nit: '0614-050607-005-6',
        nrc: '56789-0',
        direccion: 'Col. Médica, San Salvador',
        telefono: '2263-4844',
        email: 'info@scanner.com.sv',
        contacto: 'Licda. Ana Martínez',
        credito_activo: true,
        limite_credito: 30000.00
      },
      {
        codigo: 'CLIN-PROFAM',
        nombre: 'Clínicas PROFAMILIA',
        tipo: 'clinica',
        nit: '0614-060708-006-7',
        nrc: '67890-1',
        direccion: 'Boulevard de Los Héroes, San Salvador',
        telefono: '2260-5959',
        email: 'suministros@profamilia.com.sv',
        contacto: 'Dr. Carlos López',
        credito_activo: true,
        limite_credito: 25000.00
      },
      {
        codigo: 'CLIN-PARRI',
        nombre: 'Hospital y Clínicas Parrilla',
        tipo: 'clinica',
        nit: '0614-070809-007-8',
        nrc: '78901-2',
        direccion: 'Col. Escalón, San Salvador',
        telefono: '2264-4422',
        email: 'compras@clinicasparrilla.com',
        contacto: 'Lic. Patricia Ventura',
        credito_activo: true,
        limite_credito: 40000.00
      },
      
      // Médicos independientes
      {
        codigo: 'MED-GARCIA',
        nombre: 'Dr. Fernando García - Cardiólogo',
        tipo: 'medico',
        nit: '0614-080910-008-9',
        direccion: 'Torre Médica San Francisco, Consultorio 305',
        telefono: '7850-1234',
        email: 'dr.garcia@gmail.com',
        contacto: 'Dr. Fernando García',
        credito_activo: false,
        limite_credito: 0
      },
      {
        codigo: 'MED-LOPEZ',
        nombre: 'Dra. Sandra López - Gastroenteróloga',
        tipo: 'medico',
        nit: '0614-091011-009-0',
        direccion: 'Centro Médico La Esperanza, Consultorio 201',
        telefono: '7950-5678',
        email: 'dra.lopez@outlook.com',
        contacto: 'Dra. Sandra López',
        credito_activo: true,
        limite_credito: 5000.00
      },
      
      // Otros
      {
        codigo: 'ONG-SALUD',
        nombre: 'Fundación Salud Para Todos',
        tipo: 'otro',
        nit: '0614-101112-010-1',
        direccion: 'Col. San Benito, San Salvador',
        telefono: '2248-9000',
        email: 'info@saludparatodos.org',
        contacto: 'Ing. Mario Ramírez',
        credito_activo: true,
        limite_credito: 20000.00
      },
      {
        codigo: 'LAB-CLINICO',
        nombre: 'Laboratorio Clínico Central',
        tipo: 'otro',
        nit: '0614-111213-011-2',
        nrc: '89012-3',
        direccion: 'Centro Comercial Basilea, Local 15',
        telefono: '2274-5555',
        email: 'info@labclinico.com.sv',
        contacto: 'Licda. Karla Mendoza',
        credito_activo: true,
        limite_credito: 15000.00
      }
    ];

    let clientesCreados = 0;
    let clientesActualizados = 0;

    for (const cliente of clientes) {
      try {
        // Intentar insertar o actualizar si ya existe
        const result = await query(
          `INSERT INTO clientes (
            codigo, nombre, tipo, nit, nrc, direccion, telefono, 
            email, contacto, credito_activo, limite_credito
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            tipo = VALUES(tipo),
            nit = VALUES(nit),
            nrc = VALUES(nrc),
            direccion = VALUES(direccion),
            telefono = VALUES(telefono),
            email = VALUES(email),
            contacto = VALUES(contacto),
            credito_activo = VALUES(credito_activo),
            limite_credito = VALUES(limite_credito)`,
          [
            cliente.codigo, cliente.nombre, cliente.tipo, cliente.nit || null,
            cliente.nrc || null, cliente.direccion || null, cliente.telefono || null,
            cliente.email || null, cliente.contacto || null, 
            cliente.credito_activo, cliente.limite_credito
          ]
        );

        if (result.insertId) {
          clientesCreados++;
          console.log(`✅ Cliente creado: ${cliente.codigo} - ${cliente.nombre}`);
        } else {
          clientesActualizados++;
          console.log(`ℹ️  Cliente actualizado: ${cliente.codigo}`);
        }
      } catch (error) {
        console.error(`❌ Error con cliente ${cliente.codigo}:`, error.message);
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`- Clientes creados: ${clientesCreados}`);
    console.log(`- Clientes actualizados: ${clientesActualizados}`);
    console.log('\n✅ Proceso completado!');

  } catch (error) {
    console.error('❌ Error general:', error.message);
  } finally {
    process.exit();
  }
}

// Ejecutar
seedClientes();