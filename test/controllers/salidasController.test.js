const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/database');
const Usuario = require('../../src/models/Usuario');

let adminToken; // For admin/bodeguero operations
let facturadorToken; // For facturador specific operations if any

let testCategoriaId;
let testProveedorId;
let testProductoId1;
let testProductoId2;
let testInventarioId1; // Lot for testProductoId1
let testInventarioId2; // Lot for testProductoId2
let testClienteId;
let testSalidaId; // To store ID of a created salida for later tests

const initialStockP1 = 50;
const initialStockP2 = 30;

const adminSalidaCredentials = { username: 'admin_salida_test', password: 'password123', nombre_completo: 'Admin Salida Test', email: 'adminsalidatest@example.com', rol: 'admin' };
const facturadorSalidaCredentials = { username: 'fact_salida_test', password: 'password123', nombre_completo: 'Fact Salida Test', email: 'factsalidatest@example.com', rol: 'facturador' };


async function seedInitialData() {
    // Clean up potential previous test data (order matters for FK constraints)
    await pool.query("DELETE FROM movimientos_inventario WHERE salida_detalle_id IN (SELECT id FROM salidas_detalle WHERE salida_id IN (SELECT id FROM salidas WHERE cliente_id IN (SELECT id FROM clientes WHERE codigo LIKE 'TESTCLIENTE%')))");
    await pool.query("DELETE FROM salidas_detalle WHERE salida_id IN (SELECT id FROM salidas WHERE cliente_id IN (SELECT id FROM clientes WHERE codigo LIKE 'TESTCLIENTE%'))");
    await pool.query("DELETE FROM salidas WHERE cliente_id IN (SELECT id FROM clientes WHERE codigo LIKE 'TESTCLIENTE%')");
    await pool.query("DELETE FROM inventario WHERE producto_id IN (SELECT id FROM productos WHERE codigo LIKE 'TESTPROD_SAL%')");
    await pool.query("DELETE FROM productos WHERE codigo LIKE 'TESTPROD_SAL%'");
    await pool.query("DELETE FROM categorias WHERE nombre LIKE 'Test Cat Salida%'");
    await pool.query("DELETE FROM proveedores WHERE codigo LIKE 'TESTPROV_SAL%'");
    await pool.query("DELETE FROM clientes WHERE codigo LIKE 'TESTCLIENTE%'");
    await pool.query("DELETE FROM usuarios WHERE username IN (?, ?)", [adminSalidaCredentials.username, facturadorSalidaCredentials.username]);

    // Create users and get tokens
    await Usuario.crear(adminSalidaCredentials);
    let loginRes = await request(app).post('/api/auth/login').send({ username: adminSalidaCredentials.username, password: adminSalidaCredentials.password });
    adminToken = loginRes.body.data.token;

    await Usuario.crear(facturadorSalidaCredentials);
    loginRes = await request(app).post('/api/auth/login').send({ username: facturadorSalidaCredentials.username, password: facturadorSalidaCredentials.password });
    facturadorToken = loginRes.body.data.token;

    // Seed common data
    const [catResult] = await pool.query("INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)", ['Test Cat Salida', 'Test Category for Salidas']);
    testCategoriaId = catResult.insertId;

    const [provResult] = await pool.query("INSERT INTO proveedores (codigo, nombre) VALUES (?, ?)", ['TESTPROV_SAL', 'Test Proveedor Salida']);
    testProveedorId = provResult.insertId;

    const [prodResult1] = await pool.query(
      "INSERT INTO productos (codigo, descripcion, categoria_id, precio_venta, unidad_medida, activo) VALUES (?, ?, ?, ?, 'UNIDAD', true)",
      ['TESTPROD_SAL1', 'Test Producto Salida 1', testCategoriaId, 100.00]
    );
    testProductoId1 = prodResult1.insertId;

    const [prodResult2] = await pool.query(
      "INSERT INTO productos (codigo, descripcion, categoria_id, precio_venta, unidad_medida, activo) VALUES (?, ?, ?, ?, 'UNIDAD', true)",
      ['TESTPROD_SAL2', 'Test Producto Salida 2', testCategoriaId, 200.00]
    );
    testProductoId2 = prodResult2.insertId;

    const [cliResult] = await pool.query("INSERT INTO clientes (codigo, nombre, tipo) VALUES (?, ?, ?)", ['TESTCLIENTE01', 'Test Cliente Salida', 'hospital']);
    testClienteId = cliResult.insertId;

    // Seed inventory (lots)
    const [invResult1] = await pool.query(
      "INSERT INTO inventario (producto_id, proveedor_id, lote, fecha_vencimiento, cantidad_inicial, cantidad_actual, precio_compra_unitario, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [testProductoId1, testProveedorId, 'LOTESAL001', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), initialStockP1, initialStockP1, 80.00, 'disponible']
    );
    testInventarioId1 = invResult1.insertId;

    const [invResult2] = await pool.query(
      "INSERT INTO inventario (producto_id, proveedor_id, lote, fecha_vencimiento, cantidad_inicial, cantidad_actual, precio_compra_unitario, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [testProductoId2, testProveedorId, 'LOTESAL002', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), initialStockP2, initialStockP2, 150.00, 'disponible']
    );
    testInventarioId2 = invResult2.insertId;
}


describe('Salidas API Endpoints (/api/salidas)', () => {
  beforeAll(seedInitialData);

  afterAll(async () => {
    // Clean up created data (reverse order of creation due to FKs)
    await pool.query("DELETE FROM movimientos_inventario WHERE salida_detalle_id IN (SELECT id FROM salidas_detalle WHERE salida_id IN (SELECT id FROM salidas WHERE cliente_id = ?))", [testClienteId]);
    await pool.query("DELETE FROM salidas_detalle WHERE salida_id IN (SELECT id FROM salidas WHERE cliente_id = ?)", [testClienteId]);
    await pool.query("DELETE FROM salidas WHERE cliente_id = ?", [testClienteId]);
    await pool.query("DELETE FROM inventario WHERE id IN (?, ?)", [testInventarioId1, testInventarioId2]);
    await pool.query("DELETE FROM productos WHERE id IN (?, ?)", [testProductoId1, testProductoId2]);
    await pool.query("DELETE FROM categorias WHERE id = ?", [testCategoriaId]);
    await pool.query("DELETE FROM proveedores WHERE id = ?", [testProveedorId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [testClienteId]);
    await pool.query("DELETE FROM usuarios WHERE username IN (?, ?)", [adminSalidaCredentials.username, facturadorSalidaCredentials.username]);
    await pool.end();
  });

  describe('POST /api/salidas (crearSalida)', () => {
    const salidaData = {
      tipo_salida: 'venta',
      cliente_id: null, // Will be set to testClienteId
      fecha: new Date().toISOString().split('T')[0],
      observaciones: 'Salida de prueba',
      detalles: [
        { producto_id: null, cantidad: 5, precio_unitario: 100.00, lote: 'LOTESAL001' }, // producto_id will be set
        { producto_id: null, cantidad: 10, precio_unitario: 200.00, lote: 'LOTESAL002' }
      ]
    };

    beforeEach(async () => {
        // Reset stock for P1 for each test in this suite if necessary, or ensure tests use different products/lots
        // For now, we'll assume stock is sufficient from beforeAll or tests manage this.
        // If a test consumes stock, it should ideally be reverted or use a unique product/lot.
        await pool.query("UPDATE inventario SET cantidad_actual = ? WHERE id = ?", [initialStockP1, testInventarioId1]);
        await pool.query("UPDATE inventario SET cantidad_actual = ? WHERE id = ?", [initialStockP2, testInventarioId2]);
    });

    afterEach(async () => {
        // Clean up any salidas created by tests to maintain isolation if needed
        if (testSalidaId) {
            await pool.query("DELETE FROM movimientos_inventario WHERE salida_detalle_id IN (SELECT id FROM salidas_detalle WHERE salida_id = ?)", [testSalidaId]);
            await pool.query("DELETE FROM salidas_detalle WHERE salida_id = ?", [testSalidaId]);
            await pool.query("DELETE FROM salidas WHERE id = ?", [testSalidaId]);
            testSalidaId = null;
        }
    });


    it('should create a salida successfully with valid data and sufficient stock', async () => {
      const currentSalidaData = JSON.parse(JSON.stringify(salidaData)); // Deep copy
      currentSalidaData.cliente_id = testClienteId;
      currentSalidaData.detalles[0].producto_id = testProductoId1;
      currentSalidaData.detalles[1].producto_id = testProductoId2;

      const response = await request(app)
        .post('/api/salidas')
        .set('Authorization', `Bearer ${adminToken}`) // adminToken has bodeguero/admin role
        .send(currentSalidaData);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Salida creada exitosamente');
      expect(response.body.data).toHaveProperty('id');
      testSalidaId = response.body.data.id; // Save for potential later cleanup or checks

      // Verify stock reduction (example for one product)
      const [invRows] = await pool.query("SELECT cantidad_actual FROM inventario WHERE id = ?", [testInventarioId1]);
      expect(invRows[0].cantidad_actual).toBe(initialStockP1 - currentSalidaData.detalles[0].cantidad);

      // Verify movimientos_inventario (check count for this salida)
      const [movRows] = await pool.query("SELECT COUNT(*) as total FROM movimientos_inventario WHERE documento_id = ? AND tipo_movimiento = 'salida'", [testSalidaId]);
      expect(movRows[0].total).toBe(currentSalidaData.detalles.length);
    });

    it('should return 400 for insufficient stock', async () => {
      const currentSalidaData = JSON.parse(JSON.stringify(salidaData));
      currentSalidaData.cliente_id = testClienteId;
      currentSalidaData.detalles[0].producto_id = testProductoId1;
      currentSalidaData.detalles[0].cantidad = initialStockP1 + 1; // Request more than available
      currentSalidaData.detalles[1].producto_id = testProductoId2;


      const response = await request(app)
        .post('/api/salidas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(currentSalidaData);

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].message).toContain('Stock insuficiente');
    });

    it('should return 401 if no token provided', async () => {
        const response = await request(app).post('/api/salidas').send(salidaData);
        expect(response.statusCode).toBe(401);
    });

    it('should return 403 if user role is not authorized (e.g. facturador trying to create)', async () => {
        const currentSalidaData = JSON.parse(JSON.stringify(salidaData));
        currentSalidaData.cliente_id = testClienteId;
        currentSalidaData.detalles[0].producto_id = testProductoId1;
        currentSalidaData.detalles[1].producto_id = testProductoId2;

        const response = await request(app)
            .post('/api/salidas')
            .set('Authorization', `Bearer ${facturadorToken}`) // facturador token
            .send(currentSalidaData);
        expect(response.statusCode).toBe(403); // Based on esAdminOBodeguero for POST /
    });
  });

  describe('GET /api/salidas (listarSalidas)', () => {
    it('should list salidas successfully', async () => {
      const response = await request(app)
        .get('/api/salidas')
        .set('Authorization', `Bearer ${facturadorToken}`); // facturador can list
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.salidas)).toBe(true);
    });

    it('should filter salidas by cliente_id', async () => {
        // Create a salida first if none guaranteed for testClienteId
        if (!testSalidaId) { // if previous test failed or was skipped
            const createData = { tipo_salida: 'venta', cliente_id: testClienteId, fecha: new Date().toISOString().split('T')[0], detalles: [{ producto_id: testProductoId1, cantidad: 1, precio_unitario: 100, lote: 'LOTESAL001'}]};
            const createRes = await request(app).post('/api/salidas').set('Authorization', `Bearer ${adminToken}`).send(createData);
            testSalidaId = createRes.body.data.id;
        }

        const response = await request(app)
            .get(`/api/salidas?cliente_id=${testClienteId}`)
            .set('Authorization', `Bearer ${facturadorToken}`);
        expect(response.statusCode).toBe(200);
        expect(response.body.data.salidas.every(s => s.cliente_id === testClienteId)).toBe(true);
    });
  });

  describe('GET /api/salidas/:id (obtenerSalida)', () => {
    it('should get a specific salida by ID', async () => {
        if (!testSalidaId) { // Create a salida if it doesn't exist from a previous test
            const createData = { tipo_salida: 'venta', cliente_id: testClienteId, fecha: new Date().toISOString().split('T')[0], detalles: [{ producto_id: testProductoId1, cantidad: 1, precio_unitario: 100, lote: 'LOTESAL001'}]};
            const createRes = await request(app).post('/api/salidas').set('Authorization', `Bearer ${adminToken}`).send(createData);
            testSalidaId = createRes.body.data.id;
        }
        const response = await request(app)
            .get(`/api/salidas/${testSalidaId}`)
            .set('Authorization', `Bearer ${facturadorToken}`);
        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(testSalidaId);
        expect(response.body.data.detalles).toBeDefined();
    });

    it('should return 404 for non-existent salida ID', async () => {
        const response = await request(app)
            .get('/api/salidas/999999')
            .set('Authorization', `Bearer ${facturadorToken}`);
        expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/salidas/:id/cancelar (cancelarSalida)', () => {
    let salidaToCancelId;

    beforeEach(async () => {
        // Create a fresh 'procesada' salida for each cancel test
        const createData = {
            tipo_salida: 'venta',
            cliente_id: testClienteId,
            fecha: new Date().toISOString().split('T')[0],
            observaciones: 'Salida para cancelar',
            detalles: [{ producto_id: testProductoId1, cantidad: 2, precio_unitario: 100, lote: 'LOTESAL001' }]
        };
        const stockBefore = (await pool.query("SELECT cantidad_actual FROM inventario WHERE id = ?", [testInventarioId1]))[0][0].cantidad_actual;

        const createRes = await request(app).post('/api/salidas').set('Authorization', `Bearer ${adminToken}`).send(createData);
        salidaToCancelId = createRes.body.data.id;

        // Check stock was reduced
        const stockAfterCreate = (await pool.query("SELECT cantidad_actual FROM inventario WHERE id = ?", [testInventarioId1]))[0][0].cantidad_actual;
        expect(stockAfterCreate).toBe(stockBefore - 2);
    });

    afterEach(async () => {
        if (salidaToCancelId) {
            await pool.query("DELETE FROM movimientos_inventario WHERE documento_id = ? AND tipo_movimiento IN ('salida', 'ajuste')", [salidaToCancelId]);
            await pool.query("DELETE FROM salidas_detalle WHERE salida_id = ?", [salidaToCancelId]);
            await pool.query("DELETE FROM salidas WHERE id = ?", [salidaToCancelId]);
        }
        // Restore stock for other tests if needed
        await pool.query("UPDATE inventario SET cantidad_actual = ? WHERE id = ?", [initialStockP1, testInventarioId1]);
    });

    it('should cancel a salida successfully and return stock', async () => {
        const stockBeforeCancel = (await pool.query("SELECT cantidad_actual FROM inventario WHERE id = ?", [testInventarioId1]))[0][0].cantidad_actual;

        const response = await request(app)
            .patch(`/api/salidas/${salidaToCancelId}/cancelar`)
            .set('Authorization', `Bearer ${adminToken}`) // esAdminOBodeguero
            .send({ motivo_cancelacion: 'Prueba de cancelación' });

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Salida anulada exitosamente'); // Controller uses 'anulada'

        // Verify stock is returned
        const stockAfterCancel = (await pool.query("SELECT cantidad_actual FROM inventario WHERE id = ?", [testInventarioId1]))[0][0].cantidad_actual;
        expect(stockAfterCancel).toBe(stockBeforeCancel + 2); // +2 because detail had cantidad: 2

        // Verify salida state
        const [salidaRows] = await pool.query("SELECT estado FROM salidas WHERE id = ?", [salidaToCancelId]);
        expect(salidaRows[0].estado).toBe('anulada');

        // Verify reverse movement
        const [movRows] = await pool.query("SELECT COUNT(*) as total FROM movimientos_inventario WHERE documento_id = ? AND tipo_movimiento = 'ajuste' AND documento_tipo = 'anulacion_salida'", [salidaToCancelId]);
        expect(movRows[0].total).toBe(1); // One movement per detail line, here 1 detail line
    });
  });
});
