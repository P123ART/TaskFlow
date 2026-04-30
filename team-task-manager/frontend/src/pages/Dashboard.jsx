import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const statusBadge = (status) => <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>;
const priorityBadge = (p) => <span className={`badge badge-${p}`}>{p}</span>;

const isOverdue = (task) =>
  task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentTasks, setRecentTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/tasks/dashboard/summary'),
      api.get('/projects')
    ]).then(([taskRes, projRes]) => {
      setStats(taskRes.data.myTasks);
      setRecentTasks(taskRes.data.recentTasks);
      setProjects(projRes.data.projects.slice(0, 4));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Good day, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Here's what's happening across your projects</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card purple">
          <span className="stat-icon">📋</span>
          <div className="stat-value">{stats?.total || 0}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card yellow">
          <span className="stat-icon">⏳</span>
          <div className="stat-value">{(stats?.todo || 0) + (stats?.in_progress || 0)}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card green">
          <span className="stat-icon">✅</span>
          <div className="stat-value">{stats?.done || 0}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card red">
          <span className="stat-icon">🚨</span>
          <div className="stat-value">{stats?.overdue || 0}</div>
          <div className="stat-label">Overdue</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        <div className="card">
          <div className="section-header">
            <h2 className="section-title">Recent Activity</h2>
          </div>
          {recentTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <div className="empty-icon">📝</div>
              <div className="empty-title">No tasks yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentTasks.map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--bg3)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{task.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
                      {task.project_name} {isOverdue(task) && <span className="text-overdue">· overdue</span>}
                    </div>
                  </div>
                  {statusBadge(task.status)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-header">
            <h2 className="section-title">Your Projects</h2>
            <Link to="/projects" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          {projects.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <div className="empty-icon">📁</div>
              <div className="empty-title">No projects</div>
              <div className="empty-desc">Join or create a project</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {projects.map(p => (
                <Link to={`/projects/${p.id}`} key={p.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg3)', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg3)'}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
                        {p.task_count} tasks · {p.member_count} members
                      </div>
                    </div>
                    <span style={{ color: 'var(--text3)', fontSize: '18px' }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
