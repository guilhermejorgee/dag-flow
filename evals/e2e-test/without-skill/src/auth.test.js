const test = require('node:test');
const assert = require('node:assert');
const { users, registerUser } = require('./auth.js');

test('registerUser', async (t) => {
  // Clear the users array before tests to ensure test isolation
  t.beforeEach(() => {
    users.length = 0;
  });

  await t.test('successfully registers a valid user', () => {
    const user = registerUser('test@example.com', 'password123');
    assert.ok(user.id);
    assert.strictEqual(user.email, 'test@example.com');
    assert.ok(user.passwordHash);
    assert.ok(user.salt);
    assert.notStrictEqual(user.passwordHash, 'password123'); // Ensure it's hashed
    assert.strictEqual(users.length, 1);
    assert.deepStrictEqual(users[0], user);
  });

  await t.test('throws error for invalid email format', () => {
    assert.throws(() => {
      registerUser('invalidemail', 'password123');
    }, /Invalid email format/);
    
    assert.throws(() => {
      registerUser(null, 'password123');
    }, /Invalid email format/);
  });

  await t.test('throws error for short password', () => {
    assert.throws(() => {
      registerUser('test2@example.com', 'short');
    }, /Password must be at least 8 characters long/);
  });

  await t.test('throws error for existing email', () => {
    registerUser('duplicate@example.com', 'password123');
    assert.throws(() => {
      registerUser('duplicate@example.com', 'newpassword123');
    }, /Email already exists/);
  });
});
