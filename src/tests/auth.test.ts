import request from 'supertest';
import app from '../index';

describe('Authentication API', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        role: 'cashier',
        first_name: 'Test',
        last_name: 'User',
        phone: '+905551234567',
      };

      const response = await request(app.app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
        role: 'cashier',
        first_name: 'Test',
        last_name: 'User',
      };

      await request(app.app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const response = await request(app.app)
        .post('/api/v1/auth/login')
        .send(credentials)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      await request(app.app)
        .post('/api/v1/auth/login')
        .send(credentials)
        .expect(401);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app.app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
