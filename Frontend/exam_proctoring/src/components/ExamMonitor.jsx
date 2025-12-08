// frontend/src/components/ExamMonitor.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Icon from './Icon';
import './ExamMonitor.css';

const ExamMonitor = () => {
  const navigate = useNavigate();
  const [activeExams, setActiveExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [liveAttempts, setLiveAttempts] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(false);
  // Load activeTab from localStorage, default to 'live'
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('examMonitor_activeTab');
    return savedTab || 'live';
  });
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [attemptAnswers, setAttemptAnswers] = useState(null);
  const [markingAnswer, setMarkingAnswer] = useState(null);
  const [marksInput, setMarksInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('time'); // time, score, name
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc

  useEffect(() => {
    fetchActiveExams();
    const interval = setInterval(fetchActiveExams, 30000);
    return () => clearInterval(interval);
  }, []);

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('examMonitor_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedExam) {
      fetchLiveAttempts();
      fetchAllAttempts();
      fetchViolations();
      const interval = setInterval(() => {
        fetchLiveAttempts();
        if (activeTab === 'all') {
          fetchAllAttempts();
        }
        fetchViolations();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedExam, activeTab]);

  const fetchActiveExams = async () => {
    try {
      const response = await api.get('/exam/admin/active-exams/');
      setActiveExams(response.data || []);
    } catch (error) {
      // Silently handle errors
    }
  };

  const fetchLiveAttempts = async () => {
    if (!selectedExam) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/exam/admin/exams/${selectedExam.id}/live-attempts/`);
      setLiveAttempts(response.data || []);
    } catch (error) {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAttempts = async () => {
    if (!selectedExam) return;
    
    try {
      const response = await api.get(`/exam/admin/exams/${selectedExam.id}/all-attempts/`);
      const attempts = response.data || [];
      
      // Apply filters and sorting
      let filtered = [...attempts];
      
      // Status filter
      if (statusFilter !== 'all') {
        filtered = filtered.filter(a => a.status === statusFilter);
      }
      
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(a => 
          a.user_name?.toLowerCase().includes(query) ||
          a.user_email?.toLowerCase().includes(query)
        );
      }
      
      // Sorting
      filtered.sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === 'time') {
          const timeA = new Date(a.start_time || 0).getTime();
          const timeB = new Date(b.start_time || 0).getTime();
          comparison = timeB - timeA;
        } else if (sortBy === 'score') {
          const scoreA = a.score !== null && a.score !== undefined ? a.score : -1;
          const scoreB = b.score !== null && b.score !== undefined ? b.score : -1;
          comparison = scoreB - scoreA;
        } else if (sortBy === 'name') {
          comparison = (a.user_name || '').localeCompare(b.user_name || '');
        }
        
        return sortOrder === 'asc' ? -comparison : comparison;
      });
      
      setAllAttempts(filtered);
    } catch (error) {
      // Silently handle errors
    }
  };

  useEffect(() => {
    if (selectedExam && activeTab === 'all') {
      fetchAllAttempts();
    }
  }, [statusFilter, searchQuery, sortBy, sortOrder, selectedExam, activeTab]);

  const fetchAttemptAnswers = async (attemptId) => {
    try {
      const response = await api.get(`/exam/admin/attempts/${attemptId}/`);
      setAttemptAnswers(response.data.answers || []);
      setSelectedAttempt(response.data);
    } catch (error) {
      alert('Failed to load answers');
    }
  };

  const handleMarkAnswer = async (answerId) => {
    if (!marksInput || marksInput === '') {
      alert('Please enter marks');
      return;
    }

    const marks = parseFloat(marksInput);
    const answer = attemptAnswers.find(a => a.id === answerId);
    if (!answer) return;

    if (marks < 0 || marks > answer.question.marks) {
      alert(`Marks must be between 0 and ${answer.question.marks}`);
      return;
    }

    try {
      const response = await api.post(`/exam/admin/answers/${answerId}/mark/`, {
        marks_awarded: marks,
        is_correct: marks > 0
      });

      const updatedAnswers = attemptAnswers.map(a => 
        a.id === answerId 
          ? { ...a, marks_awarded: marks, is_correct: marks > 0, is_manually_marked: true }
          : a
      );

      setAttemptAnswers(updatedAnswers);
      setMarkingAnswer(null);
      setMarksInput('');
      
      // Refresh attempts to update scores
      fetchAllAttempts();
      
      alert('Answer marked successfully!');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to mark answer');
    }
  };

  const fetchViolations = async () => {
    if (!selectedExam) return;
    
    try {
      const response = await api.get(`/proctoring/admin/exams/${selectedExam.id}/violations/`);
      setViolations(response.data || []);
    } catch (error) {
      // Silently handle errors
    }
  };

  const terminateAttempt = async (attemptId) => {
    if (!window.confirm('Are you sure you want to terminate this exam attempt?')) return;

    try {
      await api.post(`/exam/admin/attempts/${attemptId}/terminate/`);
      fetchLiveAttempts();
      fetchAllAttempts();
    } catch (error) {
      alert('Error terminating attempt');
    }
  };

  const formatDateTime = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatDuration = (startTime) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000 / 60);
    return `${diff} min`;
  };

  const getViolationSeverityColor = (severity) => {
    switch (severity) {
      case 'LOW': return '#4caf50';
      case 'MEDIUM': return '#ff9800';
      case 'HIGH': return '#ff5722';
      case 'CRITICAL': return '#f44336';
      default: return '#666';
    }
  };

  const getStatusBadgeColor = (status, isPassed) => {
    if (status === 'COMPLETED') {
      return isPassed ? '#4caf50' : '#f44336';
    }
    if (status === 'IN_PROGRESS' || status === 'STARTED') {
      return '#2196f3';
    }
    if (status === 'PAUSED') {
      return '#ff9800';
    }
    if (status === 'TERMINATED') {
      return '#9e9e9e';
    }
    return '#666';
  };

  // Statistics
  const stats = useMemo(() => {
    if (!selectedExam) return null;
    
    const total = allAttempts.length;
    const completed = allAttempts.filter(a => a.status === 'COMPLETED').length;
    const inProgress = allAttempts.filter(a => a.status === 'IN_PROGRESS' || a.status === 'STARTED').length;
    const paused = allAttempts.filter(a => a.status === 'PAUSED').length;
    const passed = allAttempts.filter(a => a.status === 'COMPLETED' && a.is_passed).length;
    const failed = allAttempts.filter(a => a.status === 'COMPLETED' && !a.is_passed).length;
    const avgScore = completed > 0 
      ? allAttempts.filter(a => a.status === 'COMPLETED' && a.score !== null)
          .reduce((sum, a) => sum + (a.score || 0), 0) / completed
      : 0;

    return { total, completed, inProgress, paused, passed, failed, avgScore };
  }, [allAttempts, selectedExam]);

  return (
    <div className="exam-monitor-redesigned">
      {/* Header */}
      <div className="monitor-header-redesigned">
        <div className="header-content-redesigned">
          <div className="header-title-redesigned">
            <Icon name="Monitor" size={28} style={{ marginRight: '12px', color: '#2563eb' }} />
            <h1>Exam Monitoring Dashboard</h1>
          </div>
          <button 
            onClick={() => navigate('/admin')}
            className="btn btn-secondary"
          >
            <Icon name="ArrowLeft" size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Back to Admin
          </button>
        </div>
      </div>

      <div className="monitor-content-redesigned">
        {/* Active Exams Section */}
        <div className="exams-section-redesigned">
          <h2 className="section-title-redesigned">
            <Icon name="BookOpen" size={24} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
            Active Exams ({activeExams.length})
          </h2>
          
          {activeExams.length === 0 ? (
            <div className="empty-state-redesigned">
              <Icon name="BookOpen" size={64} style={{ color: '#9ca3af', marginBottom: '20px' }} />
              <p>No active exams at the moment</p>
            </div>
          ) : (
            <div className="exams-grid-redesigned">
              {activeExams.map((exam) => (
                <div 
                  key={exam.id} 
                  className={`exam-card-redesigned ${selectedExam?.id === exam.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedExam(exam);
                    setActiveTab('live');
                    setSelectedAttempt(null);
                    setAttemptAnswers(null);
                  }}
                >
                  <div className="exam-card-header-redesigned">
                    <h3>{exam.title}</h3>
                    <div className="exam-badge-redesigned" style={{ background: selectedExam?.id === exam.id ? '#2563eb' : '#e5e7eb' }}>
                      {exam.active_attempts || 0} Active
                    </div>
                  </div>
                  
                  <div className="exam-card-stats-redesigned">
                    <div className="stat-item-redesigned">
                      <Icon name="Users" size={18} style={{ color: '#2563eb', marginRight: '6px' }} />
                      <span className="stat-label-redesigned">Attempts:</span>
                      <span className="stat-value-redesigned">{exam.active_attempts || 0}</span>
                    </div>
                    <div className="stat-item-redesigned">
                      <Icon name="AlertTriangle" size={18} style={{ color: '#f59e0b', marginRight: '6px' }} />
                      <span className="stat-label-redesigned">Violations:</span>
                      <span className="stat-value-redesigned">{exam.violations_count || 0}</span>
                    </div>
                  </div>
                  
                  <div className="exam-card-footer-redesigned">
                    <Icon name="Clock" size={16} style={{ marginRight: '6px', color: '#6b7280' }} />
                    <span>Ends: {new Date(exam.end_time).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monitoring Section */}
        {selectedExam && (
          <div className="monitoring-section-redesigned">
            <div className="monitoring-header-redesigned">
              <div className="monitoring-title-redesigned">
                <h2>{selectedExam.title}</h2>
                <span className="exam-subtitle-redesigned">Real-time Monitoring & Management</span>
              </div>
              
              {/* Statistics */}
              {stats && (
                <div className="stats-grid-redesigned">
                  <div className="stat-card-redesigned">
                    <div className="stat-card-value">{stats.total}</div>
                    <div className="stat-card-label">Total Attempts</div>
                  </div>
                  <div className="stat-card-redesigned">
                    <div className="stat-card-value">{stats.completed}</div>
                    <div className="stat-card-label">Completed</div>
                  </div>
                  <div className="stat-card-redesigned">
                    <div className="stat-card-value">{stats.inProgress}</div>
                    <div className="stat-card-label">In Progress</div>
                  </div>
                  <div className="stat-card-redesigned">
                    <div className="stat-card-value">{stats.passed}</div>
                    <div className="stat-card-label">Passed</div>
                  </div>
                  <div className="stat-card-redesigned">
                    <div className="stat-card-value">{stats.failed}</div>
                    <div className="stat-card-label">Failed</div>
                  </div>
                  <div className="stat-card-redesigned">
                    <div className="stat-card-value">{stats.avgScore.toFixed(1)}%</div>
                    <div className="stat-card-label">Avg Score</div>
                  </div>
                </div>
              )}
              
              {/* Tabs */}
              <div className="monitoring-tabs-redesigned">
                <button
                  onClick={() => {
                    setActiveTab('live');
                    setSelectedAttempt(null);
                    setAttemptAnswers(null);
                  }}
                  className={`tab-btn-redesigned ${activeTab === 'live' ? 'active' : ''}`}
                >
                  <Icon name="Activity" size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                  Live Attempts
                  {liveAttempts.length > 0 && (
                    <span className="tab-badge-redesigned">{liveAttempts.length}</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setActiveTab('all');
                    setSelectedAttempt(null);
                    setAttemptAnswers(null);
                    fetchAllAttempts();
                  }}
                  className={`tab-btn-redesigned ${activeTab === 'all' ? 'active' : ''}`}
                >
                  <Icon name="Users" size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                  All Attempts
                  {allAttempts.length > 0 && (
                    <span className="tab-badge-redesigned">{allAttempts.length}</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setActiveTab('violations');
                  }}
                  className={`tab-btn-redesigned ${activeTab === 'violations' ? 'active' : ''}`}
                >
                  <Icon name="AlertTriangle" size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                  Violations
                  {violations.length > 0 && (
                    <span className="tab-badge-redesigned">{violations.length}</span>
                  )}
                </button>
              </div>
            </div>

            <div className="monitoring-content-redesigned">
              {/* Live Attempts Tab */}
              {activeTab === 'live' && (
                <div className="live-attempts-section-redesigned">
                  {loading ? (
                    <div className="loading-state-redesigned">
                      <div className="spinner-redesigned"></div>
                      <p>Loading live attempts...</p>
                    </div>
                  ) : liveAttempts.length === 0 ? (
                    <div className="empty-state-redesigned">
                      <Icon name="Activity" size={64} style={{ color: '#9ca3af', marginBottom: '20px' }} />
                      <p>No active attempts</p>
                    </div>
                  ) : (
                    <div className="attempts-grid-redesigned">
                      {liveAttempts.map((attempt) => (
                        <div key={attempt.id} className="attempt-card-redesigned">
                          <div className="attempt-card-header-redesigned">
                            <div className="student-info-redesigned">
                              <div className="student-avatar-redesigned">
                                {attempt.user_name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div>
                                <div className="student-name-redesigned">{attempt.user_name}</div>
                                <div className="student-email-redesigned">{attempt.user_email}</div>
                              </div>
                            </div>
                            <span 
                              className="status-badge-redesigned"
                              style={{ background: getStatusBadgeColor(attempt.status) }}
                            >
                              {attempt.status}
                            </span>
                          </div>
                          
                          <div className="attempt-metrics-redesigned">
                            <div className="metric-item-redesigned">
                              <Icon name="Clock" size={16} style={{ color: '#6b7280' }} />
                              <span>{formatDuration(attempt.start_time)}</span>
                            </div>
                            <div className="metric-item-redesigned">
                              <Icon name="FileText" size={16} style={{ color: '#6b7280' }} />
                              <span>{attempt.answered_questions}/{attempt.total_questions}</span>
                            </div>
                            <div className="metric-item-redesigned">
                              <Icon name="AlertTriangle" size={16} style={{ color: '#f59e0b' }} />
                              <span>{attempt.violations_count || 0}</span>
                            </div>
                          </div>

                          <div className="proctoring-indicators-redesigned">
                            <div className={`indicator-redesigned ${attempt.camera_status ? 'active' : 'inactive'}`}>
                              <Icon name={attempt.camera_status ? "Video" : "VideoOff"} size={16} />
                              <span>Camera</span>
                            </div>
                            <div className={`indicator-redesigned ${attempt.face_detected ? 'active' : 'inactive'}`}>
                              <Icon name={attempt.face_detected ? "User" : "UserX"} size={16} />
                              <span>Face</span>
                            </div>
                            <div className={`indicator-redesigned ${attempt.audio_status ? 'active' : 'inactive'}`}>
                              <Icon name={attempt.audio_status ? "Mic" : "MicOff"} size={16} />
                              <span>Audio</span>
                            </div>
                          </div>

                          <div className="attempt-actions-redesigned">
                            <button 
                              onClick={() => navigate(`/admin/attempt/${attempt.id}`)}
                              className="btn btn-outline btn-sm"
                            >
                              <Icon name="Eye" size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                              View Details
                            </button>
                            <button 
                              onClick={() => terminateAttempt(attempt.id)}
                              className="btn btn-danger btn-sm"
                            >
                              <Icon name="X" size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                              Terminate
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* All Attempts Tab */}
              {activeTab === 'all' && (
                <div className="all-attempts-section-redesigned">
                  <div className="filters-bar-redesigned">
                    <div className="search-box-redesigned">
                      <Icon name="Search" size={18} style={{ color: '#9ca3af', marginRight: '10px' }} />
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input-redesigned"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="filter-select-redesigned"
                    >
                      <option value="all">All Status</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="PAUSED">Paused</option>
                      <option value="TERMINATED">Terminated</option>
                    </select>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="filter-select-redesigned"
                    >
                      <option value="time">Sort by Time</option>
                      <option value="score">Sort by Score</option>
                      <option value="name">Sort by Name</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="btn btn-outline btn-sm"
                    >
                      <Icon name={sortOrder === 'asc' ? "ArrowUp" : "ArrowDown"} size={16} />
                    </button>
                  </div>

                  {allAttempts.length === 0 ? (
                    <div className="empty-state-redesigned">
                      <Icon name="Users" size={64} style={{ color: '#9ca3af', marginBottom: '20px' }} />
                      <p>No attempts found</p>
                    </div>
                  ) : (
                    <div className="attempts-list-redesigned">
                      {allAttempts.map((attempt) => (
                        <div 
                          key={attempt.id} 
                          className={`attempt-item-redesigned ${selectedAttempt?.id === attempt.id ? 'expanded' : ''}`}
                        >
                          <div className="attempt-item-header-redesigned">
                            <div className="student-info-compact-redesigned">
                              <div className="student-avatar-small-redesigned">
                                {attempt.user_name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div>
                                <div className="student-name-compact-redesigned">{attempt.user_name}</div>
                                <div className="student-email-compact-redesigned">{attempt.user_email}</div>
                              </div>
                            </div>
                            
                            <div className="attempt-stats-compact-redesigned">
                              <div className="stat-compact-redesigned">
                                <span className="stat-label-compact-redesigned">Score:</span>
                                <span className="stat-value-compact-redesigned">
                                  {attempt.score !== null && attempt.score !== undefined
                                    ? `${attempt.score}/${attempt.total_marks}`
                                    : 'Pending'}
                                </span>
                              </div>
                              <div className="stat-compact-redesigned">
                                <span className="stat-label-compact-redesigned">Percentage:</span>
                                <span className="stat-value-compact-redesigned">
                                  {attempt.percentage_score !== null && attempt.percentage_score !== undefined
                                    ? `${attempt.percentage_score.toFixed(1)}%`
                                    : 'Pending'}
                                </span>
                              </div>
                              <div className="stat-compact-redesigned">
                                <span className="stat-label-compact-redesigned">Answered:</span>
                                <span className="stat-value-compact-redesigned">
                                  {attempt.answered_questions}/{attempt.total_questions}
                                </span>
                              </div>
                              <div className="stat-compact-redesigned">
                                <span className="stat-label-compact-redesigned">Time:</span>
                                <span className="stat-value-compact-redesigned">
                                  {formatDateTime(attempt.start_time)}
                                </span>
                              </div>
                            </div>

                            <span 
                              className="status-badge-compact-redesigned"
                              style={{ background: getStatusBadgeColor(attempt.status, attempt.is_passed) }}
                            >
                              {attempt.status === 'COMPLETED' 
                                ? (attempt.is_passed ? 'PASSED' : 'FAILED')
                                : attempt.status}
                            </span>

                            <div className="attempt-actions-compact-redesigned">
                              <button 
                                onClick={() => {
                                  if (selectedAttempt?.id === attempt.id) {
                                    setSelectedAttempt(null);
                                    setAttemptAnswers(null);
                                  } else {
                                    fetchAttemptAnswers(attempt.id);
                                  }
                                }}
                                className="btn btn-primary btn-sm"
                              >
                                <Icon name={selectedAttempt?.id === attempt.id ? "ChevronUp" : "ChevronDown"} size={16} />
                                {selectedAttempt?.id === attempt.id ? 'Hide' : 'View'} Answers
                              </button>
                              <button 
                                onClick={() => navigate(`/admin/attempt/${attempt.id}`)}
                                className="btn btn-outline btn-sm"
                              >
                                <Icon name="Eye" size={16} />
                              </button>
                              {(attempt.status === 'PAUSED' || attempt.status === 'TERMINATED') && (
                                <button 
                                  onClick={async () => {
                                    try {
                                      await api.post(`/exam/admin/attempts/${attempt.id}/restart/`);
                                      fetchAllAttempts();
                                      alert('Exam restarted successfully');
                                    } catch (error) {
                                      alert('Failed to restart exam');
                                    }
                                  }}
                                  className="btn btn-success btn-sm"
                                >
                                  <Icon name="Play" size={16} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expanded Answers Section */}
                          {selectedAttempt?.id === attempt.id && attemptAnswers && (
                            <div className="answers-expanded-redesigned">
                              <h4>Student Answers ({attemptAnswers.length} questions)</h4>
                              <div className="answers-list-redesigned">
                                {attemptAnswers.map((answer, index) => {
                                  const needsMarking = answer.needs_manual_marking && !answer.is_manually_marked;
                                  return (
                                    <div 
                                      key={answer.id || index}
                                      className={`answer-item-redesigned ${needsMarking ? 'needs-marking' : answer.is_correct ? 'correct' : 'incorrect'}`}
                                    >
                                      <div className="answer-header-redesigned">
                                        <div>
                                          <h5>Question {index + 1} ({answer.question.question_type})</h5>
                                          <p>{answer.question.question_text}</p>
                                          {answer.question.question_image_url && (
                                            <img 
                                              src={answer.question.question_image_url} 
                                              alt="Question" 
                                              loading="lazy" decoding="async"
                                              className="question-image-redesigned"
                                            />
                                          )}
                                        </div>
                                        <span className={`answer-status-badge-redesigned ${needsMarking ? 'pending' : answer.is_correct ? 'correct' : 'incorrect'}`}>
                                          {needsMarking ? 'Pending Review' : answer.is_correct ? 'Correct' : 'Incorrect'}
                                        </span>
                                      </div>

                                      <div className="answer-content-redesigned">
                                        {answer.selected_option ? (
                                          <div>
                                            <strong>Selected Option:</strong> {answer.selected_option.option_text}
                                            {answer.selected_option.option_image_url && (
                                              <img 
                                                src={answer.selected_option.option_image_url} 
                                                alt="Option" 
                                                loading="lazy" decoding="async"
                                                className="option-image-redesigned"
                                              />
                                            )}
                                          </div>
                                        ) : answer.answer_text ? (
                                          <div>
                                            <strong>Text Answer:</strong>
                                            <p className="answer-text-display-redesigned">{answer.answer_text}</p>
                                          </div>
                                        ) : null}

                                        {answer.answer_images && answer.answer_images.length > 0 && (
                                          <div className="answer-images-redesigned">
                                            <strong>Uploaded Images:</strong>
                                            <div className="images-grid-redesigned">
                                              {answer.answer_images.map((img, imgIndex) => (
                                                <img 
                                                  key={img.id || imgIndex}
                                                  src={img.image_url} 
                                                  alt={`Answer ${imgIndex + 1}`}
                                                  loading="lazy" decoding="async"
                                                  className="answer-image-preview-redesigned"
                                                />
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {answer.marks_awarded !== null && answer.marks_awarded !== undefined && (
                                          <div className="marks-display-redesigned">
                                            <strong>Marks Awarded:</strong> {answer.marks_awarded} / {answer.question.marks}
                                          </div>
                                        )}
                                      </div>

                                      {/* Marking Interface */}
                                      {needsMarking && (
                                        <div className="marking-interface-redesigned">
                                          <h5>Mark This Answer</h5>
                                          {markingAnswer === answer.id ? (
                                            <div className="marking-input-group-redesigned">
                                              <input
                                                type="number"
                                                min="0"
                                                max={answer.question.marks}
                                                step="0.5"
                                                value={marksInput}
                                                onChange={(e) => setMarksInput(e.target.value)}
                                                placeholder={`Max: ${answer.question.marks}`}
                                                className="marks-input-redesigned"
                                              />
                                              <span>/ {answer.question.marks}</span>
                                              <button
                                                onClick={() => handleMarkAnswer(answer.id)}
                                                className="btn btn-primary btn-sm"
                                              >
                                                Save
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setMarkingAnswer(null);
                                                  setMarksInput('');
                                                }}
                                                className="btn btn-secondary btn-sm"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              onClick={() => {
                                                setMarkingAnswer(answer.id);
                                                setMarksInput(answer.marks_awarded || '');
                                              }}
                                              className="btn btn-warning btn-sm"
                                            >
                                              <Icon name="Edit" size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                              Mark Answer
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Violations Tab */}
              {activeTab === 'violations' && (
                <div className="violations-section-redesigned">
                  {violations.length === 0 ? (
                    <div className="empty-state-redesigned">
                      <Icon name="CheckCircle" size={64} style={{ color: '#9ca3af', marginBottom: '20px' }} />
                      <p>No violations recorded</p>
                    </div>
                  ) : (
                    <div className="violations-list-redesigned">
                      {violations.map((violation, index) => (
                        <div key={violation.id || index} className="violation-item-redesigned">
                          <div className="violation-header-redesigned">
                            <div className="violation-student-redesigned">
                              <div className="student-avatar-small-redesigned">
                                {violation.student_name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div>
                                <div className="violation-student-name-redesigned">{violation.student_name || 'Unknown'}</div>
                                <div className="violation-time-redesigned">{formatDateTime(violation.timestamp)}</div>
                              </div>
                            </div>
                            <span 
                              className="severity-badge-redesigned"
                              style={{ background: getViolationSeverityColor(violation.severity) }}
                            >
                              {violation.severity}
                            </span>
                          </div>
                          
                          <div className="violation-content-redesigned">
                            <div className="violation-type-redesigned">{violation.violation_type}</div>
                            <div className="violation-description-redesigned">{violation.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamMonitor;
