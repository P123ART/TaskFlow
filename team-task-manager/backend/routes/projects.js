const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticate, requireProjectAdmin } = require('../middleware/auth');

// GET /api/projects - list projects for current user
router.get('/', authenticate, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, u.name as owner_name,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
      (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
    FROM projects p
    JOIN users u ON p.owner_id = u.id
    WHERE p.owner_id = ? OR p.id IN (
      SELECT project_id FROM project_members WHERE user_id = ?
    )
    ORDER BY p.created_at DESC
  `).all(req.user.id, req.user.id);

  res.json({ projects });
});

// POST /api/projects - create project (admin only)
router.post('/', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create projects' });
  }

  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const result = db.prepare(
    'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)'
  ).run(name, description || '', req.user.id);

  // Add owner as admin member
  db.prepare(
    'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
  ).run(result.lastInsertRowid, req.user.id, 'admin');

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ project });
});

// GET /api/projects/:id
router.get('/:id', authenticate, (req, res) => {
  const project = db.prepare(`
    SELECT p.*, u.name as owner_name
    FROM projects p
    JOIN users u ON p.owner_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Check access
  const isMember = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (project.owner_id !== req.user.id && !isMember && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.role as system_role, pm.role as project_role
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(req.params.id);

  res.json({ project, members });
});

// PUT /api/projects/:id
router.put('/:id', authenticate, requireProjectAdmin, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  db.prepare(
    'UPDATE projects SET name = ?, description = ? WHERE id = ?'
  ).run(name, description || '', req.params.id);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ project });
});

// DELETE /api/projects/:id
router.delete('/:id', authenticate, requireProjectAdmin, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ message: 'Project deleted' });
});

// POST /api/projects/:id/members - add member
router.post('/:id/members', authenticate, requireProjectAdmin, (req, res) => {
  const { userId, role } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.id, userId);

  if (existing) return res.status(409).json({ error: 'User already a member' });

  db.prepare(
    'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
  ).run(req.params.id, userId, role || 'member');

  res.status(201).json({ message: 'Member added', user });
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', authenticate, requireProjectAdmin, (req, res) => {
  db.prepare(
    'DELETE FROM project_members WHERE project_id = ? AND user_id = ?'
  ).run(req.params.id, req.params.userId);

  res.json({ message: 'Member removed' });
});

// GET /api/projects/:id/stats
router.get('/:id/stats', authenticate, (req, res) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN due_date < DATE('now') AND status != 'done' THEN 1 ELSE 0 END) as overdue
    FROM tasks WHERE project_id = ?
  `).get(req.params.id);

  res.json({ stats });
});

module.exports = router;
