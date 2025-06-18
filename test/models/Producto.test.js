const Producto = require('../../src/models/Producto');
const { query } = require('../../src/config/database'); // To be mocked
const { NotFoundError, ConflictError, ValidationError, BusinessLogicError } = require('../../src/utils/customErrors'); // Assuming these might be used or should be

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

describe('Producto Model', () => {
  beforeEach(() => {
    query.mockClear();
  });

  describe('Producto.crear()', () => {
    const productoData = {
      codigo: 'PROD001',
      referencia: 'REF001',
      descripcion: 'Test Product',
      categoria_id: 1,
      unidad_medida: 'UNIDAD',
      precio_compra: 10,
      precio_venta: 15,
      requiere_lote: true,
      requiere_vencimiento: true,
      stock_minimo: 5,
      stock_maximo: 20,
    };

    it('should create a product successfully', async () => {
      query.mockResolvedValueOnce([{ insertId: 1 }]);
      const created = await Producto.crear(productoData);
      expect(query).toHaveBeenCalledTimes(1);
      expect(created).toEqual({ id: 1, ...productoData });
    });

    it('should throw Error for duplicate product code', async () => {
      query.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY', message: 'codigo' });
      // Current model throws generic Error, not ConflictError for this specific case in Producto.js
      await expect(Producto.crear(productoData)).rejects.toThrow('El código de producto ya existe');
    });

    it('should re-throw other DB errors', async () => {
        const dbError = new Error("Some other DB error");
        query.mockRejectedValueOnce(dbError);
        await expect(Producto.crear(productoData)).rejects.toThrow(dbError);
    });
  });

  describe('Producto.listar()', () => {
    it('should list products with default options', async () => {
      query.mockResolvedValueOnce([{ total: 0 }]); // Count query
      query.mockResolvedValueOnce([]); // Select query
      const result = await Producto.listar({});
      expect(query).toHaveBeenCalledTimes(2);
      expect(result.productos).toEqual([]);
      expect(result.paginacion.total).toBe(0);
    });

    it('should list products with provided options (buscar, categoria_id, pagination, sorting)', async () => {
        const mockProducts = [{id: 1, codigo: 'P001'}];
        const mockTotal = 1;
        query.mockResolvedValueOnce([{ total: mockTotal }]); // Count query
        query.mockResolvedValueOnce(mockProducts); // Select query

        const options = { pagina: 1, limite: 5, buscar: 'test', categoria_id: 1, orden: 'descripcion', direccion: 'DESC' };
        const result = await Producto.listar(options);

        expect(query).toHaveBeenCalledTimes(2);
        expect(query.mock.calls[0][0]).toContain('WHERE p.activo = true AND (p.codigo LIKE ? OR p.referencia LIKE ? OR p.descripcion LIKE ?) AND p.categoria_id = ?');
        expect(query.mock.calls[0][1]).toEqual(['%test%', '%test%', '%test%', 1]);
        expect(query.mock.calls[1][0]).toContain('ORDER BY p.descripcion DESC');
        expect(result.productos).toEqual(mockProducts);
        expect(result.paginacion.total).toBe(mockTotal);
    });

    it('should handle DB error', async () => {
        query.mockRejectedValueOnce(new Error("DB list error"));
        await expect(Producto.listar({})).rejects.toThrow("DB list error");
    });
  });

  describe('Producto.buscarPorId()', () => {
    it('should return product if found (including stock_actual)', async () => {
      const mockProduct = { id: 1, codigo: 'P001', stock_actual: 10 };
      query.mockResolvedValueOnce([[mockProduct]]);
      const product = await Producto.buscarPorId(1);
      expect(product).toEqual(mockProduct);
      expect(query.mock.calls[0][0]).toContain('GROUP BY p.id'); // Check stock_actual is part of query
    });

    it('should return undefined if not found', async () => {
      query.mockResolvedValueOnce([[]]);
      const product = await Producto.buscarPorId(999);
      // Current model returns undefined, does not throw NotFoundError
      expect(product).toBeUndefined();
    });

    it('should handle DB error', async () => {
        query.mockRejectedValueOnce(new Error("DB find error"));
        await expect(Producto.buscarPorId(1)).rejects.toThrow("DB find error");
    });
  });

  describe('Producto.actualizar()', () => {
    it('should update product successfully', async () => {
      query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const success = await Producto.actualizar(1, { descripcion: 'New Desc' });
      expect(success).toBe(true);
      expect(query).toHaveBeenCalledWith(expect.stringContaining("UPDATE productos SET descripcion = ? WHERE id = ?"), ["New Desc", 1]);
    });

    it('should return false if product not found or no data changed', async () => {
      query.mockResolvedValueOnce([{ affectedRows: 0 }]);
      // Current model returns boolean, not NotFoundError
      const success = await Producto.actualizar(999, { descripcion: 'Any' });
      expect(success).toBe(false);
    });

    it('should throw Error if no valid fields to update', async () => {
      // Current model throws generic Error
      await expect(Producto.actualizar(1, {})).rejects.toThrow('No hay campos válidos para actualizar');
    });

    it('should handle DB error', async () => {
        query.mockRejectedValueOnce(new Error("DB update error"));
        await expect(Producto.actualizar(1, { descripcion: 'Desc' })).rejects.toThrow("DB update error");
    });
  });

  describe('Producto.desactivar()', () => {
    it('should deactivate product successfully if stock is zero', async () => {
      // Mock for buscarPorId call within desactivar
      query.mockResolvedValueOnce([[{ id: 1, stock_actual: 0 }]]);
      // Mock for the UPDATE query
      query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const success = await Producto.desactivar(1);
      expect(success).toBe(true);
      expect(query).toHaveBeenCalledWith('UPDATE productos SET activo = false WHERE id = ?', [1]);
    });

    it('should throw Error if product not found (via buscarPorId)', async () => {
      query.mockResolvedValueOnce([[]]); // buscarPorId returns undefined
      // Current model throws generic Error
      await expect(Producto.desactivar(999)).rejects.toThrow('Producto no encontrado');
    });

    it('should throw Error if product has stock', async () => {
      query.mockResolvedValueOnce([[{ id: 1, stock_actual: 10 }]]); // buscarPorId returns product with stock
      // Current model throws generic Error
      await expect(Producto.desactivar(1)).rejects.toThrow('No se puede desactivar un producto con stock disponible');
    });

    it('should handle DB error during deactivation update', async () => {
        query.mockResolvedValueOnce([[{ id: 1, stock_actual: 0 }]]); // buscarPorId success
        query.mockRejectedValueOnce(new Error("DB deactivate error")); // Error on UPDATE
        await expect(Producto.desactivar(1)).rejects.toThrow("DB deactivate error");
    });
  });

  describe('Producto.buscarMuchosPorIds()', () => {
    it('should return products for existing IDs', async () => {
      const mockProducts = [{ id: 1, codigo: 'P001' }, { id: 2, codigo: 'P002' }];
      query.mockResolvedValueOnce(mockProducts);
      const products = await Producto.buscarMuchosPorIds([1, 2]);
      expect(products).toEqual(mockProducts);
      expect(query.mock.calls[0][0]).toContain('WHERE p.id IN (?,?)');
      expect(query.mock.calls[0][1]).toEqual([1,2]);
    });

    it('should return only found products if some IDs do not exist', async () => {
      const mockProducts = [{ id: 1, codigo: 'P001' }];
      query.mockResolvedValueOnce(mockProducts); // DB only returns found ones
      const products = await Producto.buscarMuchosPorIds([1, 999]);
      expect(products).toEqual(mockProducts);
    });

    it('should return empty array if no IDs found', async () => {
      query.mockResolvedValueOnce([]);
      const products = await Producto.buscarMuchosPorIds([998, 999]);
      expect(products).toEqual([]);
    });

    it('should return empty array if input IDs array is empty', async () => {
      const products = await Producto.buscarMuchosPorIds([]);
      expect(products).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('should handle DB error', async () => {
        query.mockRejectedValueOnce(new Error("DB batch find error"));
        await expect(Producto.buscarMuchosPorIds([1,2])).rejects.toThrow("DB batch find error");
    });
  });

  describe('Producto.obtenerStockActualPorIds()', () => {
    it('should return stock for existing IDs', async () => {
      const mockStocks = [{ producto_id: 1, stock_total: 10 }, { producto_id: 2, stock_total: 5 }];
      query.mockResolvedValueOnce(mockStocks);
      const stocks = await Producto.obtenerStockActualPorIds([1, 2]);
      expect(stocks).toEqual(mockStocks);
      expect(query.mock.calls[0][0]).toContain('SELECT p.id as producto_id, COALESCE(SUM(i.cantidad_actual), 0) as stock_total');
    });

    it('should return empty array if input IDs array is empty', async () => {
      const stocks = await Producto.obtenerStockActualPorIds([]);
      expect(stocks).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('should handle DB error', async () => {
        query.mockRejectedValueOnce(new Error("DB batch stock error"));
        await expect(Producto.obtenerStockActualPorIds([1,2])).rejects.toThrow("DB batch stock error");
    });
  });
});
