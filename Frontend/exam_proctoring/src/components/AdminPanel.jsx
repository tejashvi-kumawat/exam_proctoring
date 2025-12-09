// frontend/src/components/AdminPanel.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Icon from './Icon';
import Logo from './Logo';
import './AdminPanel.css';

const AdminPanel = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.is_staff && !(user?.is_instructor && user?.instructor_approved)) {
      navigate('/dashboard');
      return;
    }
    fetchAdminData();
  }, [user, navigate]);

  const fetchAdminData = async () => {
    try {
      const [statsResponse, attemptsResponse] = await Promise.all([
        api.get('/exam/admin/stats/').catch(() => ({ data: {} })),
        api.get('/exam/admin/recent-attempts/').catch(() => ({ data: [] }))
      ]);
      
      setStats(statsResponse.data);
      setRecentAttempts(attemptsResponse.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const insights = useMemo(() => {
    const activeExams = stats.active_exams || 0;
    const pendingGrading = recentAttempts.filter(a => 
      a.status === 'COMPLETED' && !a.results_ready
    ).length;
    const inProgress = recentAttempts.filter(a => 
      ['IN_PROGRESS', 'STARTED'].includes(a.status)
    ).length;
    const highViolations = recentAttempts.filter(a => 
      (a.violations_count || 0) >= 3
    ).length;

    return { activeExams, pendingGrading, inProgress, highViolations };
  }, [stats, recentAttempts]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <header className="header-professional">
        <div className="header-left">
          <Logo size="small" onClick={() => navigate('/admin')} />
          <div className="admin-badge">
            <Icon name="Shield" size={12} />
            ADMIN
          </div>
          <span className="admin-username">{user?.username}</span>
        </div>
        <div className="header-right">
          <button 
            onClick={() => navigate('/dashboard')}
            className="btn btn-sm btn-secondary"
          >
            <Icon name="Home" size={16} />
            <span className="btn-text">Dashboard</span>
          </button>
          <button 
            onClick={logout} 
            className="btn btn-sm btn-secondary"
          >
            <Icon name="LogOut" size={16} />
            <span className="btn-text">Logout</span>
          </button>
        </div>
      </header>

      <div className="page-content">
        <div className="admin-stats-grid">
          <div className="admin-stat-card blue" onClick={() => navigate('/admin/questions')}>
            <div className="stat-header">
              <div className="stat-icon-wrapper">
                <Icon name="BookOpen" size={24} />
              </div>
              <div className="stat-main">
                <div className="stat-value">{stats.total_exams || 0}</div>
                <div className="stat-label">Total Exams</div>
              </div>
            </div>
            {stats.active_exams > 0 && (
              <div className="stat-sub">{stats.active_exams} active</div>
            )}
          </div>

          <div className="admin-stat-card green" onClick={() => navigate('/admin/users')}>
            <div className="stat-header">
              <div className="stat-icon-wrapper">
                <Icon name="Users" size={24} />
              </div>
              <div className="stat-main">
                <div className="stat-value">{stats.active_students || 0}</div>
                <div className="stat-label">Students</div>
              </div>
            </div>
            {insights.inProgress > 0 && (
              <div className="stat-sub">{insights.inProgress} taking exam</div>
            )}
          </div>

          <div className="admin-stat-card orange" onClick={() => navigate('/admin/monitor')}>
            <div className="stat-header">
              <div className="stat-icon-wrapper">
                <Icon name="FileText" size={24} />
              </div>
              <div className="stat-main">
                <div className="stat-value">{stats.total_attempts || 0}</div>
                <div className="stat-label">Attempts</div>
              </div>
            </div>
            {insights.pendingGrading > 0 && (
              <div className="stat-sub">{insights.pendingGrading} need grading</div>
            )}
          </div>

          <div className="admin-stat-card red" onClick={() => navigate('/admin/reports')}>
            <div className="stat-header">
              <div className="stat-icon-wrapper">
                <Icon name="AlertTriangle" size={24} />
              </div>
              <div className="stat-main">
                <div className="stat-value">{stats.violations_today || 0}</div>
                <div className="stat-label">Violations</div>
              </div>
            </div>
            {insights.highViolations > 0 && (
              <div className="stat-sub">{insights.highViolations} high risk</div>
            )}
          </div>
        </div>

        {(insights.pendingGrading > 0 || insights.highViolations > 0) && (
          <div className="action-alerts">
            <div className="alert-header">
              <Icon name="Bell" size={20} />
              <h3>Requires Attention</h3>
            </div>
            <div className="alert-items">
              {insights.pendingGrading > 0 && (
                <div className="alert-item">
                  <span className="alert-text">
                    <strong>{insights.pendingGrading}</strong> exam attempt(s) pending grading
                  </span>
                  <button onClick={() => navigate('/admin/monitor')} className="btn btn-sm btn-primary">
                    Grade Now
                  </button>
                </div>
              )}
              {insights.highViolations > 0 && (
                <div className="alert-item">
                  <span className="alert-text">
                    <strong>{insights.highViolations}</strong> exam(s) with high violations
                  </span>
                  <button onClick={() => navigate('/admin/reports')} className="btn btn-sm btn-danger">
                    Review
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="section-block">
          <h2>Quick Actions</h2>
          <div className="actions-grid">
            {[
              { icon: 'Plus', label: 'Create Exam', desc: 'Set up new exam', path: '/admin/create-exam', color: 'blue' },
              { icon: 'FileText', label: 'Questions', desc: 'Manage questions', path: '/admin/questions', color: 'purple' },
              { icon: 'Eye', label: 'Monitor', desc: 'Live monitoring', path: '/admin/monitor', color: 'orange' },
              { icon: 'Users', label: 'Users', desc: 'Manage students', path: '/admin/users', color: 'green' },
              { icon: 'BarChart3', label: 'Reports', desc: 'View analytics', path: '/admin/reports', color: 'cyan' },
              { icon: 'UserCheck', label: 'Approvals', desc: 'Instructor requests', path: '/admin/instructor-approval', color: 'pink' }
            ].map((action, idx) => (
              <button key={idx} onClick={() => navigate(action.path)} className={`action-card ${action.color}`}>
                <div className="action-icon">
                  <Icon name={action.icon} size={24} />
                </div>
                <div className="action-label">{action.label}</div>
                <div className="action-desc">{action.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="section-block">
          <div className="section-header">
            <h2>Recent Exam Attempts</h2>
            <button onClick={() => navigate('/admin/monitor')} className="btn btn-sm btn-outline">
              View All
              <Icon name="ArrowRight" size={14} />
            </button>
          </div>

          {recentAttempts.length === 0 ? (
            <div className="empty-state">
              <Icon name="FileText" size={48} />
              <h3>No recent attempts</h3>
              <p>Exam attempts will appear here once students start taking exams.</p>
            </div>
          ) : (
            <div className="attempts-table-wrapper">
              <table className="attempts-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Exam</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Violations</th>
                    <th>Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAttempts.slice(0, 10).map((attempt) => (
                    <tr key={attempt.id}>
                      <td className="td-bold">{attempt.user_name}</td>
                      <td>{attempt.exam_title}</td>
                      <td>
                        <span className={`status-badge ${attempt.status.toLowerCase()}`}>
                          {attempt.status}
                        </span>
                      </td>
                      <td className="td-bold">
                        {attempt.score !== null && attempt.score !== undefined 
                          ? `${attempt.score}/${attempt.total_marks}`
                          : '-'}
                      </td>
                      <td>
                        <span className={`violation-badge ${
                          (attempt.violations_count || 0) >= 3 ? 'high'
                          : (attempt.violations_count || 0) > 0 ? 'medium'
                          : 'low'
                        }`}>
                          {attempt.violations_count || 0}
                        </span>
                      </td>
                      <td className="td-muted">{formatDateTime(attempt.start_time)}</td>
                      <td>
                        <button
                          onClick={() => navigate(`/admin/attempt/${attempt.id}`)}
                          className="btn btn-xs btn-primary"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
