const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/users
router.get('/', authenticate, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY name').all();
  res.json({ users });
});

// GET /api/users/:id
router.get('/:id', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// PUT /api/users/:id/role (admin only)
router.put('/:id/role', authenticate, requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or member' });
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.params.id);
  res.json({ user });
});

module.exports = router;
