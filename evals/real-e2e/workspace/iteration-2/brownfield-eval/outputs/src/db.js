/**
 * In-memory persistence for User objects.
 * User: { id, username, password, role }
 */

const users = [
  { id: 1, username: 'admin', password: 'password123', role: 'ADMIN' },
  { id: 2, username: 'user', password: 'password123', role: 'USER' },
  { id: 3, username: 'superadmin', password: 'password123', role: 'SUPER-ADMIN' }
];

module.exports = {
  users
};
