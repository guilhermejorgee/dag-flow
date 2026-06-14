const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { JWT_SECRET } = require('../src/middleware');

test('RBAC API Unit Tests', async (t) => {
  const adminToken = jwt.sign({ username: 'admin', role: 'ADMIN' }, JWT_SECRET);
  const editorToken = jwt.sign({ username: 'editor', role: 'EDITOR' }, JWT_SECRET);
  const viewerToken = jwt.sign({ username: 'viewer', role: 'VIEWER' }, JWT_SECRET);

  await t.test('POST /login', async (t) => {
    await t.test('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send({ username: 'admin', password: 'password123' });
      
      assert.strictEqual(response.status, 200);
      assert.ok(response.body.token);
    });

    await t.test('should fail login with invalid credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send({ username: 'admin', password: 'wrongpassword' });
      
      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.error, 'Invalid credentials');
    });
  });

  await t.test('GET /admin-data (Admin Only)', async (t) => {
    await t.test('should allow access to ADMIN', async () => {
      const response = await request(app)
        .get('/admin-data')
        .set('Authorization', `Bearer ${adminToken}`);
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.message, 'Welcome Admin');
    });

    await t.test('should deny access to EDITOR', async () => {
      const response = await request(app)
        .get('/admin-data')
        .set('Authorization', `Bearer ${editorToken}`);
      
      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.error, 'Forbidden: Insufficient permissions');
    });

    await t.test('should deny access to VIEWER', async () => {
      const response = await request(app)
        .get('/admin-data')
        .set('Authorization', `Bearer ${viewerToken}`);
      
      assert.strictEqual(response.status, 403);
    });

    await t.test('should return 401 for missing token', async () => {
      const response = await request(app).get('/admin-data');
      assert.strictEqual(response.status, 401);
    });
  });

  await t.test('GET /editor-data (Admin and Editor)', async (t) => {
    await t.test('should allow access to ADMIN', async () => {
      const response = await request(app)
        .get('/editor-data')
        .set('Authorization', `Bearer ${adminToken}`);
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.message, 'Welcome Editor/Admin');
    });

    await t.test('should allow access to EDITOR', async () => {
      const response = await request(app)
        .get('/editor-data')
        .set('Authorization', `Bearer ${editorToken}`);
      
      assert.strictEqual(response.status, 200);
    });

    await t.test('should deny access to VIEWER', async () => {
      const response = await request(app)
        .get('/editor-data')
        .set('Authorization', `Bearer ${viewerToken}`);
      
      assert.strictEqual(response.status, 403);
    });
  });
});
