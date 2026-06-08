const test = require('node:test');
const assert = require('node:assert');
const { registerUser, users } = require('./auth.js');

test.describe('User Registration', () => {
  test.beforeEach(() => {
    // Clear users array before each test to ensure isolation
    users.length = 0;
  });

  test('should successfully register a new user', () => {
    const email = 'test@example.com';
    const password = 'password123';
    const user = registerUser(email, password);

    assert.strictEqual(user.email, email);
    assert.ok(user.id);
    assert.ok(user.passwordHash);
    assert.ok(user.salt);
    assert.strictEqual(users.length, 1);
    assert.strictEqual(users[0], user);
  });

  test('should throw error for duplicate email', () => {
    const email = 'duplicate@example.com';
    const password = 'password123';
    registerUser(email, password);

    assert.throws(() => {
      registerUser(email, 'otherpassword');
    }, { message: 'Email already exists' });
  });

  test('should throw error for invalid email format', () => {
    assert.throws(() => {
      registerUser('invalid-email', 'password123');
    }, { message: 'Invalid email format' });

    assert.throws(() => {
      registerUser('', 'password123');
    }, { message: 'Invalid email format' });
  });

  test('should throw error for short password', () => {
    assert.throws(() => {
      registerUser('test@example.com', 'short');
    }, { message: 'Password must be at least 8 characters long' });
  });
});
