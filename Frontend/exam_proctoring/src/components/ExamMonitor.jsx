// frontend/src/components/ExamMonitor.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './ExamMonitor.css';

const ExamMonitor = () => {
  const navigate = useNavigate();
  const [activeExams, setActiveExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [liveAttempts, setLiveAttempts] = useState([]);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchActiveExams();
    const interval = setInterval(fetchActiveExams, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedExam) {
      fetchLiveAttempts();
      fetchViolations();
      const interval = setInterval(() => {
        fetchLiveAttempts();
        fetchViolations();
      }, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [selectedExam]);

  const fetchActiveExams = async () => {
    try {
      const response = await api.get('/exam/admin/active-exams/');
      setActiveExams(response.data);
    } catch (error) {
      console.error('Error fetching active exams:', error);
    }
  };

  const fetchLiveAttempts = async () => {
    if (!selectedExam) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/exam/admin/exams/${selectedExam.id}/live-attempts/`);
      setLiveAttempts(response.data);
    } catch (error) {
      console.error('Error fetching live attempts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchViolations = async () => {
    if (!selectedExam) return;
    
    try {
      const response = await api.get(`/proctoring/admin/exams/${selectedExam.id}/violations/`);
      setViolations(response.data);
    } catch (error) {
      console.error('Error fetching violations:', error);
    }
  };

  const terminateAttempt = async (attemptId) => {
    if (!window.confirm('Are you sure you want to terminate this exam attempt?')) return;

    try {
      await api.post(`/exam/admin/attempts/${attemptId}/terminate/`);
      fetchLiveAttempts();
    } catch (error) {
      console.error('Error terminating attempt:', error);
      alert('Error terminating attempt');
    }
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

  const formatDuration = (startTime) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000 / 60); // minutes
    return `${diff} min`;
  };

  return (
    <div className="exam-monitor">
      <div className="monitor-header">
        <h1>Live Exam Monitor</h1>
        <button 
          onClick={() => navigate('/admin')}
          className="btn btn-secondary"
        >
          Back to Admin
        </button>
      </div>

      <div className="monitor-content">
        {/* Active Exams */}
        <div className="active-exams">
          <h2>Active Exams</h2>
          <div className="exam-cards">
            {activeExams.map((exam) => (
              <div 
                key={exam.id}
                className={`exam-card ${selectedExam?.id === exam.id ? 'selected' : ''}`}
                onClick={() => setSelectedExam(exam)}
              >
                <h3>{exam.title}</h3>
                <div className="exam-stats">
                  <span className="stat">
                    <span className="label">Active:</span>
                    <span className="value">{exam.active_attempts || 0}</span>
                  </span>
                  <span className="stat">
                    <span className="label">Violations:</span>
                    <span className="value">{exam.violations_count || 0}</span>
                  </span>
                </div>
                <div className="exam-time">
                  Ends: {new Date(exam.end_time).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Monitoring */}
        {selectedExam && (
          <div className="live-monitoring">
            <h2>Live Monitoring - {selectedExam.title}</h2>
            
            {loading ? (
              <div className="loading">Loading live data...</div>
            ) : (
              <div className="monitoring-grid">
                {/* Live Attempts */}
                <div className="live-attempts">
                  <h3>Active Attempts ({liveAttempts.length})</h3>
                  <div className="attempts-list">
                    {liveAttempts.map((attempt) => (
                      <div key={attempt.id} className="attempt-card">
                        <div className="attempt-header">
                          <span className="student-name">{attempt.user_name}</span>
                          <span className={`status ${attempt.status.toLowerCase()}`}>
                            {attempt.status}
                          </span>
                        </div>
                        
                        <div className="attempt-details">
                          <div className="detail">
                            <span className="label">Duration:</span>
                            <span className="value">{formatDuration(attempt.start_time)}</span>
                          </div>
                          <div className="detail">
                            <span className="label">Progress:</span>
                            <span className="value">
                              {attempt.answered_questions}/{attempt.total_questions}
                            </span>
                          </div>
                          <div className="detail">
                            <span className="label">Violations:</span>
                            <span className="value violations">
                              {attempt.violations_count || 0}
                            </span>
                          </div>
                        </div>

                        <div className="proctoring-status">
                          <div className={`indicator ${attempt.camera_status ? 'active' : 'inactive'}`}>
                            📹 Camera
                          </div>
                          <div className={`indicator ${attempt.face_detected ? 'active' : 'inactive'}`}>
                            👤 Face
                          </div>
                          <div className={`indicator ${attempt.audio_status ? 'active' : 'inactive'}`}>
                            🎤 Audio
                          </div>
                        </div>

                        <div className="attempt-actions">
                          <button 
                            onClick={() => navigate(`/admin/attempt/${attempt.id}/details`)}
                            className="btn btn-sm btn-outline"
                          >
                            View Details
                          </button>
                          <button 
                            onClick={() => terminateAttempt(attempt.id)}
                            className="btn btn-sm btn-danger"
                          >
                            Terminate
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Violations */}
                <div className="recent-violations">
                  <h3>Recent Violations</h3>
                  <div className="violations-list">
                    {violations.slice(0, 10).map((violation) => (
                      <div key={violation.id} className="violation-item">
                        <div className="violation-header">
                          <span className="student-name">{violation.student_name}</span>
                          <span 
                            className="severity"
                            style={{ color: getViolationSeverityColor(violation.severity) }}
                          >
                            {violation.severity}
                          </span>
                          <span className="timestamp">
                            {new Date(violation.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        
                        <div className="violation-details">
                          <div className="violation-type">{violation.violation_type}</div>
                          <div className="violation-description">{violation.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamMonitor;
