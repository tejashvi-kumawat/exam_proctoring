// frontend/src/components/AdminPanel.jsx
import React, { useState, useEffect } from 'react';
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
    if (!user?.is_staff && !user?.is_instructor) {
      navigate('/admin');
      return;
    }
    fetchAdminData();
  }, [user]);

  const fetchAdminData = async () => {
    try {
      // Fetch admin statistics
      const statsResponse = await api.get('/exam/admin/stats/');
      setStats(statsResponse.data);

      // Fetch recent attempts
      const attemptsResponse = await api.get('/exam/admin/recent-attempts/');
      setRecentAttempts(attemptsResponse.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

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
          <Logo size="small" onClick={() => navigate('/dashboard')} />
          <span className="badge badge-primary">
            <Icon name="Shield" size={12} />
            Admin
          </span>
        </div>
        <div className="header-right">
          <button 
            onClick={() => navigate('/admin/questions')}
            className="btn btn-icon"
            data-tooltip="Questions"
          >
            <Icon name="FileText" size={18} />
          </button>
          <button 
            onClick={() => navigate('/admin/instructor-approval')}
            className="btn btn-icon"
            data-tooltip="Approvals"
          >
            <Icon name="UserCheck" size={18} />
          </button>
          <button 
            onClick={() => navigate('/admin/monitor')}
            className="btn btn-sm btn-primary"
          >
            <Icon name="Eye" size={16} />
            Monitor
          </button>
          <button 
            onClick={logout} 
            className="btn btn-sm btn-secondary"
          >
            <Icon name="LogOut" size={16} />
            Logout
          </button>
        </div>
      </header>

      <div className="page-content">
        {/* Stats Overview */}
        <div className="stats-row">
          <div className="stat-card-pro">
            <div className="stat-icon-pro">
              <Icon name="BookOpen" size={22} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="stat-content-pro">
              <span className="stat-value-pro">{stats.total_exams || 0}</span>
              <span className="stat-label-pro">Total Exams</span>
            </div>
          </div>
          <div className="stat-card-pro">
            <div className="stat-icon-pro">
              <Icon name="Users" size={22} style={{ color: 'var(--success)' }} />
            </div>
            <div className="stat-content-pro">
              <span className="stat-value-pro">{stats.active_students || 0}</span>
              <span className="stat-label-pro">Active Students</span>
            </div>
          </div>
          <div className="stat-card-pro">
            <div className="stat-icon-pro">
              <Icon name="FileText" size={22} style={{ color: 'var(--warning)' }} />
            </div>
            <div className="stat-content-pro">
              <span className="stat-value-pro">{stats.total_attempts || 0}</span>
              <span className="stat-label-pro">Total Attempts</span>
            </div>
          </div>
          <div className="stat-card-pro">
            <div className="stat-icon-pro">
              <Icon name="AlertTriangle" size={22} style={{ color: 'var(--danger)' }} />
            </div>
            <div className="stat-content-pro">
              <span className="stat-value-pro">{stats.violations_today || 0}</span>
              <span className="stat-label-pro">Violations Today</span>
            </div>
          </div>
        </div>

        {/* Recent Exam Attempts */}
        <div className="recent-attempts">
          <h2>Recent Exam Attempts</h2>
          <div className="attempts-table">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Exam</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Start Time</th>
                  <th>Violations</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentAttempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{attempt.user_name}</td>
                    <td>{attempt.exam_title}</td>
                    <td>
                      <span className={`status ${attempt.status.toLowerCase()}`}>
                        {attempt.status}
                      </span>
                    </td>
                    <td>
                      {attempt.score !== null ? `${attempt.score}/${attempt.total_marks}` : '-'}
                    </td>
                    <td>{new Date(attempt.start_time).toLocaleString()}</td>
                    <td>
                      <span className="violations-count">
                        {attempt.violations_count || 0}
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => navigate(`/admin/attempt/${attempt.id}`)}
                        className="btn btn-sm btn-outline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="actions-grid">
            <button 
              onClick={() => navigate('/admin/create-exam')}
              className="action-card"
            >
              <span className="action-icon">
                <Icon name="FileEdit" size={32} />
              </span>
              <h3>Create New Exam</h3>
              <p>Set up a new examination</p>
            </button>
            
            <button 
              onClick={() => navigate('/admin/questions')}
              className="action-card"
            >
              <span className="action-icon">
                <Icon name="HelpCircle" size={32} />
              </span>
              <h3>Manage Questions</h3>
              <p>Add, edit, or delete questions</p>
            </button>
            
            <button 
              onClick={() => navigate('/admin/users')}
              className="action-card"
            >
              <span className="action-icon">
                <Icon name="Users" size={32} />
              </span>
              <h3>Manage Users</h3>
              <p>View and manage student accounts</p>
            </button>
            
            <button 
              onClick={() => navigate('/admin/reports')}
              className="action-card"
            >
              <span className="action-icon">
                <Icon name="BarChart3" size={32} />
              </span>
              <h3>View Reports</h3>
              <p>Generate exam and violation reports</p>
            </button>
          </div>
        </div>

        {/* Data Management */}
        <div className="data-management" style={{ marginTop: '40px', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
          <h2>Data Management</h2>
          <div className="danger-zone" style={{ padding: '20px', background: '#fff5f5', border: '2px solid var(--danger-color)', borderRadius: '8px', marginTop: '15px' }}>
            <h3 style={{ color: 'var(--danger-color)', display: 'flex', alignItems: 'center', marginTop: 0 }}>
              <Icon name="AlertTriangle" size={20} style={{ marginRight: '8px' }} />
              Danger Zone
            </h3>
            <p style={{ color: 'var(--gray-700)', lineHeight: '1.6' }}>
              Delete all exam data to free up space (512MB limit). This will delete all exams, questions, answers, attempts, and uploaded images. <strong>Subjects will be preserved.</strong>
            </p>
            <button
              onClick={async () => {
                const confirm = window.confirm(
                  '⚠️ WARNING: This will delete ALL exam data including:\n\n' +
                  '- All exams\n' +
                  '- All questions and options\n' +
                  '- All answers and uploaded images\n' +
                  '- All exam attempts\n' +
                  '- All activity logs\n\n' +
                  'This action CANNOT be undone!\n\n' +
                  'Are you absolutely sure?'
                );
                if (confirm) {
                  const finalConfirm = window.confirm('FINAL CONFIRMATION: Are you 100% sure you want to delete ALL exam data?');
                  if (finalConfirm) {
                    try {
                      const response = await api.delete('/exam/admin/delete-all-data/', {
                        data: { confirm: true }
                      });
                      alert(`Success! Deleted:\n${JSON.stringify(response.data.deleted_counts, null, 2)}\n\nSubjects preserved: ${response.data.subjects_preserved}`);
                      window.location.reload();
                    } catch (error) {
                      console.error('Error deleting data:', error);
                      alert('Error deleting data: ' + (error.response?.data?.error || error.message));
                    }
                  }
                }
              }}
              className="btn btn-danger"
              style={{ marginTop: '15px' }}
            >
              <Icon name="Trash2" size={18} style={{ marginRight: '8px' }} />
              Delete All Exam Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

