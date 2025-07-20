const request = require('supertest');
const app = require('../../app');

describe('Auth API', () => {
  let userId, refreshToken;

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'apiuser@example.com', password: 'pw123456' });
    expect(res.statusCode).toBe(201);
    expect(res.body.user.email).toBe('apiuser@example.com');
  });

  it('should login and return tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'apiuser@example.com', password: 'pw123456' });
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    userId = res.body.user.id;
    refreshToken = res.body.refreshToken;
  });

  it('should refresh access token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('should logout', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ userId });
    expect(res.statusCode).toBe(200);
    expect(res.body.result).toBe('OK');
  });
});