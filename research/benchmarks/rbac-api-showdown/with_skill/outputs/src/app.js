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

module.exports = app;
