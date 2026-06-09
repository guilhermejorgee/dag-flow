const express = require('express');
const jwt = require('jsonwebtoken');
const { users } = require('./db');
const { authenticate, authorize, JWT_SECRET } = require('./middleware');

const app = express();
app.use(express.json());

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
  res.json({ token });
});

app.get('/admin-data', authenticate, authorize(['ADMIN']), (req, res) => {
  res.json({ message: 'Welcome Admin', data: 'Sensitive admin information' });
});

app.get('/editor-data', authenticate, authorize(['ADMIN', 'EDITOR']), (req, res) => {
  res.json({ message: 'Welcome Editor/Admin', data: 'Editor specific information' });
});

app.get('/super-admin-data', authenticate, authorize(['SUPER-ADMIN']), (req, res) => {
  res.json({ message: 'Welcome Super-Admin', data: 'Super secret data' });
});

app.delete('/users/:id', authenticate, authorize(['SUPER-ADMIN']), (req, res) => {
  const id = parseInt(req.params.id);
  const index = users.findIndex(u => u.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  users.splice(index, 1);
  res.status(200).json({ message: 'User deleted' });
});

module.exports = app;
