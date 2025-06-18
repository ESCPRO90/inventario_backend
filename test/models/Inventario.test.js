const Inventario = require('../../src/models/Inventario');
const { query, pool } = require('../../src/config/database'); // To be mocked
const { NotFoundError, BusinessLogicError, ValidationError } = require('../../src/utils/customErrors');

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  pool: {
    getConnection: jest.fn(() => ({
      execute: jest.fn(),
      release: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
    })),
  },
}));

describe('Inventario Model', () => {
  let mockConnection;

  beforeEach(() => {
    query.mockClear();
    // Setup a fresh mock connection for each test that might use transactions
    mockConnection = {
      execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]), // Default success for execute
      release: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    pool.getConnection.mockResolvedValue(mockConnection);
  });

  describe('Inventario.obtenerInventarioGeneral()', () => {
    it('should fetch inventory with default options', async () => {
      query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]); // Count then select
      const result = await Inventario.obtenerInventarioGeneral({});
      expect(query).toHaveBeenCalledTimes(2);
      expect(query.mock.calls[0][0]).toContain('SELECT COUNT(i.id) as total');
      expect(query.mock.calls[1][0]).toContain('ORDER BY producto_codigo ASC'); // Default sort
      expect(result.inventario).toEqual([]);
      expect(result.paginacion.total).toBe(0);
    });

    it('should apply filters, pagination, and custom sorting', async () => {
      const options = {
        pagina: 2,
        limite: 5,
        buscar: 'test',
        producto_id: 1,
        proveedor_id: 2,
        estado: 'agotado',
        proximos_vencer: 30,
        orden: 'fecha_vencimiento',
        direccion: 'DESC',
      };
      query.mockResolvedValueOnce([{ total: 10 }]).mockResolvedValueOnce([{ id: 1, lote: 'LOTE001' }]);

      await Inventario.obtenerInventarioGeneral(options);

      expect(query).toHaveBeenCalledTimes(2);
      const whereClauseParts = [
        "p.codigo LIKE '%test%'",
        "p.descripcion LIKE '%test%'",
        "i.lote LIKE '%test%'",
        "i.producto_id = ?",
        "i.proveedor_id = ?",
        "i.estado = ?",
        "i.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY)"
      ];
      whereClauseParts.forEach(part => expect(query.mock.calls[0][0]).toContain(part));
      expect(query.mock.calls[1][0]).toContain('ORDER BY fecha_vencimiento DESC');
      expect(query.mock.calls[1][1]).toEqual(expect.arrayContaining([5, 5])); // limit, offset
    });

    it('should default to "producto_codigo ASC" for invalid sort parameters', async () => {
      query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
      await Inventario.obtenerInventarioGeneral({ orden: 'INVALID_COLUMN', direccion: 'INVALID_DIR' });
      expect(query.mock.calls[1][0]).toContain('ORDER BY producto_codigo ASC');
    });

    it('should handle DB error', async () => {
      query.mockRejectedValueOnce(new Error('DB list error'));
      await expect(Inventario.obtenerInventarioGeneral({})).rejects.toThrow('DB list error');
    });
  });

  describe('Inventario.verificarExistenciaLote()', () => {
    it('should return true if lote exists', async () => {
      query.mockResolvedValueOnce([[{ id: 1 }]]); // Row exists
      const exists = await Inventario.verificarExistenciaLote(1);
      expect(exists).toBe(true);
    });

    it('should return false if lote does not exist', async () => {
      query.mockResolvedValueOnce([[]]); // No rows
      const exists = await Inventario.verificarExistenciaLote(999);
      expect(exists).toBe(false);
    });

    it('should handle DB error', async () => {
        query.mockRejectedValueOnce(new Error("DB check error"));
        await expect(Inventario.verificarExistenciaLote(1)).rejects.toThrow("DB check error");
    });
  });

  describe('Inventario.obtenerDetalleLote()', () => {
    it('should return lote details if found', async () => {
      const mockLote = { id: 1, lote: 'LOTE001' };
      query.mockResolvedValueOnce([[mockLote]]);
      const lote = await Inventario.obtenerDetalleLote(1);
      expect(lote).toEqual(mockLote);
    });

    it('should return undefined if not found', async () => {
      query.mockResolvedValueOnce([[]]);
      const lote = await Inventario.obtenerDetalleLote(999);
      expect(lote).toBeUndefined(); // Current model behavior
    });

    it('should handle DB error', async () => {
        query.mockRejectedValueOnce(new Error("DB find detail error"));
        await expect(Inventario.obtenerDetalleLote(1)).rejects.toThrow("DB find detail error");
    });
  });

  describe('Inventario.ajustarInventario()', () => {
    const ajusteData = {
      inventario_id: 1,
      cantidad_nueva: 15,
      motivo: 'correccion',
      observaciones: 'Ajuste de prueba',
      usuario_id: 1,
      producto_id: 1, // From fetched inventarioActual in controller
      diferencia: 5,    // (cantidad_nueva - saldo_anterior)
      saldo_anterior: 10
    };

    it('should adjust inventory (positive) and log movement', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]); // For UPDATE and INSERT

      await Inventario.ajustarInventario(ajusteData, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      // Check UPDATE inventario
      expect(mockConnection.execute.mock.calls[0][0]).toContain('UPDATE inventario SET cantidad_actual = ?, estado = ? WHERE id = ?');
      expect(mockConnection.execute.mock.calls[0][1]).toEqual([15, 'disponible', 1]);
      // Check INSERT movimientos_inventario
      expect(mockConnection.execute.mock.calls[1][0]).toContain('INSERT INTO movimientos_inventario');
      expect(mockConnection.execute.mock.calls[1][1]).toEqual(
        expect.arrayContaining([ajusteData.motivo, ajusteData.producto_id, ajusteData.inventario_id, ajusteData.diferencia, ajusteData.saldo_anterior, ajusteData.cantidad_nueva, ajusteData.usuario_id, ajusteData.observaciones])
      );
    });

    it('should adjust inventory (negative, sets to agotado) and log movement', async () => {
      const dataAgotado = { ...ajusteData, cantidad_nueva: 0, diferencia: -10, saldo_anterior: 10 };
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await Inventario.ajustarInventario(dataAgotado, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute.mock.calls[0][1]).toEqual([0, 'agotado', 1]); // Check estado
      expect(mockConnection.execute.mock.calls[1][1][6]).toBe(dataAgotado.diferencia); // cantidad in movimiento
    });

    it('should throw error if UPDATE inventario fails', async () => {
      mockConnection.execute.mockRejectedValueOnce(new Error('Update failed'));
      await expect(Inventario.ajustarInventario(ajusteData, mockConnection)).rejects.toThrow('Update failed');
    });

    it('should throw error if INSERT movimiento fails', async () => {
      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE succeeds
      mockConnection.execute.mockRejectedValueOnce(new Error('Insert failed')); // INSERT fails
      await expect(Inventario.ajustarInventario(ajusteData, mockConnection)).rejects.toThrow('Insert failed');
    });
  });

  describe('Inventario.transferirLotes()', () => {
    const transferenciaData = {
      lote_origen_id: 1,
      lote_destino_id: 2,
      cantidad_a_transferir: 5,
      producto_id: 100,
      usuario_id: 1,
      observaciones: 'Transferencia de prueba',
      lote_origen_cantidad_anterior: 10,
      lote_destino_cantidad_anterior: 3
    };

    it('should transfer stock and log movements successfully', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]); // All 4 DB calls succeed

      await Inventario.transferirLotes(transferenciaData, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(4);
      // Call 1: Update lote_origen
      expect(mockConnection.execute.mock.calls[0][0]).toContain('UPDATE inventario SET cantidad_actual = cantidad_actual - ? WHERE id = ?');
      expect(mockConnection.execute.mock.calls[0][1]).toEqual([5, 1]);
      // Call 2: Update lote_destino
      expect(mockConnection.execute.mock.calls[1][0]).toContain('UPDATE inventario SET cantidad_actual = cantidad_actual + ? WHERE id = ?');
      expect(mockConnection.execute.mock.calls[1][1]).toEqual([5, 2]);
      // Call 3: Insert movimiento_salida
      expect(mockConnection.execute.mock.calls[2][0]).toContain('transferencia_salida');
      expect(mockConnection.execute.mock.calls[2][1]).toEqual(expect.arrayContaining([
        transferenciaData.producto_id, transferenciaData.lote_origen_id, -transferenciaData.cantidad_a_transferir,
        transferenciaData.lote_origen_cantidad_anterior, transferenciaData.lote_origen_cantidad_anterior - transferenciaData.cantidad_a_transferir,
        transferenciaData.usuario_id
      ]));
      // Call 4: Insert movimiento_entrada
      expect(mockConnection.execute.mock.calls[3][0]).toContain('transferencia_entrada');
       expect(mockConnection.execute.mock.calls[3][1]).toEqual(expect.arrayContaining([
        transferenciaData.producto_id, transferenciaData.lote_destino_id, transferenciaData.cantidad_a_transferir,
        transferenciaData.lote_destino_cantidad_anterior, transferenciaData.lote_destino_cantidad_anterior + transferenciaData.cantidad_a_transferir,
        transferenciaData.usuario_id
      ]));
    });

    it('should throw error if source lot update fails', async () => {
        mockConnection.execute.mockRejectedValueOnce(new Error("Source update failed"));
        await expect(Inventario.transferirLotes(transferenciaData, mockConnection)).rejects.toThrow("Source update failed");
    });

    it('should throw error if destination lot update fails', async () => {
        mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // Source update ok
        mockConnection.execute.mockRejectedValueOnce(new Error("Dest update failed")); // Dest update fails
        await expect(Inventario.transferirLotes(transferenciaData, mockConnection)).rejects.toThrow("Dest update failed");
    });

    it('should throw error if first movement insert fails', async () => {
        mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // Source update ok
        mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // Dest update ok
        mockConnection.execute.mockRejectedValueOnce(new Error("Movement1 insert failed")); // Mov1 insert fails
        await expect(Inventario.transferirLotes(transferenciaData, mockConnection)).rejects.toThrow("Movement1 insert failed");
    });

    it('should throw error if second movement insert fails', async () => {
        mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // Mov1 insert ok
        mockConnection.execute.mockRejectedValueOnce(new Error("Movement2 insert failed")); // Mov2 insert fails
        await expect(Inventario.transferirLotes(transferenciaData, mockConnection)).rejects.toThrow("Movement2 insert failed");
    });
  });
});
