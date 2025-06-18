const request = require('supertest');
const app = require('../src/app'); // Adjust path to your Express app instance
const { pool } = require('../src/config/database'); // To close DB connection

describe('App Setup', () => {
  afterAll(async () => {
    await pool.end(); // Ensure database connections are closed after all tests
  });

  it('should respond with API info for GET /', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeDefined();
    expect(response.body.message).toEqual('API de Inventario Médico');
    expect(response.body.status).toEqual('OK');
  });

  it('should export the app instance', () => {
    expect(app).toBeDefined();
  });
});
