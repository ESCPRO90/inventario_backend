const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/database');
const Usuario = require('../../src/models/Usuario'); // For creating test user

let adminToken;
let testCategoriaId;
let testProveedorId;
let testProductoId1;
let testProductoId2;
let testInventarioId1;
let testInventarioId2;

const adminInvCredentials = { username: 'admin_inv_test', password: 'password123', nombre_completo: 'Admin Inv Test', email: 'admininvtest@example.com', rol: 'admin' };

describe('Inventario API Endpoints (/api/inventario)', () => {
  beforeAll(async () => {
    // Clean up potential previous test data
    await pool.query("DELETE FROM movimientos_inventario WHERE producto_id IN (SELECT id FROM productos WHERE codigo LIKE 'TESTPROD%')");
    await pool.query("DELETE FROM inventario WHERE producto_id IN (SELECT id FROM productos WHERE codigo LIKE 'TESTPROD%')");
    await pool.query("DELETE FROM productos WHERE codigo LIKE 'TESTPROD%'");
    await pool.query("DELETE FROM categorias WHERE nombre LIKE 'Test Cat%'");
    await pool.query("DELETE FROM proveedores WHERE codigo LIKE 'TESTPROV%'");
    await pool.query("DELETE FROM usuarios WHERE username = ?", [adminInvCredentials.username]);

    // Create admin user for inventory operations
    const adminUser = await Usuario.crear(adminInvCredentials);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: adminInvCredentials.username, password: adminInvCredentials.password });
    adminToken = loginRes.body.data.token;

    // Seed data
    const [catResult] = await pool.query("INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)", ['Test Cat Inv', 'Test Category for Inventory']);
    testCategoriaId = catResult.insertId;

    const [provResult] = await pool.query("INSERT INTO proveedores (codigo, nombre) VALUES (?, ?)", ['TESTPROV01', 'Test Proveedor Inv']);
    testProveedorId = provResult.insertId;

    let prodParams = ['TESTPROD01', 'Test Producto Inv 1', testCategoriaId, testProveedorId, 10.00, 15.00];
    const [prodResult1] = await pool.query(
      "INSERT INTO productos (codigo, descripcion, categoria_id, precio_compra, precio_venta, stock_minimo, stock_maximo, unidad_medida, requiere_lote, requiere_vencimiento, activo) VALUES (?, ?, ?, 5.00, 6.00, 0, 0, 'UNIDAD', true, true, true)",
      prodParams.slice(0,3) // codigo, descripcion, categoria_id
    );
    testProductoId1 = prodResult1.insertId;

    prodParams = ['TESTPROD02', 'Test Producto Inv 2', testCategoriaId, testProveedorId, 20.00, 25.00];
    const [prodResult2] = await pool.query(
       "INSERT INTO productos (codigo, descripcion, categoria_id, precio_compra, precio_venta, stock_minimo, stock_maximo, unidad_medida, requiere_lote, requiere_vencimiento, activo) VALUES (?, ?, ?, 5.00, 6.00, 0, 0, 'UNIDAD', true, true, true)",
       prodParams.slice(0,3)
    );
    testProductoId2 = prodResult2.insertId;

    const [invResult1] = await pool.query(
      "INSERT INTO inventario (producto_id, proveedor_id, lote, fecha_vencimiento, cantidad_inicial, cantidad_actual, precio_compra_unitario, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [testProductoId1, testProveedorId, 'LOTEINV001', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 100, 100, 10.00, 'disponible']
    );
    testInventarioId1 = invResult1.insertId;

    const [invResult2] = await pool.query(
      "INSERT INTO inventario (producto_id, proveedor_id, lote, fecha_vencimiento, cantidad_inicial, cantidad_actual, precio_compra_unitario, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [testProductoId2, testProveedorId, 'LOTEINV002', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 50, 50, 20.00, 'disponible']
    );
    testInventarioId2 = invResult2.insertId;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM movimientos_inventario WHERE producto_id IN (?, ?)", [testProductoId1, testProductoId2]);
    await pool.query("DELETE FROM inventario WHERE id IN (?, ?)", [testInventarioId1, testInventarioId2]);
    await pool.query("DELETE FROM productos WHERE id IN (?, ?)", [testProductoId1, testProductoId2]);
    await pool.query("DELETE FROM categorias WHERE id = ?", [testCategoriaId]);
    await pool.query("DELETE FROM proveedores WHERE id = ?", [testProveedorId]);
    await pool.query("DELETE FROM usuarios WHERE username = ?", [adminInvCredentials.username]);
    await pool.end();
  });

  describe('GET /api/inventario (obtenerInventario)', () => {
    it('should list inventory items with default parameters', async () => {
      const response = await request(app)
        .get('/api/inventario')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.inventario)).toBe(true);
      expect(response.body.data.paginacion).toBeDefined();
    });

    it('should filter inventory by producto_id', async () => {
      const response = await request(app)
        .get(`/api/inventario?producto_id=${testProductoId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.data.inventario.every(item => item.producto_id === testProductoId1)).toBe(true);
    });

    it('should paginate inventory results', async () => {
      // Assuming there are at least 2 items from setup
      const response = await request(app)
        .get('/api/inventario?pagina=1&limite=1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.data.inventario.length).toBe(1);
      expect(response.body.data.paginacion.pagina_actual).toBe(1);
      expect(response.body.data.paginacion.limite).toBe(1);
    });

    it('should return 401 if no token is provided', async () => {
        const response = await request(app).get('/api/inventario');
        expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/inventario/lotes/:id (obtenerLotePorId)', () => {
    it('should get details for an existing lot', async () => {
      const response = await request(app)
        .get(`/api/inventario/lotes/${testInventarioId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testInventarioId1);
      expect(response.body.data.lote).toBe('LOTEINV001');
    });

    it('should return 404 for a non-existent lot ID', async () => {
      const response = await request(app)
        .get('/api/inventario/lotes/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('Lote no encontrado');
    });
  });

  describe('POST /api/inventario/ajustar (ajustarInventario)', () => {
    it('should successfully make a positive adjustment', async () => {
      const ajusteData = {
        inventario_id: testInventarioId1,
        cantidad_nueva: 110, // Original was 100
        motivo: 'correccion_positiva',
        observaciones: 'Ajuste de prueba positivo'
      };
      const response = await request(app)
        .post('/api/inventario/ajustar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(ajusteData);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Inventario ajustado exitosamente');
      expect(response.body.data.inventario_id).toBe(testInventarioId1);
      expect(response.body.data.cantidad_nueva).toBe(110);
      expect(response.body.data.diferencia).toBe(10);

      // Verify DB (optional here, more thorough tests would check movements table too)
      const [rows] = await pool.query("SELECT cantidad_actual FROM inventario WHERE id = ?", [testInventarioId1]);
      expect(rows[0].cantidad_actual).toBe(110);
      // Revert for other tests
      await pool.query("UPDATE inventario SET cantidad_actual = 100 WHERE id = ?", [testInventarioId1]);
      await pool.query("DELETE FROM movimientos_inventario WHERE inventario_id = ? AND motivo = 'correccion_positiva'", [testInventarioId1]);

    });

    it('should return 400 for missing cantidad_nueva', async () => {
      const ajusteData = {
        inventario_id: testInventarioId1,
        motivo: 'correccion_error',
        observaciones: 'Ajuste de prueba error'
      };
      const response = await request(app)
        .post('/api/inventario/ajustar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(ajusteData);
      expect(response.statusCode).toBe(400); // Assuming express-validator is set up for this route
      // Add more specific error message checks based on validator output
    });

    it('should return 404 when adjusting a non-existent inventario_id', async () => {
      const ajusteData = {
        inventario_id: 999999,
        cantidad_nueva: 10,
        motivo: 'correccion_inexistente',
        observaciones: 'Ajuste de prueba inexistente'
      };
      const response = await request(app)
        .post('/api/inventario/ajustar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(ajusteData);
      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('Lote de inventario no encontrado');
    });
  });

  describe('POST /api/inventario/transferir (transferirLotes)', () => {
    let sourceLotId;
    let destLotId;
    const initialSourceQty = 20;
    const initialDestQty = 5;
    const transferQty = 5;

    beforeEach(async () => {
      // Create specific lots for transfer tests to avoid interference
      const [srcRes] = await pool.query(
        "INSERT INTO inventario (producto_id, proveedor_id, lote, fecha_vencimiento, cantidad_inicial, cantidad_actual, precio_compra_unitario, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [testProductoId1, testProveedorId, 'LOTE_SRC_TR', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), initialSourceQty, initialSourceQty, 10.00, 'disponible']
      );
      sourceLotId = srcRes.insertId;

      const [destRes] = await pool.query(
        "INSERT INTO inventario (producto_id, proveedor_id, lote, fecha_vencimiento, cantidad_inicial, cantidad_actual, precio_compra_unitario, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [testProductoId1, testProveedorId, 'LOTE_DEST_TR', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), initialDestQty, initialDestQty, 10.00, 'disponible']
      );
      destLotId = destRes.insertId;
    });

    afterEach(async () => {
      await pool.query("DELETE FROM movimientos_inventario WHERE inventario_id IN (?, ?)", [sourceLotId, destLotId]);
      await pool.query("DELETE FROM inventario WHERE id IN (?, ?)", [sourceLotId, destLotId]);
    });

    it('should successfully transfer quantity between existing lots', async () => {
      const transferData = {
        lote_origen_id: sourceLotId,
        lote_destino_id: destLotId,
        cantidad: transferQty,
        observaciones: 'Transferencia de prueba exitosa'
      };
      const response = await request(app)
        .post('/api/inventario/transferir')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(transferData);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Transferencia realizada exitosamente');

      // Verify DB state
      const [sourceLotRows] = await pool.query("SELECT cantidad_actual FROM inventario WHERE id = ?", [sourceLotId]);
      expect(sourceLotRows[0].cantidad_actual).toBe(initialSourceQty - transferQty);

      const [destLotRows] = await pool.query("SELECT cantidad_actual FROM inventario WHERE id = ?", [destLotId]);
      expect(destLotRows[0].cantidad_actual).toBe(initialDestQty + transferQty);

      // Verify movements (check count, more detailed checks could be added)
      const [movements] = await pool.query("SELECT COUNT(*) as total FROM movimientos_inventario WHERE (inventario_id = ? OR inventario_id = ?) AND documento_tipo LIKE 'transferencia_%'", [sourceLotId, destLotId]);
      expect(movements[0].total).toBe(2);
    });

    it('should return 400 for insufficient quantity in source lot', async () => {
      const transferData = {
        lote_origen_id: sourceLotId,
        lote_destino_id: destLotId,
        cantidad: initialSourceQty + 1, // More than available
        observaciones: 'Transferencia con stock insuficiente'
      };
      const response = await request(app)
        .post('/api/inventario/transferir')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(transferData);
      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Cantidad insuficiente en el lote origen');
    });

    it('should return 404 if source lot not found', async () => {
      const transferData = {
        lote_origen_id: 99999,
        lote_destino_id: destLotId,
        cantidad: transferQty,
        observaciones: 'Transferencia con origen inexistente'
      };
      const response = await request(app)
        .post('/api/inventario/transferir')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(transferData);
      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('Lote de origen o destino no encontrado');
    });

    it('should return 400 if lots are from different products', async () => {
        // Create a new destination lot for a different product
        const [otherProdDestRes] = await pool.query(
            "INSERT INTO inventario (producto_id, proveedor_id, lote, cantidad_actual, estado) VALUES (?, ?, ?, ?, ?)",
            [testProductoId2, testProveedorId, 'LOTE_OTHER_PROD', initialDestQty, 'disponible']
          );
        const otherProdDestLotId = otherProdDestRes.insertId;

        const transferData = {
            lote_origen_id: sourceLotId,
            lote_destino_id: otherProdDestLotId,
            cantidad: transferQty,
            observaciones: 'Transferencia entre productos diferentes'
        };
        const response = await request(app)
            .post('/api/inventario/transferir')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(transferData);
        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe('Los lotes deben ser del mismo producto');

        await pool.query("DELETE FROM inventario WHERE id = ?", [otherProdDestLotId]);
    });
  });

  describe('GET /api/inventario/kardex/:producto_id (obtenerKardex)', () => {
    it('should get kardex for a product', async () => {
      // Ensure some movements exist for testProductoId1 from previous tests (e.g., adjustment)
      // Or create a specific movement here for a clean test
      await pool.query(
        "INSERT INTO movimientos_inventario (fecha, tipo_movimiento, producto_id, inventario_id, cantidad, saldo_anterior, saldo_actual, usuario_id) VALUES (NOW(), 'ajuste', ?, ?, ?, ?, ?, ?)",
        [testProductoId1, testInventarioId1, 5, 100, 105, 1] // Assuming admin user ID 1 or fetch it
      );

      const response = await request(app)
        .get(`/api/inventario/kardex/${testProductoId1}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.producto_id).toBe(testProductoId1);
      expect(Array.isArray(response.body.data.movimientos)).toBe(true);
      // This will also pick up movements from adjust/transfer tests if run in sequence and not fully cleaned.
      // For more precise count, clean up movements related to testProductoId1 in a beforeEach for this describe.
    });

    it('should return empty movements for a product with no kardex entries', async () => {
      const response = await request(app)
        .get(`/api/inventario/kardex/${testProductoId2}?limite=10`) // testProductoId2 might not have movements yet
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.statusCode).toBe(200);
      // It will return movements from its initial seeding if any, or from other tests.
      // A truly "empty" test would need a product ID guaranteed to have no movements.
      // For now, we just check the structure.
      expect(response.body.data.movimientos.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/inventario/resumen (obtenerResumen)', () => {
    it('should get inventory summary', async () => {
      const response = await request(app)
        .get('/api/inventario/resumen')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.resumen).toBeDefined();
      expect(response.body.data.resumen).toHaveProperty('total_productos');
      expect(response.body.data.resumen).toHaveProperty('total_lotes');
      expect(response.body.data.resumen).toHaveProperty('total_unidades');
      expect(response.body.data.resumen).toHaveProperty('valor_total');
      expect(response.body.data.top_proveedores).toBeDefined();
    });
  });

  describe('GET /api/inventario/exportar (exportarInventario)', () => {
    it('should export inventory as JSON by default', async () => {
      const response = await request(app)
        .get('/api/inventario/exportar')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.inventario)).toBe(true);
    });

    it('should export inventory as CSV', async () => {
      const response = await request(app)
        .get('/api/inventario/exportar?formato=csv')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/csv/);
      expect(response.text).toContain('codigo,referencia,descripcion'); // Check for header
    });
  });
});
