const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticate } = require('../middleware/auth');

// Helper: check if user can access project
const canAccessProject = (projectId, userId, userRole) => {
  const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId);
  if (!project) return false;
  if (project.owner_id === userId || userRole === 'admin') return true;
  const member = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, userId);
  return !!member;
};

const canManageTask = (projectId, userId, userRole) => {
  const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId);
  if (!project) return false;
  if (project.owner_id === userId || userRole === 'admin') return true;
  const member = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, userId);
  return member && member.role === 'admin';
};

// GET /api/tasks?projectId=... 
router.get('/', authenticate, (req, res) => {
  const { projectId, status, assigneeId, priority } = req.query;

  let query = `
    SELECT t.*, 
      u.name as assignee_name, 
      u.email as assignee_email,
      cb.name as created_by_name,
      p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users cb ON t.created_by = cb.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (projectId) {
    if (!canAccessProject(projectId, req.user.id, req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    query += ' AND t.project_id = ?';
    params.push(projectId);
  } else {
    // Only tasks from projects user is member of
    query += ` AND (p.owner_id = ? OR t.project_id IN (
      SELECT project_id FROM project_members WHERE user_id = ?
    ))`;
    params.push(req.user.id, req.user.id);
  }

  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (assigneeId) { query += ' AND t.assignee_id = ?'; params.push(assigneeId); }
  if (priority) { query += ' AND t.priority = ?'; params.push(priority); }

  query += ' ORDER BY t.created_at DESC';

  const tasks = db.prepare(query).all(...params);
  res.json({ tasks });
});

// POST /api/tasks
router.post('/', authenticate, (req, res) => {
  const { title, description, status, priority, due_date, project_id, assignee_id } = req.body;

  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });

  if (!canManageTask(project_id, req.user.id, req.user.role)) {
    return res.status(403).json({ error: 'Only project admins can create tasks' });
  }

  const result = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, due_date, project_id, assignee_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    description || '',
    status || 'todo',
    priority || 'medium',
    due_date || null,
    project_id,
    assignee_id || null,
    req.user.id
  );

  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, cb.name as created_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users cb ON t.created_by = cb.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ task });
});

// PUT /api/tasks/:id
router.put('/:id', authenticate, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Members can update their own task status; admins can update all fields
  const isAdmin = canManageTask(task.project_id, req.user.id, req.user.role);
  const isAssignee = task.assignee_id === req.user.id;

  if (!isAdmin && !isAssignee) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { title, description, status, priority, due_date, assignee_id } = req.body;

  if (isAdmin) {
    db.prepare(`
      UPDATE tasks SET 
        title = ?, description = ?, status = ?, priority = ?, 
        due_date = ?, assignee_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title || task.title,
      description !== undefined ? description : task.description,
      status || task.status,
      priority || task.priority,
      due_date !== undefined ? due_date : task.due_date,
      assignee_id !== undefined ? assignee_id : task.assignee_id,
      req.params.id
    );
  } else {
    // Members can only update status
    db.prepare(`
      UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(status || task.status, req.params.id);
  }

  const updated = db.prepare(`
    SELECT t.*, u.name as assignee_name, cb.name as created_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users cb ON t.created_by = cb.id
    WHERE t.id = ?
  `).get(req.params.id);

  res.json({ task: updated });
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticate, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (!canManageTask(task.project_id, req.user.id, req.user.role)) {
    return res.status(403).json({ error: 'Only project admins can delete tasks' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Task deleted' });
});

// GET /api/tasks/dashboard - user's dashboard summary
router.get('/dashboard/summary', authenticate, (req, res) => {
  const myTasks = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN due_date < DATE('now') AND status != 'done' THEN 1 ELSE 0 END) as overdue
    FROM tasks
    WHERE assignee_id = ?
  `).get(req.user.id);

  const recentTasks = db.prepare(`
    SELECT t.*, u.name as assignee_name, p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.assignee_id = ? OR t.created_by = ?
    ORDER BY t.updated_at DESC LIMIT 5
  `).all(req.user.id, req.user.id);

  res.json({ myTasks, recentTasks });
});

// GET /api/users - list all users (for assignment)
router.get('/users/list', authenticate, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role FROM users ORDER BY name').all();
  res.json({ users });
});

module.exports = router;
