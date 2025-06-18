const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const Usuario = require('../../src/models/Usuario'); // Used for direct interaction for setup/teardown if needed

// Global variables for tokens
let adminToken;
let normalUserToken;
let adminUserId;
let normalUserId;

const adminCredentials = { username: 'admin_test', password: 'password123', nombre_completo: 'Admin Test', email: 'admintest@example.com', rol: 'admin' };
const userCredentials = { username: 'user_test', password: 'password123', nombre_completo: 'User Test', email: 'usertest@example.com', rol: 'bodeguero' };
const userToCreateByAdmin = { username: 'created_by_admin', password: 'password123', nombre_completo: 'Created By Admin', email: 'createdbyadmin@example.com', rol: 'facturador' };
let createdByAdminUserId;


describe('Auth API Endpoints (/api/auth)', () => {
  beforeAll(async () => {
    // Clean up existing test users if any, then create fresh ones
    await pool.query("DELETE FROM usuarios WHERE username IN (?, ?, ?)", [adminCredentials.username, userCredentials.username, userToCreateByAdmin.username]);

    // Create admin user directly for consistent testing environment
    const adminUser = await Usuario.crear(adminCredentials);
    adminUserId = adminUser.id;

    // Create normal user directly
    const normalUser = await Usuario.crear(userCredentials);
    normalUserId = normalUser.id;

    // Login as admin to get token
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: adminCredentials.username, password: adminCredentials.password });
    adminToken = adminLoginRes.body.data.token;

    // Login as normal user to get token
    const userLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: userCredentials.username, password: userCredentials.password });
    normalUserToken = userLoginRes.body.data.token;
  });

  afterAll(async () => {
    // Clean up created users
    await pool.query("DELETE FROM usuarios WHERE username LIKE '%_test%' OR username = ?", [userToCreateByAdmin.username]);
    await pool.end(); // Close DB connection
  });

  describe('POST /api/auth/register', () => {
    const newUser = { username: 'register_test', password: 'password123', nombre_completo: 'Register Test', email: 'registertest@example.com', rol: 'bodeguero' };

    afterEach(async () => {
      await pool.query("DELETE FROM usuarios WHERE username = ?", [newUser.username]);
    });

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser);
      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Usuario registrado exitosamente');
      expect(response.body.data.usuario.username).toBe(newUser.username);
      expect(response.body.data).toHaveProperty('token');
    });

    it('should return 400 for missing username', async () => {
      const { username, ...data } = newUser;
      const response = await request(app)
        .post('/api/auth/register')
        .send(data);
      expect(response.statusCode).toBe(400);
      expect(response.body.errors[0].path).toBe('username');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...newUser, email: 'invalidemail' });
      expect(response.statusCode).toBe(400);
      expect(response.body.errors[0].path).toBe('email');
    });

    it('should return 409 for duplicate username', async () => {
      await Usuario.crear({ ...newUser, username: 'existinguser_reg_test', email: 'unique1@example.com'});
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...newUser, username: 'existinguser_reg_test', email: 'unique2@example.com' });
      expect(response.statusCode).toBe(409);
      expect(response.body.message).toBe('El nombre de usuario ya existe.');
      await pool.query("DELETE FROM usuarios WHERE username = ?", ['existinguser_reg_test']);
    });

    it('should return 409 for duplicate email', async () => {
        await Usuario.crear({ ...newUser, username: 'unique_user_reg', email: 'existingemail_reg@example.com'});
        const response = await request(app)
          .post('/api/auth/register')
          .send({ ...newUser, username: 'another_unique_user', email: 'existingemail_reg@example.com' });
        expect(response.statusCode).toBe(409);
        expect(response.body.message).toBe('El email ya está registrado.');
        await pool.query("DELETE FROM usuarios WHERE email = ?", ['existingemail_reg@example.com']);
      });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: userCredentials.username, password: userCredentials.password });
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.usuario.username).toBe(userCredentials.username);
    });

    it('should return 401 for non-existent username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistentuser', password: 'password123' });
      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe('Credenciales inválidas');
    });

    it('should return 401 for incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: userCredentials.username, password: 'wrongpassword' });
      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe('Credenciales inválidas');
    });

    it('should return 400 for missing username', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ password: 'password123' });
        expect(response.statusCode).toBe(400);
        expect(response.body.errors[0].path).toBe('username');
    });
  });

  describe('GET /api/auth/perfil', () => {
    it('should get profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${normalUserToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.usuario.username).toBe(userCredentials.username);
    });

    it('should return 401 if no token provided', async () => {
      const response = await request(app).get('/api/auth/perfil');
      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe('No se proporcionó token de autenticación');
    });

    it('should return 401 if token is invalid', async () => {
      const response = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', 'Bearer invalidtoken123');
      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe('Token inválido');
    });
  });

  describe('PUT /api/auth/perfil', () => {
    it('should update profile successfully', async () => {
      const response = await request(app)
        .put('/api/auth/perfil')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({ nombre_completo: 'User Test Updated' });
      expect(response.statusCode).toBe(200);
      expect(response.body.data.usuario.nombre_completo).toBe('User Test Updated');
    });

    it('should return 400 for invalid email format if email is updated', async () => {
      const response = await request(app)
        .put('/api/auth/perfil')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({ email: 'invalidemail' });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      const response = await request(app)
        .put('/api/auth/cambiar-password')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({ password_actual: 'password123', password_nuevo: 'newpassword456' });
      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('Contraseña actualizada exitosamente');

      // Verify new password by logging in again
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: userCredentials.username, password: 'newpassword456' });
      expect(loginResponse.statusCode).toBe(200);

      // Revert password for other tests
      await request(app)
        .put('/api/auth/cambiar-password')
        .set('Authorization', `Bearer ${normalUserToken}`) // Need new token if session invalidated
        .send({ password_actual: 'newpassword456', password_nuevo: 'password123' });
    });

    it('should return 400 for incorrect current password', async () => {
      const response = await request(app)
        .put('/api/auth/cambiar-password')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({ password_actual: 'wrongcurrentpassword', password_nuevo: 'newpassword123' });
      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('La contraseña actual es incorrecta.');
    });
  });

  // Admin User Management Endpoints (mounted at /api/auth/usuarios)
  describe('Admin User Management (/api/auth/usuarios)', () => {
    it('POST /usuarios - should allow admin to create a user', async () => {
      const response = await request(app)
        .post('/api/auth/usuarios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userToCreateByAdmin);
      expect(response.statusCode).toBe(201);
      expect(response.body.data.usuario.username).toBe(userToCreateByAdmin.username);
      createdByAdminUserId = response.body.data.usuario.id; // Save for later tests
    });

    it('POST /usuarios - should deny non-admin to create a user', async () => {
      const response = await request(app)
        .post('/api/auth/usuarios')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({ ...userToCreateByAdmin, username: 'another_user_attempt' });
      expect(response.statusCode).toBe(403);
      expect(response.body.message).toBe('No tienes permisos para realizar esta acción');
    });

    it('GET /usuarios - should allow admin to list users', async () => {
      const response = await request(app)
        .get('/api/auth/usuarios')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.usuarios)).toBe(true);
      expect(response.body.data.usuarios.length).toBeGreaterThanOrEqual(3); // admin, normalUser, createdByAdmin
    });

    it('PUT /usuarios/:id - should allow admin to update another user', async () => {
      const response = await request(app)
        .put(`/api/auth/usuarios/${normalUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rol: 'admin', nombre_completo: 'User Test Promoted' });
      expect(response.statusCode).toBe(200);
      expect(response.body.data.usuario.rol).toBe('admin');
      expect(response.body.data.usuario.nombre_completo).toBe('User Test Promoted');
      // Revert for other tests
      await Usuario.actualizar(normalUserId, { rol: 'bodeguero', nombre_completo: 'User Test'});
    });

    it('PUT /usuarios/:id - should prevent admin from updating self via this route', async () => {
        const response = await request(app)
          .put(`/api/auth/usuarios/${adminUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ rol: 'bodeguero' });
        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe('No puedes modificarte a ti mismo desde esta ruta');
    });

    it('DELETE /usuarios/:id - should allow admin to deactivate another user', async () => {
      if (!createdByAdminUserId) { // Ensure user exists from previous test
        const tempUser = await Usuario.crear({ ...userToCreateByAdmin, username: "temp_for_delete", email: "temp_del@example.com"});
        createdByAdminUserId = tempUser.id;
      }
      const response = await request(app)
        .delete(`/api/auth/usuarios/${createdByAdminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('Usuario desactivado exitosamente');

      // Verify user is inactive (optional, direct DB check or use an admin get user by ID if exists)
      const deactivatedUser = await Usuario.buscarPorId(createdByAdminUserId); // buscarPorId gets even inactive
      expect(deactivatedUser.activo).toBe(false);
    });

    it('DELETE /usuarios/:id - should prevent admin from deactivating self', async () => {
      const response = await request(app)
        .delete(`/api/auth/usuarios/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('No puedes desactivarte a ti mismo');
    });
  });
});
