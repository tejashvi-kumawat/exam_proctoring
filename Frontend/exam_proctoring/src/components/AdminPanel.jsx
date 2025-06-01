// frontend/src/components/AdminPanel.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
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
      <header className="admin-header">
        <div className="header-content">
          <h1>Admin Panel</h1>
          <div className="header-actions">
            <button 
              onClick={() => navigate('/admin/questions')}
              className="btn btn-primary"
            >
              Manage Questions
            </button>
            <button 
              onClick={() => navigate('/admin/instructor-approval')}
              className="btn btn-primary"
            >
              Instructor Approval
            </button>
            
            <button 
              onClick={() => navigate('/admin/monitor')}
              className="btn btn-secondary"
            >
              Monitor Exams
            </button>
            <button onClick={logout} className="btn btn-outline">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="admin-content">
        {/* Statistics Overview */}
        <div className="stats-overview">
          <h2>System Overview</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Exams</h3>
              <p className="stat-number">{stats.total_exams || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Active Students</h3>
              <p className="stat-number">{stats.active_students || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Total Attempts</h3>
              <p className="stat-number">{stats.total_attempts || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Violations Today</h3>
              <p className="stat-number">{stats.violations_today || 0}</p>
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
              <span className="action-icon">📝</span>
              <h3>Create New Exam</h3>
              <p>Set up a new examination</p>
            </button>
            
            <button 
              onClick={() => navigate('/admin/questions')}
              className="action-card"
            >
              <span className="action-icon">❓</span>
              <h3>Manage Questions</h3>
              <p>Add, edit, or delete questions</p>
            </button>
            
            <button 
              onClick={() => navigate('/admin/users')}
              className="action-card"
            >
              <span className="action-icon">👥</span>
              <h3>Manage Users</h3>
              <p>View and manage student accounts</p>
            </button>
            
            <button 
              onClick={() => navigate('/admin/reports')}
              className="action-card"
            >
              <span className="action-icon">📊</span>
              <h3>View Reports</h3>
              <p>Generate exam and violation reports</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

