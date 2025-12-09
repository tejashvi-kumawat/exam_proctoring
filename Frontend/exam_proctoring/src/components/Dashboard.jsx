// frontend/src/components/Dashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Icon from './Icon';
import Logo from './Logo';
import './Dashboard.css';
import '../CompactStats.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, available, in-progress, completed

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [examsResponse, attemptsResponse] = await Promise.all([
        api.get('/exam/exams/').catch(() => ({ data: [] })),
        api.get('/exam/user/attempts/').catch(() => ({ data: [] }))
      ]);
      
      setExams(examsResponse.data || []);
      setAttempts(attemptsResponse.data || []);
      
    } catch (error) {
      setError('Failed to load dashboard. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const completed = attempts.filter(a => a.status === 'COMPLETED');
    const inProgress = attempts.filter(a => ['IN_PROGRESS', 'STARTED', 'PAUSED'].includes(a.status));
    const withResults = completed.filter(a => a.results_ready);
    const passed = withResults.filter(a => a.is_passed);
    
    const avgScore = withResults.length > 0
      ? (withResults.reduce((sum, a) => sum + (a.percentage_score || 0), 0) / withResults.length).toFixed(1)
      : 0;

    return {
      total: attempts.length,
      completed: completed.length,
      inProgress: inProgress.length,
      avgScore,
      passed: passed.length,
      failed: withResults.length - passed.length
    };
  }, [attempts]);

  // Merge exams with attempts for unified view
  const examCards = useMemo(() => {
    const attemptMap = new Map(attempts.map(a => [a.exam_id, a]));
    
    return exams.map(exam => {
      const attempt = attemptMap.get(exam.id);
      return {
        ...exam,
        attempt,
        status: attempt 
          ? attempt.status 
          : 'AVAILABLE',
        sortOrder: attempt
          ? (['IN_PROGRESS', 'STARTED', 'PAUSED'].includes(attempt.status) ? 0 : 2)
          : 1
      };
    }).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [exams, attempts]);

  // Filter exams based on selected filter
  const filteredExams = useMemo(() => {
    if (filter === 'all') return examCards;
    if (filter === 'available') return examCards.filter(e => e.status === 'AVAILABLE');
    if (filter === 'in-progress') return examCards.filter(e => ['IN_PROGRESS', 'STARTED', 'PAUSED'].includes(e.status));
    if (filter === 'completed') return examCards.filter(e => e.status === 'COMPLETED');
    return examCards;
  }, [examCards, filter]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header-professional">
        <div className="header-left">
          <Logo size="small" onClick={() => navigate('/dashboard')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)' }}>
              {user?.first_name || user?.username}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Student</span>
          </div>
        </div>
        <div className="header-right">
          {(user?.is_staff || (user?.is_instructor && user?.instructor_approved)) && (
            <button 
              onClick={() => navigate('/admin')}
              className="btn btn-sm btn-primary"
            >
              <Icon name="Settings" size={16} />
              Admin
            </button>
          )}
          <button 
            onClick={handleLogout} 
            className="btn btn-sm btn-secondary"
          >
            <Icon name="LogOut" size={16} />
            Logout
          </button>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="error-message" style={{ marginBottom: '20px' }}>
            {error}
            <button onClick={fetchDashboardData} className="btn btn-sm btn-primary" style={{marginLeft: '12px'}}>
              <Icon name="RefreshCw" size={14} />
              Retry
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="stats-row" style={{ marginBottom: '24px' }}>
          <div className="stat-card-pro" style={{ cursor: 'pointer' }} onClick={() => setFilter('all')}>
            <div className="stat-icon-pro" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
              <Icon name="BookOpen" size={22} style={{ color: '#3b82f6' }} />
            </div>
            <div className="stat-content-pro">
              <span className="stat-value-pro">{exams.length}</span>
              <span className="stat-label-pro">Total Exams</span>
            </div>
          </div>

          <div className="stat-card-pro" style={{ cursor: 'pointer' }} onClick={() => setFilter('completed')}>
            <div className="stat-icon-pro" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
              <Icon name="CheckCircle" size={22} style={{ color: '#22c55e' }} />
            </div>
            <div className="stat-content-pro">
              <span className="stat-value-pro">{stats.completed}</span>
              <span className="stat-label-pro">Completed</span>
            </div>
          </div>

          <div className="stat-card-pro" style={{ cursor: 'pointer' }} onClick={() => setFilter('in-progress')}>
            <div className="stat-icon-pro" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
              <Icon name="Clock" size={22} style={{ color: '#f59e0b' }} />
            </div>
            <div className="stat-content-pro">
              <span className="stat-value-pro">{stats.inProgress}</span>
              <span className="stat-label-pro">In Progress</span>
            </div>
          </div>

          <div className="stat-card-pro">
            <div className="stat-icon-pro" style={{ background: 'rgba(168, 85, 247, 0.1)' }}>
              <Icon name="TrendingUp" size={22} style={{ color: '#a855f7' }} />
            </div>
            <div className="stat-content-pro">
              <span className="stat-value-pro">{stats.avgScore}%</span>
              <span className="stat-label-pro">Avg Score</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Banner */}
        {stats.inProgress > 0 && (
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: '12px',
            marginBottom: '24px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon name="AlertCircle" size={24} />
              <div>
                <div style={{ fontWeight: '600', fontSize: '16px' }}>You have {stats.inProgress} exam(s) in progress</div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>Continue where you left off</div>
              </div>
            </div>
            <button 
              onClick={() => setFilter('in-progress')}
              style={{
                padding: '8px 16px',
                background: 'white',
                color: '#d97706',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              View Now
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '2px solid var(--gray-200)',
          paddingBottom: '0',
          flexWrap: 'wrap'
        }}>
          {[
            { key: 'all', label: 'All Exams', icon: 'List' },
            { key: 'available', label: 'Available', icon: 'Play' },
            { key: 'in-progress', label: 'In Progress', icon: 'Clock' },
            { key: 'completed', label: 'Completed', icon: 'CheckCircle' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: filter === tab.key ? '3px solid var(--primary)' : '3px solid transparent',
                color: filter === tab.key ? 'var(--primary)' : 'var(--gray-600)',
                fontWeight: filter === tab.key ? '600' : '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
            >
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Exams Grid */}
        {filteredExams.length === 0 ? (
          <div className="no-exams">
            <Icon name="BookOpen" size={64} style={{ color: 'var(--gray-400)', marginBottom: '20px' }} />
            <h3>No exams found</h3>
            <p>
              {filter === 'available' && 'No new exams available at the moment.'}
              {filter === 'in-progress' && 'No exams in progress.'}
              {filter === 'completed' && 'You haven\'t completed any exams yet.'}
              {filter === 'all' && 'No exams available at the moment.'}
            </p>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="btn btn-primary" style={{ marginTop: '16px' }}>
                View All Exams
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px'
          }}>
            {filteredExams.map((exam) => {
              const { attempt } = exam;
              const isAvailable = exam.status === 'AVAILABLE';
              const isInProgress = ['IN_PROGRESS', 'STARTED', 'PAUSED'].includes(exam.status);
              const isCompleted = exam.status === 'COMPLETED';

              return (
                <div 
                  key={exam.id} 
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: isInProgress ? '2px solid #f59e0b' : '1px solid var(--gray-200)',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Status Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    background: isAvailable ? '#e0f2fe' 
                      : isInProgress ? '#fef3c7' 
                      : isCompleted ? (attempt?.is_passed ? '#d1fae5' : '#fee2e2')
                      : '#f3f4f6',
                    color: isAvailable ? '#0369a1' 
                      : isInProgress ? '#92400e' 
                      : isCompleted ? (attempt?.is_passed ? '#065f46' : '#991b1b')
                      : '#6b7280'
                  }}>
                    {isAvailable ? '● Available' 
                      : isInProgress ? '● In Progress' 
                      : isCompleted ? (attempt?.is_passed ? '✓ Passed' : '✗ Failed')
                      : exam.status}
                  </div>

                  {/* Exam Title */}
                  <h3 style={{ 
                    margin: '0 60px 8px 0', 
                    fontSize: '18px', 
                    fontWeight: '600',
                    color: 'var(--gray-900)',
                    lineHeight: '1.4'
                  }}>
                    {exam.title}
                  </h3>

                  {/* Subject */}
                  <div style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    background: 'var(--gray-100)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: 'var(--gray-700)',
                    marginBottom: '12px'
                  }}>
                    {exam.subject_name}
                  </div>

                  {/* Description */}
                  {exam.description && (
                    <p style={{
                      fontSize: '13px',
                      color: 'var(--gray-600)',
                      lineHeight: '1.5',
                      marginBottom: '16px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {exam.description}
                    </p>
                  )}

                  {/* Exam Info Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px',
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'var(--gray-50)',
                    borderRadius: '8px'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '4px' }}>Duration</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)' }}>
                        {exam.duration_minutes} min
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '4px' }}>Questions</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)' }}>
                        {exam.questions?.length || exam.questions_count || 0}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '4px' }}>Total Marks</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)' }}>
                        {exam.total_marks}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '4px' }}>Passing</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)' }}>
                        {exam.passing_marks}
                      </div>
                    </div>
                  </div>

                  {/* Score Display for Completed */}
                  {isCompleted && attempt?.results_ready && (
                    <div style={{
                      padding: '12px',
                      background: attempt.is_passed 
                        ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                        : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      borderRadius: '8px',
                      color: 'white',
                      marginBottom: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', opacity: 0.9 }}>Your Score</div>
                        <div style={{ fontSize: '20px', fontWeight: '700' }}>
                          {attempt.score}/{attempt.total_marks}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', opacity: 0.9 }}>Percentage</div>
                        <div style={{ fontSize: '20px', fontWeight: '700' }}>
                          {attempt.percentage_score?.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attempt Time */}
                  {attempt && (
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--gray-500)',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Icon name="Clock" size={14} />
                      {isCompleted ? 'Completed' : 'Started'} {formatDateTime(attempt.start_time)}
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    onClick={() => {
                      if (isCompleted) {
                        navigate(`/exam/results/${attempt.id}`);
                      } else if (isInProgress) {
                        navigate(`/exam/${exam.id}/setup`);
                      } else {
                        navigate(`/exam/${exam.id}/setup`);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: isCompleted 
                        ? 'var(--gray-700)'
                        : isInProgress 
                        ? 'var(--warning)'
                        : 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <Icon 
                      name={isCompleted ? 'Eye' : isInProgress ? 'Play' : 'ArrowRight'} 
                      size={16} 
                    />
                    {isCompleted ? 'View Results' : isInProgress ? 'Continue Exam' : 'Start Exam'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
