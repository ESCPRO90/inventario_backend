const Usuario = require('../../src/models/Usuario');
const { query } = require('../../src/config/database'); // To be mocked
const bcrypt = require('bcryptjs');
const { ValidationError, ConflictError, NotFoundError, BusinessLogicError } = require('../../src/utils/customErrors');

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

// Helper to compare passwords without exposing bcrypt details in every test
const checkPassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

describe('Usuario Model', () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    query.mockClear();
  });

  describe('Usuario.crear()', () => {
    it('should create a user successfully with valid data', async () => {
      const userData = {
        username: 'testuser',
        password: 'password123',
        nombre_completo: 'Test User',
        email: 'test@example.com',
        rol: 'bodeguero',
      };
      query.mockResolvedValueOnce([{ insertId: 1 }]); // Simulate DB insert

      const createdUser = await Usuario.crear(userData);

      expect(query).toHaveBeenCalledTimes(1);
      expect(createdUser).toHaveProperty('id', 1);
      expect(createdUser.username).toBe(userData.username);
      expect(bcrypt.compareSync(userData.password, query.mock.calls[0][1][1])).toBe(true); // Check hashed password
    });

    it('should throw ValidationError for missing username', async () => {
      const userData = { password: 'password123', nombre_completo: 'Test User', email: 'test@example.com' };
      await expect(Usuario.crear(userData)).rejects.toThrow(ValidationError);
      await expect(Usuario.crear(userData)).rejects.toThrow('El nombre de usuario es requerido');
    });

    it('should throw ValidationError for missing email', async () => {
      const userData = { username: 'testuser', password: 'password123', nombre_completo: 'Test User' };
      await expect(Usuario.crear(userData)).rejects.toThrow(ValidationError);
      await expect(Usuario.crear(userData)).rejects.toThrow('El email es requerido');
    });

    it('should throw ValidationError for invalid email format', async () => {
      const userData = { username: 'testuser', password: 'password123', nombre_completo: 'Test User', email: 'invalidemail' };
      await expect(Usuario.crear(userData)).rejects.toThrow(ValidationError);
      await expect(Usuario.crear(userData)).rejects.toThrow('formato válido');
    });

    it('should throw ValidationError for short password', async () => {
      const userData = { username: 'testuser', password: '123', nombre_completo: 'Test User', email: 'test@example.com' };
      await expect(Usuario.crear(userData)).rejects.toThrow(ValidationError);
      await expect(Usuario.crear(userData)).rejects.toThrow('La contraseña es requerida y debe tener al menos 6 caracteres');
    });

    it('should throw ConflictError for duplicate username', async () => {
      const userData = { username: 'testuser', password: 'password123', nombre_completo: 'Test User', email: 'test@example.com' };
      query.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY', message: 'username_UNIQUE' });
      await expect(Usuario.crear(userData)).rejects.toThrow(ConflictError);
      await expect(Usuario.crear(userData)).rejects.toThrow('El nombre de usuario ya existe');
    });

    it('should throw ConflictError for duplicate email', async () => {
      const userData = { username: 'testuser', password: 'password123', nombre_completo: 'Test User', email: 'test@example.com' };
      query.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY', message: 'email_UNIQUE' });
      await expect(Usuario.crear(userData)).rejects.toThrow(ConflictError);
      await expect(Usuario.crear(userData)).rejects.toThrow('El email ya está registrado');
    });

    it('should throw generic error for other DB errors', async () => {
      const userData = { username: 'testuser', password: 'password123', nombre_completo: 'Test User', email: 'test@example.com' };
      const dbError = new Error("Some other DB error");
      query.mockRejectedValueOnce(dbError);
      await expect(Usuario.crear(userData)).rejects.toThrow(dbError);
    });
  });

  describe('Usuario.buscarPorId()', () => {
    it('should return user data for an existing ID', async () => {
      const mockUser = { id: 1, username: 'founduser', email: 'found@example.com', activo: true };
      query.mockResolvedValueOnce([[mockUser]]); // DB returns array of rows
      const user = await Usuario.buscarPorId(1);
      expect(user).toEqual(mockUser);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT id, username, nombre_completo, email, rol, activo FROM usuarios WHERE id = ?'), [1]);
    });

    it('should throw NotFoundError for a non-existent ID', async () => {
      query.mockResolvedValueOnce([[]]); // Empty array means no user found
      await expect(Usuario.buscarPorId(999)).rejects.toThrow(NotFoundError);
      await expect(Usuario.buscarPorId(999)).rejects.toThrow('Usuario con ID 999 no encontrado.');
    });

    it('should throw error for DB error', async () => {
      const dbError = new Error("DB error");
      query.mockRejectedValueOnce(dbError);
      await expect(Usuario.buscarPorId(1)).rejects.toThrow(dbError);
    });
  });

  describe('Usuario.buscarPorUsername()', () => {
    it('should return user data for an existing username', async () => {
      const mockUser = { id: 1, username: 'testuser', email: 'test@example.com', activo: true };
      query.mockResolvedValueOnce([[mockUser]]);
      const user = await Usuario.buscarPorUsername('testuser');
      expect(user).toEqual(mockUser);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM usuarios WHERE username = ? AND activo = true'), ['testuser']);
    });

    it('should return undefined for a non-existent username', async () => {
      query.mockResolvedValueOnce([[]]);
      const user = await Usuario.buscarPorUsername('notauser');
      expect(user).toBeUndefined();
    });

    it('should throw error for DB error', async () => {
      const dbError = new Error("DB error");
      query.mockRejectedValueOnce(dbError);
      await expect(Usuario.buscarPorUsername('testuser')).rejects.toThrow(dbError);
    });
  });

  describe('Usuario.actualizar()', () => {
    it('should update user successfully', async () => {
      const updateData = { nombre_completo: 'Updated Name', email: 'updated@example.com' };
      query.mockResolvedValueOnce([{ affectedRows: 1 }]); // Simulate successful update

      const success = await Usuario.actualizar(1, updateData);
      expect(success).toBe(true);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE usuarios SET nombre_completo = ?, email = ? WHERE id = ?'), ['Updated Name', 'updated@example.com', 1]);
    });

    it('should throw ValidationError for invalid email format', async () => {
      await expect(Usuario.actualizar(1, { email: 'invalid' })).rejects.toThrow(ValidationError);
      await expect(Usuario.actualizar(1, { email: 'invalid' })).rejects.toThrow('Formato de email inválido.');
    });

    it('should throw NotFoundError if user ID does not exist', async () => {
      query.mockResolvedValueOnce([{ affectedRows: 0 }]);
      await expect(Usuario.actualizar(999, { nombre_completo: 'Any Name' })).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError for duplicate email on update', async () => {
      const dbError = { code: 'ER_DUP_ENTRY', message: 'email_UNIQUE' };
      query.mockRejectedValueOnce(dbError);
      await expect(Usuario.actualizar(1, { email: 'duplicate@example.com' })).rejects.toThrow(ConflictError);
    });

    it('should throw BusinessLogicError if no valid fields to update', async () => {
      await expect(Usuario.actualizar(1, {})).rejects.toThrow(BusinessLogicError);
      await expect(Usuario.actualizar(1, {})).rejects.toThrow('No hay campos válidos para actualizar');
    });

    it('should throw error for other DB errors during update', async () => {
      const dbError = new Error("DB update error");
      query.mockRejectedValueOnce(dbError);
      await expect(Usuario.actualizar(1, { nombre_completo: 'name' })).rejects.toThrow(dbError);
    });
  });

  describe('Usuario.cambiarPassword()', () => {
    const userId = 1;
    const currentPasswordPlain = 'currentPass123';
    const newPasswordPlain = 'newPass456';
    let hashedPassword;

    beforeEach(async () => {
      hashedPassword = await bcrypt.hash(currentPasswordPlain, 10);
    });

    it('should change password successfully', async () => {
      // Mock buscarPorId
      query.mockResolvedValueOnce([[{ id: userId, username: 'testuser', activo: true }]]); // For buscarPorId
      // Mock fetch para password actual
      query.mockResolvedValueOnce([[{ password: hashedPassword }]]); // For fetching current hashed password
      // Mock update password
      query.mockResolvedValueOnce([{ affectedRows: 1 }]); // For password update

      const result = await Usuario.cambiarPassword(userId, currentPasswordPlain, newPasswordPlain);
      expect(result).toBe(true);
      expect(query).toHaveBeenCalledTimes(3); // buscarPorId, getHashedPassword, updatePassword
      // Check that the new password set in the DB is the hashed version of newPasswordPlain
      const newHashedPasswordAttempt = query.mock.calls[2][1][0]; // Third call, second arg, first element
      expect(await bcrypt.compare(newPasswordPlain, newHashedPasswordAttempt)).toBe(true);
    });

    it('should throw NotFoundError if user not found', async () => {
      query.mockResolvedValueOnce([[]]); // buscarPorId returns no user
      await expect(Usuario.cambiarPassword(999, currentPasswordPlain, newPasswordPlain))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessLogicError if user is inactive', async () => {
      query.mockResolvedValueOnce([[{ id: userId, username: 'testuser', activo: false }]]); // buscarPorId finds inactive user
      await expect(Usuario.cambiarPassword(userId, currentPasswordPlain, newPasswordPlain))
        .rejects.toThrow(BusinessLogicError);
      await expect(Usuario.cambiarPassword(userId, currentPasswordPlain, newPasswordPlain))
        .rejects.toThrow('Usuario inactivo');
    });

    it('should throw BusinessLogicError for incorrect current password', async () => {
      query.mockResolvedValueOnce([[{ id: userId, username: 'testuser', activo: true }]]);
      query.mockResolvedValueOnce([[{ password: hashedPassword }]]);

      await expect(Usuario.cambiarPassword(userId, 'wrongCurrentPassword', newPasswordPlain))
        .rejects.toThrow(BusinessLogicError);
      await expect(Usuario.cambiarPassword(userId, 'wrongCurrentPassword', newPasswordPlain))
        .rejects.toThrow('La contraseña actual es incorrecta');
    });

    it('should throw ValidationError if new password is too short', async () => {
      query.mockResolvedValueOnce([[{ id: userId, username: 'testuser', activo: true }]]);
      query.mockResolvedValueOnce([[{ password: hashedPassword }]]);

      await expect(Usuario.cambiarPassword(userId, currentPasswordPlain, 'short'))
        .rejects.toThrow(ValidationError);
      await expect(Usuario.cambiarPassword(userId, currentPasswordPlain, 'short'))
        .rejects.toThrow('La nueva contraseña debe tener al menos 6 caracteres');
    });

    it('should throw error for DB error during password update', async () => {
        query.mockResolvedValueOnce([[{ id: userId, username: 'testuser', activo: true }]]);
        query.mockResolvedValueOnce([[{ password: hashedPassword }]]);
        const dbError = new Error("DB update error");
        query.mockRejectedValueOnce(dbError); // Error on password update query

        await expect(Usuario.cambiarPassword(userId, currentPasswordPlain, newPasswordPlain))
            .rejects.toThrow(dbError);
    });
  });
});
