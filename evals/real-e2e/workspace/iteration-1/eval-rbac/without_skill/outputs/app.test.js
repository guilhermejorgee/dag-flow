const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('./app');

test('RBAC API Tests', async (t) => {
  let adminToken;
  let editorToken;
  let viewerToken;

  await t.test('POST /login with valid admin credentials should return JWT', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'admin', password: 'password' });
    
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    adminToken = res.body.token;
  });

  await t.test('POST /login with valid editor credentials should return JWT', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'editor', password: 'password' });
    
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    editorToken = res.body.token;
  });

  await t.test('POST /login with valid viewer credentials should return JWT', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'viewer', password: 'password' });
    
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    viewerToken = res.body.token;
  });

  await t.test('POST /login with invalid credentials should return 401', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'admin', password: 'wrongpassword' });
    
    assert.strictEqual(res.status, 401);
  });

  await t.test('GET /admin-data with admin token should return 200', async () => {
    const res = await request(app)
      .get('/admin-data')
      .set('Authorization', `Bearer ${adminToken}`);
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.message, 'Welcome Admin');
  });

  await t.test('GET /admin-data with editor token should return 403', async () => {
    const res = await request(app)
      .get('/admin-data')
      .set('Authorization', `Bearer ${editorToken}`);
    
    assert.strictEqual(res.status, 403);
  });

  await t.test('GET /admin-data with viewer token should return 403', async () => {
    const res = await request(app)
      .get('/admin-data')
      .set('Authorization', `Bearer ${viewerToken}`);
    
    assert.strictEqual(res.status, 403);
  });

  await t.test('GET /admin-data without token should return 401', async () => {
    const res = await request(app)
      .get('/admin-data');
    
    assert.strictEqual(res.status, 401);
  });

  await t.test('GET /editor-data with admin token should return 200', async () => {
    const res = await request(app)
      .get('/editor-data')
      .set('Authorization', `Bearer ${adminToken}`);
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.message, 'Welcome Editor');
  });

  await t.test('GET /editor-data with editor token should return 200', async () => {
    const res = await request(app)
      .get('/editor-data')
      .set('Authorization', `Bearer ${editorToken}`);
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.message, 'Welcome Editor');
  });

  await t.test('GET /editor-data with viewer token should return 403', async () => {
    const res = await request(app)
      .get('/editor-data')
      .set('Authorization', `Bearer ${viewerToken}`);
    
    assert.strictEqual(res.status, 403);
  });
});
