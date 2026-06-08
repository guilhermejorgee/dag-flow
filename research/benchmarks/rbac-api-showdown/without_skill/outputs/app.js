const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const SECRET_KEY = 'supersecretkey123';

// In-memory data
const users = [
  { id: 1, username: 'admin', password: 'password', role: 'Admin' },
  { id: 2, username: 'editor', password: 'password', role: 'Editor' },
  { id: 3, username: 'viewer', password: 'password', role: 'Viewer' },
];

// POST /login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// RBAC Middleware
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

// Protected routes
app.get('/admin-data', authenticate, authorize(['Admin']), (req, res) => {
  res.json({ message: 'Welcome Admin' });
});

app.get('/editor-data', authenticate, authorize(['Admin', 'Editor']), (req, res) => {
  res.json({ message: 'Welcome Editor' });
});

module.exports = app;
