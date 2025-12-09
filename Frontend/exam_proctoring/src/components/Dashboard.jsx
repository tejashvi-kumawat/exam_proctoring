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
  const [filter, setFilter] = useState('all');

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

  const examCards = useMemo(() => {
    const attemptMap = new Map(attempts.map(a => [a.exam_id, a]));
    
    return exams.map(exam => {
      const attempt = attemptMap.get(exam.id);
      return {
        ...exam,
        attempt,
        status: attempt ? attempt.status : 'AVAILABLE',
        sortOrder: attempt
          ? (['IN_PROGRESS', 'STARTED', 'PAUSED'].includes(attempt.status) ? 0 : 2)
          : 1
      };
    }).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [exams, attempts]);

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
      <header className="header-professional">
        <div className="header-left">
          <Logo size="small" onClick={() => navigate('/dashboard')} />
          <div className="user-info-header">
            <span className="user-name">{user?.first_name || user?.username}</span>
            <span className="user-role">Student</span>
          </div>
        </div>
        <div className="header-right">
          {(user?.is_staff || (user?.is_instructor && user?.instructor_approved)) && (
            <button 
              onClick={() => navigate('/admin')}
              className="btn btn-sm btn-primary"
            >
              <Icon name="Settings" size={16} />
              <span className="btn-text">Admin</span>
            </button>
          )}
          <button 
            onClick={handleLogout} 
            className="btn btn-sm btn-secondary"
          >
            <Icon name="LogOut" size={16} />
            <span className="btn-text">Logout</span>
          </button>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="error-message">
            {error}
            <button onClick={fetchDashboardData} className="btn btn-sm btn-primary" style={{marginLeft: '12px'}}>
              <Icon name="RefreshCw" size={14} />
              Retry
            </button>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card" onClick={() => setFilter('all')}>
            <div className="stat-icon blue">
              <Icon name="BookOpen" size={20} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{exams.length}</div>
              <div className="stat-label">Total Exams</div>
            </div>
          </div>

          <div className="stat-card" onClick={() => setFilter('completed')}>
            <div className="stat-icon green">
              <Icon name="CheckCircle" size={20} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-label">Completed</div>
            </div>
          </div>

          <div className="stat-card" onClick={() => setFilter('in-progress')}>
            <div className="stat-icon orange">
              <Icon name="Clock" size={20} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats.inProgress}</div>
              <div className="stat-label">In Progress</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple">
              <Icon name="TrendingUp" size={20} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats.avgScore}%</div>
              <div className="stat-label">Avg Score</div>
            </div>
          </div>
        </div>

        {stats.inProgress > 0 && (
          <div className="alert-banner warning">
            <Icon name="AlertCircle" size={20} />
            <div className="alert-content">
              <div className="alert-title">You have {stats.inProgress} exam(s) in progress</div>
              <div className="alert-subtitle">Continue where you left off</div>
            </div>
            <button onClick={() => setFilter('in-progress')} className="btn btn-sm btn-white">
              View Now
            </button>
          </div>
        )}

        <div className="filter-tabs">
          {[
            { key: 'all', label: 'All Exams', icon: 'List' },
            { key: 'available', label: 'Available', icon: 'Play' },
            { key: 'in-progress', label: 'In Progress', icon: 'Clock' },
            { key: 'completed', label: 'Completed', icon: 'CheckCircle' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`filter-tab ${filter === tab.key ? 'active' : ''}`}
            >
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {filteredExams.length === 0 ? (
          <div className="empty-state">
            <Icon name="BookOpen" size={48} />
            <h3>No exams found</h3>
            <p>
              {filter === 'available' && 'No new exams available at the moment.'}
              {filter === 'in-progress' && 'No exams in progress.'}
              {filter === 'completed' && 'You haven\'t completed any exams yet.'}
              {filter === 'all' && 'No exams available at the moment.'}
            </p>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="btn btn-primary">
                View All Exams
              </button>
            )}
          </div>
        ) : (
          <div className="exams-grid">
            {filteredExams.map((exam) => {
              const { attempt } = exam;
              const isAvailable = exam.status === 'AVAILABLE';
              const isInProgress = ['IN_PROGRESS', 'STARTED', 'PAUSED'].includes(exam.status);
              const isCompleted = exam.status === 'COMPLETED';

              return (
                <div key={exam.id} className={`exam-card ${isInProgress ? 'in-progress' : ''}`}>
                  <div className={`exam-status-badge ${
                    isAvailable ? 'available' 
                    : isInProgress ? 'in-progress' 
                    : isCompleted ? (attempt?.results_ready ? (attempt?.is_passed ? 'passed' : 'failed') : 'pending')
                    : ''
                  }`}>
                    {isAvailable ? 'Available' 
                      : isInProgress ? 'In Progress' 
                      : isCompleted ? (attempt?.results_ready ? (attempt?.is_passed ? 'Passed' : 'Failed') : 'Pending')
                      : exam.status}
                  </div>

                  <h3 className="exam-title">{exam.title}</h3>
                  <div className="exam-subject">{exam.subject_name}</div>

                  {exam.description && (
                    <p className="exam-description">{exam.description}</p>
                  )}

                  <div className="exam-info-grid">
                    <div className="info-item">
                      <div className="info-label">Duration</div>
                      <div className="info-value">{exam.duration_minutes} min</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Questions</div>
                      <div className="info-value">{exam.questions?.length || exam.questions_count || 0}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Total Marks</div>
                      <div className="info-value">{exam.total_marks}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Passing</div>
                      <div className="info-value">{exam.passing_marks}</div>
                    </div>
                  </div>

                  {isCompleted && attempt?.results_ready && (
                    <div className={`exam-score ${attempt.is_passed ? 'passed' : 'failed'}`}>
                      <div className="score-item">
                        <div className="score-label">Your Score</div>
                        <div className="score-value">{attempt.score}/{attempt.total_marks}</div>
                      </div>
                      <div className="score-item">
                        <div className="score-label">Percentage</div>
                        <div className="score-value">{attempt.percentage_score?.toFixed(1)}%</div>
                      </div>
                    </div>
                  )}

                  {attempt && (
                    <div className="exam-time">
                      <Icon name="Clock" size={14} />
                      {isCompleted ? 'Completed' : 'Started'} {formatDateTime(attempt.start_time)}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (isCompleted) {
                        navigate(`/exam/results/${attempt.id}`);
                      } else {
                        navigate(`/exam/${exam.id}/setup`);
                      }
                    }}
                    className={`btn btn-block ${
                      isCompleted ? 'btn-secondary' 
                      : isInProgress ? 'btn-warning' 
                      : 'btn-primary'
                    }`}
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
