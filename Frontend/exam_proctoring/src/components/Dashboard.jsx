// frontend/src/components/Dashboard.jsx (update useEffect and error handling)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

// frontend/src/components/Dashboard.jsx (update fetchDashboardData)
const fetchDashboardData = async () => {
  try {
    setLoading(true);
    setError('');
    
    console.log('Fetching dashboard data...');
    
    // Add cache-busting parameter
    const timestamp = new Date().getTime();
    
    // Fetch exams and user stats in parallel
    const [examsResponse, statsResponse] = await Promise.all([
      api.get(`/exam/exams/?t=${timestamp}`).catch(err => {
        console.error('Error fetching exams:', err);
        console.error('Error response:', err.response);
        return { data: [] };
      }),
      api.get('/auth/stats/').catch(err => {
        console.error('Error fetching stats:', err);
        return { data: { total_attempts: 0, completed_exams: 0, average_score: 0, total_score: 0 } };
      })
    ]);
    
    console.log('Exams response:', examsResponse);
    console.log('Exams data:', examsResponse.data);
    
    // Check if exams have questions
    if (examsResponse.data && examsResponse.data.length > 0) {
      examsResponse.data.forEach((exam, index) => {
        console.log(`Exam ${index + 1}:`, {
          id: exam.id,
          title: exam.title,
          created_by: exam.created_by,
          start_time: exam.start_time,
          end_time: exam.end_time,
          is_active: exam.is_active,
          questionsLength: exam.questions?.length || 0
        });
      });
    } else {
      console.log('No exams found in response');
    }
    
    setExams(examsResponse.data || []);
    setUserStats(statsResponse.data || {});
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    setError('Failed to load dashboard data. Please refresh the page.');
  } finally {
    setLoading(false);
  }
};


const debugExamData = () => {
  console.log('=== EXAM DEBUG INFO ===');
  console.log('Current exams state:', exams);
  console.log('Exams length:', exams.length);
  
  exams.forEach((exam, index) => {
    console.log(`Exam ${index + 1}:`, {
      id: exam.id,
      title: exam.title,
      questions: exam.questions,
      questions_count: exam.questions_count,
      questionsLength: exam.questions?.length,
      subject_name: exam.subject_name,
      start_time: exam.start_time,
      end_time: exam.end_time,
      is_active: exam.is_active
    });
  });
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
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Exam Dashboard</h1>
          <div className="user-info">
            <span>Welcome, {user?.username}</span>
            <button 
              onClick={() => navigate('/admin')}
              className="btn btn-primary"
            >
              Admin Panel
            </button>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        {error && (
          <div className="error-message">
            {error}
            <button onClick={fetchDashboardData} className="btn btn-sm btn-primary" style={{marginLeft: '10px'}}>
              Retry
            </button>
            <button onClick={debugExamData} className="btn btn-secondary" style={{margin: '10px'}}>
              Debug Exam Data
            </button>
          </div>
        )}

        {/* User Stats */}
        {userStats && (
          <div className="stats-section">
            <h2>Your Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Attempts</h3>
                <p className="stat-number">{userStats.total_attempts || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Completed Exams</h3>
                <p className="stat-number">{userStats.completed_exams || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Average Score</h3>
                <p className="stat-number">{userStats.average_score || 0}%</p>
              </div>
              <div className="stat-card">
                <h3>Total Score</h3>
                <p className="stat-number">{userStats.total_score || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Available Exams */}
        <div className="exams-section">
          <h2>Available Exams</h2>
          {exams.length === 0 ? (
            <div className="no-exams">
              <p>No exams available at the moment.</p>
              <button onClick={fetchDashboardData} className="btn btn-primary">
                Refresh
              </button>
            </div>
          ) : (
            <div className="exams-grid">
              {exams.map((exam) => (
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
                    >
                      Start Exam
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
