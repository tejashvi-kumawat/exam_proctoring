// frontend/src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
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
  const [userStats, setUserStats] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Load activeTab from localStorage, default to 'exams'
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('dashboard_activeTab');
    return savedTab || 'exams';
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboard_activeTab', activeTab);
  }, [activeTab]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch exams, user stats, and attempts in parallel
      const [examsResponse, statsResponse, attemptsResponse] = await Promise.all([
        api.get('/exam/exams/').catch(err => {
          return { data: [] };
        }),
        api.get('/auth/stats/').catch(err => {
          return { data: { total_attempts: 0, completed_exams: 0, average_score: 0, total_score: 0 } };
        }),
        api.get('/exam/user/attempts/').catch(err => {
          return { data: [] };
        })
      ]);
      
      setExams(examsResponse.data || []);
      setUserStats(statsResponse.data || {});
      setAttempts(attemptsResponse.data || []);
      
    } catch (error) {
      setError('Failed to load dashboard data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };
  const handleStartExam = (examId) => {
    navigate(`/exam/${examId}/setup`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDateTime = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Separate exams into attempted and not attempted
  const attemptedExamIds = new Set(attempts.map(attempt => attempt.exam_id));
  const availableExams = exams.filter(exam => !attemptedExamIds.has(exam.id));
  const attemptedExams = exams.filter(exam => attemptedExamIds.has(exam.id));
  
  // Get attempt details for each attempted exam
  const getAttemptForExam = (examId) => {
    return attempts.find(attempt => attempt.exam_id === examId);
  };

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
          <span style={{ fontSize: '14px', color: 'var(--gray-600)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="User" size={16} />
            {user?.username}
          </span>
        </div>
        <div className="header-right">
          {(user?.is_staff || user?.is_instructor) && (
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
          <div className="error-message" style={{ padding: '12px 16px', fontSize: '14px' }}>
            {error}
            <button onClick={fetchDashboardData} className="btn btn-sm btn-primary" style={{marginLeft: '12px'}}>
              <Icon name="RefreshCw" size={14} />
              Retry
            </button>
          </div>
        )}

        {/* Stats Overview */}
        {userStats && (
          <div className="stats-row">
            <div className="stat-card-pro">
              <div className="stat-icon-pro">
                <Icon name="FileText" size={22} style={{ color: 'var(--primary)' }} />
              </div>
              <div className="stat-content-pro">
                <span className="stat-value-pro">{userStats.total_attempts || 0}</span>
                <span className="stat-label-pro">Total Attempts</span>
              </div>
            </div>
            <div className="stat-card-pro">
              <div className="stat-icon-pro">
                <Icon name="CheckCircle" size={22} style={{ color: 'var(--success)' }} />
              </div>
              <div className="stat-content-pro">
                <span className="stat-value-pro">{userStats.completed_exams || 0}</span>
                <span className="stat-label-pro">Completed</span>
              </div>
            </div>
            <div className="stat-card-pro">
              <div className="stat-icon-pro">
                <Icon name="TrendingUp" size={22} style={{ color: 'var(--warning)' }} />
              </div>
              <div className="stat-content-pro">
                <span className="stat-value-pro">
                  {attempts.filter(a => a.status === 'COMPLETED' && a.results_ready).length > 0
                    ? (userStats.average_score || 0) + '%'
                    : '0%'}
                </span>
                <span className="stat-label-pro">Average Score</span>
              </div>
            </div>
            <div className="stat-card-pro">
              <div className="stat-icon-pro">
                <Icon name="Award" size={22} style={{ color: 'var(--primary)' }} />
              </div>
              <div className="stat-content-pro">
                <span className="stat-value-pro">
                  {attempts
                    .filter(a => a.status === 'COMPLETED' && a.results_ready)
                    .reduce((sum, a) => sum + (a.score || 0), 0)}
                </span>
                <span className="stat-label-pro">Total Score</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="tabs-professional">
          <button
            onClick={() => setActiveTab('exams')}
            className={activeTab === 'exams' ? 'tab-btn-pro active' : 'tab-btn-pro'}
          >
            <Icon name="BookOpen" size={16} />
            Available Exams
          </button>
          <button
            onClick={() => setActiveTab('attempted')}
            className={activeTab === 'attempted' ? 'tab-btn-pro active' : 'tab-btn-pro'}
          >
            <Icon name="CheckCircle" size={16} />
            Attempted ({attemptedExams.length})
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={activeTab === 'results' ? 'tab-btn-pro active' : 'tab-btn-pro'}
          >
            <Icon name="FileText" size={16} />
            Results ({attempts.filter(a => a.status === 'COMPLETED').length})
          </button>
        </div>

        {/* Exams Tab */}
        {activeTab === 'exams' && (
          <div className="content-card">
            <div className="card-header">
              <span className="card-title">Available Exams</span>
            </div>
            <div>
            {availableExams.length === 0 ? (
              <div className="no-exams">
                <Icon name="BookOpen" size={64} style={{ color: 'var(--gray-400)', marginBottom: '20px' }} />
                <p>No new exams available at the moment.</p>
                {attemptedExams.length > 0 && (
                  <p style={{ color: 'var(--gray-600)', marginBottom: '20px' }}>
                    You have attempted {attemptedExams.length} exam(s). Check the "Attempted Exams" tab to view them.
                  </p>
                )}
                <button onClick={fetchDashboardData} className="btn btn-primary" style={{ marginRight: '10px' }}>
                  Refresh
                </button>
                {attemptedExams.length > 0 && (
                  <button onClick={() => setActiveTab('attempted')} className="btn btn-secondary">
                    View Attempted Exams
                  </button>
                )}
              </div>
            ) : (
              <div className="exams-grid">
                {availableExams.map((exam) => (
                  <div key={exam.id} className="exam-card">
                    <div className="exam-header">
                      <h3>{exam.title}</h3>
                      <span className="exam-subject">{exam.subject_name}</span>
                    </div>
                    
                    <div className="exam-details">
                      <p className="exam-description">{exam.description}</p>
                      
                      <div className="exam-info">
                        <div className="info-item">
                          <span className="label">Duration:</span>
                          <span className="value">{exam.duration_minutes} minutes</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Total Marks:</span>
                          <span className="value">{exam.total_marks}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Passing Marks:</span>
                          <span className="value">{exam.passing_marks}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Questions:</span>
                          <span className="value">
                            {exam.questions?.length || exam.questions_count || 0}
                          </span>
                        </div>
                      </div>
                      
                      <div className="exam-schedule">
                        <div className="schedule-item">
                          <span className="label">Start:</span>
                          <span className="value">{formatDateTime(exam.start_time)}</span>
                        </div>
                        <div className="schedule-item">
                          <span className="label">End:</span>
                          <span className="value">{formatDateTime(exam.end_time)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="exam-actions">
                      <button 
                        onClick={() => handleStartExam(exam.id)}
                        className="start-exam-btn"
                        disabled={attemptedExamIds.has(exam.id)}
                        style={{
                          opacity: attemptedExamIds.has(exam.id) ? 0.6 : 1,
                          cursor: attemptedExamIds.has(exam.id) ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {attemptedExamIds.has(exam.id) ? 'Already Attempted' : 'Start Exam'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        )}

        {/* Attempted Exams Tab */}
        {activeTab === 'attempted' && (
          <div className="attempted-exams-section">
            <h2>Attempted Exams</h2>
            {attemptedExams.length === 0 ? (
              <div className="no-exams">
                <Icon name="CheckCircle" size={64} style={{ color: 'var(--gray-400)', marginBottom: '20px' }} />
                <p>You haven't attempted any exams yet.</p>
                <button onClick={() => setActiveTab('exams')} className="btn btn-primary">
                  View Available Exams
                </button>
              </div>
            ) : (
              <div className="exams-grid">
                {attemptedExams.map((exam) => {
                  const attempt = getAttemptForExam(exam.id);
                  return (
                    <div key={exam.id} className="exam-card" style={{
                      opacity: 0.9,
                      border: '2px solid var(--gray-300)'
                    }}>
                      <div className="exam-header">
                        <h3>{exam.title}</h3>
                        <span className="exam-subject">{exam.subject_name}</span>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          background: attempt?.status === 'COMPLETED' ? 'var(--success-color)' : 'var(--warning-color)',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          marginTop: '8px'
                        }}>
                          {attempt?.status === 'COMPLETED' ? 'Completed' : attempt?.status || 'Attempted'}
                        </span>
                      </div>
                      
                      <div className="exam-details">
                        <p className="exam-description">{exam.description}</p>
                        
                        <div className="exam-info">
                          <div className="info-item">
                            <span className="label">Duration:</span>
                            <span className="value">{exam.duration_minutes} minutes</span>
                          </div>
                          <div className="info-item">
                            <span className="label">Total Marks:</span>
                            <span className="value">{exam.total_marks}</span>
                          </div>
                          {attempt?.status === 'COMPLETED' && attempt?.results_ready && (
                            <>
                              <div className="info-item">
                                <span className="label">Your Score:</span>
                                <span className="value" style={{ fontWeight: '700', color: 'var(--primary-color)' }}>
                                  {attempt.score !== null && attempt.score !== undefined 
                                    ? `${attempt.score} / ${attempt.total_marks}`
                                    : 'Pending'}
                                </span>
                              </div>
                              <div className="info-item">
                                <span className="label">Percentage:</span>
                                <span className="value" style={{ fontWeight: '700', color: 'var(--primary-color)' }}>
                                  {attempt.percentage_score !== null && attempt.percentage_score !== undefined
                                    ? `${attempt.percentage_score.toFixed(1)}%`
                                    : 'Pending'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                        
                        <div className="exam-schedule">
                          <div className="schedule-item">
                            <span className="label">Attempted On:</span>
                            <span className="value">
                              {attempt?.start_time ? formatDateTime(attempt.start_time) : 'N/A'}
                            </span>
                          </div>
                          {attempt?.status === 'COMPLETED' && attempt?.end_time && (
                            <div className="schedule-item">
                              <span className="label">Completed On:</span>
                              <span className="value">{formatDateTime(attempt.end_time)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="exam-actions">
                        {attempt?.status === 'COMPLETED' ? (
                          <button 
                            onClick={() => navigate(`/exam/results/${attempt.id}`)}
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                          >
                            <Icon name="Eye" size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            View Results
                          </button>
                        ) : attempt?.status === 'IN_PROGRESS' || attempt?.status === 'STARTED' || attempt?.status === 'PAUSED' ? (
                          <button 
                            onClick={() => handleStartExam(exam.id)}
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                          >
                            <Icon name="Play" size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Resume Exam
                          </button>
                        ) : (
                          <button 
                            disabled
                            className="start-exam-btn"
                            style={{
                              opacity: 0.6,
                              cursor: 'not-allowed',
                              width: '100%'
                            }}
                          >
                            Already Attempted
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="results-section">
            <h2>My Exam Results</h2>
            {attempts.length === 0 ? (
              <div className="no-results" style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <Icon name="FileText" size={64} style={{ color: 'var(--gray-400)', marginBottom: '20px' }} />
                <h3 style={{ color: 'var(--gray-700)', marginBottom: '10px' }}>No Results Yet</h3>
                <p style={{ color: 'var(--gray-600)', marginBottom: '20px' }}>
                  You haven't completed any exams yet. Start an exam to see your results here.
                </p>
                <button onClick={() => setActiveTab('exams')} className="btn btn-primary">
                  View Available Exams
                </button>
              </div>
            ) : (
              <div className="results-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                gap: '20px'
              }}>
                {attempts.map((attempt) => (
                  <div 
                    key={attempt.id} 
                    className="result-card"
                    style={{
                      background: 'white',
                      borderRadius: '12px',
                      padding: '24px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      cursor: attempt.status === 'COMPLETED' ? 'pointer' : 'default'
                    }}
                    onClick={() => {
                      if (attempt.status === 'COMPLETED') {
                        navigate(`/exam/results/${attempt.id}`);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (attempt.status === 'COMPLETED') {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--gray-900)' }}>
                          {attempt.exam_title}
                        </h3>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: 'var(--gray-100)',
                          color: 'var(--gray-700)'
                        }}>
                          {attempt.subject_name}
                        </span>
                      </div>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: attempt.status === 'COMPLETED' 
                          ? (attempt.is_passed ? '#4caf50' : '#f44336')
                          : attempt.status === 'IN_PROGRESS' || attempt.status === 'STARTED'
                          ? '#ffc107'
                          : '#9e9e9e',
                        color: 'white'
                      }}>
                        {attempt.status === 'COMPLETED' 
                          ? (attempt.is_passed ? 'PASSED' : 'FAILED')
                          : attempt.status}
                      </span>
                    </div>

                    {attempt.status === 'COMPLETED' && (
                      <>
                        {attempt.results_ready ? (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '16px',
                            background: '#2563eb',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            color: 'white',
                            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)'
                          }}>
                            <div>
                              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Score</div>
                              <div style={{ fontSize: '24px', fontWeight: '700' }}>
                                {attempt.score !== null && attempt.score !== undefined 
                                  ? `${attempt.score} / ${attempt.total_marks}`
                                  : 'Pending'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Percentage</div>
                              <div style={{ fontSize: '24px', fontWeight: '700' }}>
                                {attempt.percentage_score !== null && attempt.percentage_score !== undefined
                                  ? `${attempt.percentage_score.toFixed(1)}%`
                                  : 'Pending'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: '16px',
                            background: '#d97706',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            color: 'white',
                            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.2)'
                          }}>
                            <Icon name="Clock" size={20} style={{ marginRight: '8px' }} />
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '600' }}>Results Coming Soon</div>
                              <div style={{ fontSize: '12px', opacity: 0.9 }}>Results will be available after review</div>
                            </div>
                          </div>
                        )}

                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '14px',
                          color: 'var(--gray-600)',
                          marginBottom: '16px'
                        }}>
                          <div>
                            <Icon name="Calendar" size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                            {attempt.end_time ? formatDateTime(attempt.end_time) : 'N/A'}
                          </div>
                        </div>

                        <button
                          className="btn btn-primary"
                          style={{ width: '100%' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/exam/results/${attempt.id}`);
                          }}
                        >
                          <Icon name="Eye" size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                          View Detailed Results
                        </button>
                      </>
                    )}

                    {attempt.status !== 'COMPLETED' && (
                      <div style={{
                        padding: '16px',
                        background: 'var(--gray-50)',
                        borderRadius: '8px',
                        textAlign: 'center',
                        color: 'var(--gray-600)'
                      }}>
                        {attempt.status === 'IN_PROGRESS' || attempt.status === 'STARTED' 
                          ? 'Exam in progress'
                          : attempt.status === 'PAUSED'
                          ? 'Exam paused'
                          : 'Status: ' + attempt.status}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
