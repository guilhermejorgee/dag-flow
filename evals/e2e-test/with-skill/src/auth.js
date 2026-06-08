const crypto = require('crypto');

const users = [];

function registerUser(email, password) {
  // Validation Rules
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email format');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  // Check if email already exists
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    throw new Error('Email already exists');
  }

  // Generate Salt
  const salt = crypto.randomBytes(16).toString('hex');

  // Hash Password
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');

  // Create User
  const newUser = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    salt
  };

  users.push(newUser);

  return newUser;
}

module.exports = {
  users,
  registerUser
};
