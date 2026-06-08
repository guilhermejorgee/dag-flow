const crypto = require('crypto');

const users = [];

function registerUser(email, password) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new Error('Invalid email format');
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    throw new Error('Email already exists');
  }

  const id = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');

  const user = {
    id,
    email,
    passwordHash,
    salt
  };

  users.push(user);
  return user;
}

module.exports = {
  users,
  registerUser
};
