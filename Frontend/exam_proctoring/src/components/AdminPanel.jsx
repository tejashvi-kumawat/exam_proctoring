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
  const [activeView, setActiveView] = useState('overview'); // overview, recent, actions

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

  // Calculate insights
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
      {/* Header */}
      <header className="header-professional">
        <div className="header-left">
          <Logo size="small" onClick={() => navigate('/admin')} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              padding: '4px 10px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
            }}>
              <Icon name="Shield" size={12} />
              ADMIN
            </span>
            <span style={{ fontSize: '13px', color: 'var(--gray-600)', fontWeight: '500' }}>
              {user?.username}
            </span>
          </div>
        </div>
        <div className="header-right">
          <button 
            onClick={() => navigate('/dashboard')}
            className="btn btn-sm btn-secondary"
          >
            <Icon name="Home" size={16} />
            Dashboard
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
        {/* Quick Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}>
          {/* Total Exams */}
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            borderRadius: '12px',
            padding: '20px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onClick={() => navigate('/admin/questions')}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Total Exams</div>
                <div style={{ fontSize: '32px', fontWeight: '700' }}>{stats.total_exams || 0}</div>
                {stats.active_exams > 0 && (
                  <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                    {stats.active_exams} active
                  </div>
                )}
              </div>
              <Icon name="BookOpen" size={32} style={{ opacity: 0.3 }} />
            </div>
          </div>

          {/* Active Students */}
          <div style={{
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            borderRadius: '12px',
            padding: '20px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onClick={() => navigate('/admin/users')}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Students</div>
                <div style={{ fontSize: '32px', fontWeight: '700' }}>{stats.active_students || 0}</div>
                {insights.inProgress > 0 && (
                  <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                    {insights.inProgress} taking exam now
                  </div>
                )}
              </div>
              <Icon name="Users" size={32} style={{ opacity: 0.3 }} />
            </div>
          </div>

          {/* Total Attempts */}
          <div style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: '12px',
            padding: '20px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onClick={() => navigate('/admin/monitor')}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Total Attempts</div>
                <div style={{ fontSize: '32px', fontWeight: '700' }}>{stats.total_attempts || 0}</div>
                {insights.pendingGrading > 0 && (
                  <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                    {insights.pendingGrading} need grading
                  </div>
                )}
              </div>
              <Icon name="FileText" size={32} style={{ opacity: 0.3 }} />
            </div>
          </div>

          {/* Violations */}
          <div style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            borderRadius: '12px',
            padding: '20px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onClick={() => navigate('/admin/reports')}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Violations Today</div>
                <div style={{ fontSize: '32px', fontWeight: '700' }}>{stats.violations_today || 0}</div>
                {insights.highViolations > 0 && (
                  <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                    {insights.highViolations} high risk
                  </div>
                )}
              </div>
              <Icon name="AlertTriangle" size={32} style={{ opacity: 0.3 }} />
            </div>
          </div>
        </div>

        {/* Action Alerts */}
        {(insights.pendingGrading > 0 || insights.highViolations > 0) && (
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '2px solid #f59e0b',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '32px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <Icon name="Bell" size={24} style={{ color: '#d97706' }} />
              <h3 style={{ margin: 0, color: '#92400e', fontSize: '18px', fontWeight: '600' }}>
                Requires Attention
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {insights.pendingGrading > 0 && (
                <div style={{
                  padding: '12px 16px',
                  background: 'white',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '14px', color: 'var(--gray-700)' }}>
                    <strong>{insights.pendingGrading}</strong> exam attempt(s) pending grading
                  </span>
                  <button
                    onClick={() => navigate('/admin/monitor')}
                    style={{
                      padding: '6px 14px',
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Grade Now
                  </button>
                </div>
              )}
              {insights.highViolations > 0 && (
                <div style={{
                  padding: '12px 16px',
                  background: 'white',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '14px', color: 'var(--gray-700)' }}>
                    <strong>{insights.highViolations}</strong> exam(s) with high violation count
                  </span>
                  <button
                    onClick={() => navigate('/admin/reports')}
                    style={{
                      padding: '6px 14px',
                      background: 'var(--danger)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Review
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>Quick Actions</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            {[
              { icon: 'Plus', label: 'Create Exam', desc: 'Set up new exam', path: '/admin/create-exam', color: '#3b82f6' },
              { icon: 'FileText', label: 'Questions', desc: 'Manage questions', path: '/admin/questions', color: '#8b5cf6' },
              { icon: 'Eye', label: 'Monitor', desc: 'Live monitoring', path: '/admin/monitor', color: '#f59e0b' },
              { icon: 'Users', label: 'Users', desc: 'Manage students', path: '/admin/users', color: '#22c55e' },
              { icon: 'BarChart3', label: 'Reports', desc: 'View analytics', path: '/admin/reports', color: '#06b6d4' },
              { icon: 'UserCheck', label: 'Approvals', desc: 'Instructor requests', path: '/admin/instructor-approval', color: '#ec4899' }
            ].map((action, idx) => (
              <button
                key={idx}
                onClick={() => navigate(action.path)}
                style={{
                  background: 'white',
                  border: '2px solid var(--gray-200)',
                  borderRadius: '12px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = action.color;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = `0 8px 16px ${action.color}20`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-200)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: `${action.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px'
                }}>
                  <Icon name={action.icon} size={24} style={{ color: action.color }} />
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--gray-900)', marginBottom: '4px' }}>
                  {action.label}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                  {action.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Attempts */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Recent Exam Attempts</h2>
            <button
              onClick={() => navigate('/admin/monitor')}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid var(--gray-300)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--gray-700)'
              }}
            >
              View All
              <Icon name="ArrowRight" size={14} />
            </button>
          </div>

          {recentAttempts.length === 0 ? (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '60px 20px',
              textAlign: 'center',
              border: '1px solid var(--gray-200)'
            }}>
              <Icon name="FileText" size={48} style={{ color: 'var(--gray-400)', marginBottom: '16px' }} />
              <h3 style={{ color: 'var(--gray-600)', fontSize: '16px' }}>No recent attempts</h3>
              <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>
                Exam attempts will appear here once students start taking exams.
              </p>
            </div>
          ) : (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid var(--gray-200)',
              overflow: 'hidden'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)' }}>
                        Student
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)' }}>
                        Exam
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)' }}>
                        Status
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)' }}>
                        Score
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)' }}>
                        Violations
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)' }}>
                        Time
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttempts.slice(0, 10).map((attempt, idx) => (
                      <tr 
                        key={attempt.id}
                        style={{
                          borderBottom: idx < 9 ? '1px solid var(--gray-100)' : 'none',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--gray-900)', fontWeight: '500' }}>
                          {attempt.user_name}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--gray-700)' }}>
                          {attempt.exam_title}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            background: attempt.status === 'COMPLETED' ? '#d1fae5'
                              : ['IN_PROGRESS', 'STARTED'].includes(attempt.status) ? '#fef3c7'
                              : '#f3f4f6',
                            color: attempt.status === 'COMPLETED' ? '#065f46'
                              : ['IN_PROGRESS', 'STARTED'].includes(attempt.status) ? '#92400e'
                              : '#6b7280'
                          }}>
                            {attempt.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)' }}>
                          {attempt.score !== null && attempt.score !== undefined 
                            ? `${attempt.score}/${attempt.total_marks}`
                            : '-'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '600',
                            background: (attempt.violations_count || 0) >= 3 ? '#fee2e2'
                              : (attempt.violations_count || 0) > 0 ? '#fef3c7'
                              : '#d1fae5',
                            color: (attempt.violations_count || 0) >= 3 ? '#991b1b'
                              : (attempt.violations_count || 0) > 0 ? '#92400e'
                              : '#065f46'
                          }}>
                            {attempt.violations_count || 0}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--gray-600)' }}>
                          {formatDateTime(attempt.start_time)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => navigate(`/admin/attempt/${attempt.id}`)}
                            style={{
                              padding: '6px 12px',
                              background: 'var(--primary)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
