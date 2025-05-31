// frontend/src/components/AttemptDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './AttemptDetails.css';

const AttemptDetails = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAttemptDetails();
  }, [attemptId]);

  const fetchAttemptDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [attemptResponse, violationsResponse] = await Promise.all([
        api.get(`/exam/admin/attempts/${attemptId}/`).catch(err => {
          console.error('Error fetching attempt:', err);
          return { data: null };
        }),
        api.get(`/proctoring/admin/attempts/${attemptId}/violations/`).catch(err => {
          console.error('Error fetching violations:', err);
          return { data: [] };
        })
      ]);
      
      if (attemptResponse.data) {
        setAttempt(attemptResponse.data);
      } else {
        setError('Attempt not found');
      }
      
      setViolations(violationsResponse.data || []);
    } catch (error) {
      console.error('Error fetching attempt details:', error);
      setError('Failed to load attempt details');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading attempt details...</p>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error || 'Attempt not found'}</p>
        <button onClick={() => navigate('/admin')} className="btn btn-primary">
          Back to Admin
        </button>
      </div>
    );
  }

  return (
    <div className="attempt-details">
      <div className="attempt-details-header">
        <h1>Attempt Details</h1>
        <button 
          onClick={() => navigate('/admin')}
          className="btn btn-secondary"
        >
          Back to Admin
        </button>
      </div>
      <div className="attempt-details-content">
        <div className="attempt-info-card">
          <h2>Attempt Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Student:</span>
              <span className="value">{attempt.user_name || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="label">Email:</span>
              <span className="value">{attempt.user_email || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="label">Exam:</span>
              <span className="value">{attempt.exam_title || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="label">Status:</span>
              <span className={`status ${(attempt.status || '').toLowerCase()}`}>
                {attempt.status || 'Unknown'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Score:</span>
              <span className="value">
                {attempt.score !== null && attempt.total_marks 
                  ? `${attempt.score}/${attempt.total_marks}` 
                  : 'N/A'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Start Time:</span>
              <span className="value">
                {attempt.start_time ? formatTimestamp(attempt.start_time) : 'N/A'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">End Time:</span>
              <span className="value">
                {attempt.end_time ? formatTimestamp(attempt.end_time) : 'N/A'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Duration:</span>
              <span className="value">
                {attempt.start_time && attempt.end_time 
                  ? `${Math.round((new Date(attempt.end_time) - new Date(attempt.start_time)) / 60000)} minutes`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="proctoring-info-card">
          <h2>Proctoring Information</h2>
          <div className="proctoring-grid">
            <div className="proctoring-item">
              <span className="label">Camera:</span>
              <span className={`status ${attempt.camera_enabled ? 'active' : 'inactive'}`}>
                {attempt.camera_enabled ? '✅ Active' : '❌ Inactive'}
              </span>
            </div>
            <div className="proctoring-item">
              <span className="label">Microphone:</span>
              <span className={`status ${attempt.microphone_enabled ? 'active' : 'inactive'}`}>
                {attempt.microphone_enabled ? '✅ Active' : '❌ Inactive'}
              </span>
            </div>
            <div className="proctoring-item">
              <span className="label">Face Detection:</span>
              <span className={`status ${attempt.face_detected ? 'detected' : 'not-detected'}`}>
                {attempt.face_detected ? '✅ Detected' : '❌ Not Detected'}
              </span>
            </div>
          </div>
        </div>

        <div className="violations-card">
          <h2>Proctoring Violations ({violations.length})</h2>
          {violations.length === 0 ? (
            <div className="no-violations">
              <p>No violations recorded for this attempt.</p>
            </div>
          ) : (
            <div className="violations-list">
              {violations.map((violation, index) => (
                <div key={violation.id || index} className="violation-item">
                  <div className="violation-header">
                    <span className="violation-type">
                      {violation.violation_type || 'Unknown'}
                    </span>
                    <span className={`severity ${(violation.severity || '').toLowerCase()}`}>
                      {violation.severity || 'Unknown'}
                    </span>
                    <span className="timestamp">
                      {violation.timestamp ? formatTimestamp(violation.timestamp) : 'N/A'}
                    </span>
                  </div>
                  <div className="violation-description">
                    {violation.description || 'No description available'}
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

export default AttemptDetails;
