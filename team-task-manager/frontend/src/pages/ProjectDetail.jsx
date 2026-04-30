import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const isOverdue = (task) =>
  task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();

const StatusBadge = ({ status }) => <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>;
const PriorityBadge = ({ priority }) => <span className={`badge badge-${priority}`}>{priority}</span>;

const EMPTY_TASK = { title: '', description: '', status: 'todo', priority: 'medium', due_date: '', assignee_id: '' };

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');

  // Modals
  const [taskModal, setTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [memberModal, setMemberModal] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isProjectAdmin = () => {
    if (user?.role === 'admin') return true;
    const m = members.find(m => m.id === user?.id);
    return project?.owner_id === user?.id || (m && m.project_role === 'admin');
  };

  const load = useCallback(() => {
    Promise.all([
      api.get(`/projects/${id}`),
      api.get('/tasks', { params: { projectId: id } }),
      api.get('/tasks/users/list'),
      api.get(`/projects/${id}/stats`)
    ]).then(([projRes, tasksRes, usersRes, statsRes]) => {
      setProject(projRes.data.project);
      setMembers(projRes.data.members);
      setTasks(tasksRes.data.tasks);
      setUsers(usersRes.data.users);
      setStats(statsRes.data.stats);
    }).catch(() => navigate('/projects'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openCreateTask = () => {
    setEditTask(null);
    setTaskForm(EMPTY_TASK);
    setError('');
    setTaskModal(true);
  };

  const openEditTask = (task) => {
    setEditTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
      assignee_id: task.assignee_id || ''
    });
    setError('');
    setTaskModal(true);
  };

  const handleTaskSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...taskForm, project_id: Number(id), assignee_id: taskForm.assignee_id || null };
      if (editTask) {
        await api.put(`/tasks/${editTask.id}`, payload);
      } else {
        await api.post('/tasks', payload);
      }
      setTaskModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete task');
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus });
      load();
    } catch {}
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberId) return;
    try {
      await api.post(`/projects/${id}/members`, { userId: Number(newMemberId), role: 'member' });
      setNewMemberId('');
      setMemberModal(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    try {
      await api.delete(`/projects/${id}/members/${userId}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm(`Delete "${project.name}" and all its tasks?`)) return;
    try {
      await api.delete(`/projects/${id}`);
      navigate('/projects');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete project');
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const nonMembers = users.filter(u => !members.find(m => m.id === u.id));

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  const pct = stats?.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div>
      <Link to="/projects" className="page-back">← Back to Projects</Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{project?.name}</h1>
          <p className="page-subtitle">{project?.description || 'No description'}</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
            <span className="info-chip">👤 {project?.owner_name}</span>
            <span className="info-chip">👥 {members.length} members</span>
            <span className="info-chip">📋 {stats?.total || 0} tasks</span>
            {stats?.overdue > 0 && <span className="badge badge-overdue">⚠️ {stats.overdue} overdue</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isProjectAdmin() && (
            <button className="btn btn-danger btn-sm" onClick={handleDeleteProject}>Delete</button>
          )}
        </div>
      </div>

      {stats?.total > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>
            <span>Overall Progress</span>
            <span>{pct}% complete</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }}></div>
          </div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '12px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text2)' }}>📋 {stats?.todo} Todo</span>
            <span style={{ color: 'var(--accent)' }}>⏳ {stats?.in_progress} In Progress</span>
            <span style={{ color: 'var(--green)' }}>✅ {stats?.done} Done</span>
            {stats?.overdue > 0 && <span style={{ color: 'var(--accent2)' }}>🚨 {stats?.overdue} Overdue</span>}
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
          Tasks ({tasks.length})
        </button>
        <button className={`tab ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
          Members ({members.length})
        </button>
      </div>

      {activeTab === 'tasks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="filters">
              <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <select className="filter-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            {isProjectAdmin() && (
              <button className="btn btn-primary btn-sm" onClick={openCreateTask}>+ Add Task</button>
            )}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-title">No tasks found</div>
              <div className="empty-desc">
                {isProjectAdmin() ? 'Add your first task to get started' : 'No tasks match your filters'}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="tasks-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Assignee</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(task => (
                    <tr key={task.id} className={isOverdue(task) ? 'overdue-row' : ''}>
                      <td className="task-title-cell">
                        {task.title}
                        {task.description && <small>{task.description.slice(0, 60)}{task.description.length > 60 ? '...' : ''}</small>}
                        {isOverdue(task) && <span className="text-overdue"> · overdue</span>}
                      </td>
                      <td>
                        {(isProjectAdmin() || task.assignee_id === user?.id) ? (
                          <select
                            className="filter-select"
                            value={task.status}
                            onChange={e => handleStatusChange(task, e.target.value)}
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                          >
                            <option value="todo">Todo</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                        ) : (
                          <StatusBadge status={task.status} />
                        )}
                      </td>
                      <td><PriorityBadge priority={task.priority} /></td>
                      <td style={{ fontSize: '13px' }}>
                        {task.assignee_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                              {task.assignee_name[0]}
                            </div>
                            {task.assignee_name}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text3)' }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ fontSize: '13px', color: isOverdue(task) ? 'var(--accent2)' : 'var(--text2)' }}>
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {isProjectAdmin() && (
                            <>
                              <button className="btn btn-ghost btn-sm" onClick={() => openEditTask(task)}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(task.id)}>Del</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div>
          <div className="section-header" style={{ marginBottom: '16px' }}>
            <h2 className="section-title">Team Members</h2>
            {isProjectAdmin() && (
              <button className="btn btn-primary btn-sm" onClick={() => setMemberModal(true)}>+ Add Member</button>
            )}
          </div>

          <div className="members-list">
            {members.map(m => (
              <div className="member-row" key={m.id}>
                <div className="member-info">
                  <div className="member-avatar">{m.name[0].toUpperCase()}</div>
                  <div>
                    <div className="member-name">{m.name} {m.id === project?.owner_id && '(Owner)'}</div>
                    <div className="member-email">{m.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`badge badge-${m.project_role}`}>{m.project_role}</span>
                  {isProjectAdmin() && m.id !== project?.owner_id && m.id !== user?.id && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.id)}>Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Modal */}
      {taskModal && (
        <div className="modal-overlay" onClick={() => setTaskModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editTask ? 'Edit Task' : 'Create Task'}</h2>
            {error && <div className="form-error">⚠️ {error}</div>}
            <form onSubmit={handleTaskSave}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={3} value={taskForm.description}
                  onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={taskForm.status}
                    onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}>
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-input" value={taskForm.priority}
                    onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Assignee</label>
                  <select className="form-input" value={taskForm.assignee_id}
                    onChange={e => setTaskForm({ ...taskForm, assignee_id: e.target.value })}>
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-input" value={taskForm.due_date}
                    onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {memberModal && (
        <div className="modal-overlay" onClick={() => setMemberModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Add Member</h2>
            <form onSubmit={handleAddMember}>
              <div className="form-group">
                <label className="form-label">Select User</label>
                <select className="form-input" value={newMemberId}
                  onChange={e => setNewMemberId(e.target.value)} required>
                  <option value="">Choose a user...</option>
                  {nonMembers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
              {nonMembers.length === 0 && (
                <p style={{ fontSize: '14px', color: 'var(--text2)' }}>All registered users are already members.</p>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setMemberModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!newMemberId}>Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
