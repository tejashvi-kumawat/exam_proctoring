// frontend/src/components/ExamInterface.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProctoring } from '../hooks/useProctoring';
import { useExam } from '../hooks/useExam';
import './ExamInterface.css';

const ExamInterface = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { fetchExamById, startExam, submitAnswer, submitExam } = useExam();
  
  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('');
  const [error, setError] = useState('');

  const {
    isConnected,
    violations,
    audioLevel,
    faceDetected,
    cameraEnabled,
    microphoneEnabled,
    videoRef,
    startProctoring,
    isInitialized,
    error: proctoringError
  } = useProctoring(attempt?.id);

  useEffect(() => {
    initializeExam();
  }, [examId]);

  useEffect(() => {
    if (attempt && exam) {
      const duration = exam.duration_minutes * 60;
      setTimeRemaining(duration);
      
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [attempt, exam]);

  // Auto-start proctoring when attempt is available
  useEffect(() => {
    if (attempt && !isInitialized) {
      console.log('Starting proctoring for attempt:', attempt.id);
      setTimeout(() => {
        startProctoring();
      }, 1000);
    }
  }, [attempt, isInitialized, startProctoring]);

  const initializeExam = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Loading exam with ID:', examId);
      
      // Get exam details first
      const examResponse = await fetchExamById(examId);
      console.log('Exam response:', examResponse);
      
      if (!examResponse) {
        throw new Error('No exam data received');
      }
      
      setExam(examResponse);

      // Start exam attempt with POST request
      const attemptResponse = await startExam(examId);
      console.log('Attempt response:', attemptResponse);
      
      if (!attemptResponse) {
        throw new Error('No attempt data received');
      }
      
      setAttempt(attemptResponse);

      setLoading(false);
    } catch (error) {
      console.error('Error initializing exam:', error);
      
      let errorMessage = 'Failed to load exam. Please try again.';
      
      if (error.response?.status === 404) {
        errorMessage = 'Exam not found or not available.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to access this exam.';
      } else if (error.response?.status === 405) {
        errorMessage = 'Method not allowed. Please check the API endpoint.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      setError(errorMessage);
      setLoading(false);
      
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    }
  };

  const handleAnswerSelect = async (questionId, optionId) => {
    const newAnswers = {
      ...answers,
      [questionId]: optionId
    };
    setAnswers(newAnswers);

    // Auto-save answer
    try {
      setAutoSaveStatus('Saving...');
      await submitAnswer(attempt.id, questionId, optionId);
      setAutoSaveStatus('Saved ✓');
      setTimeout(() => setAutoSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error submitting answer:', error);
      setAutoSaveStatus('Error saving');
      setTimeout(() => setAutoSaveStatus(''), 3000);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < exam.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const goToQuestion = (index) => {
    setCurrentQuestion(index);
  };

  const handleSubmitExam = async () => {
    if (submitting) return;
    
    const confirmSubmit = window.confirm(
      'Are you sure you want to submit the exam? This action cannot be undone.'
    );
    
    if (!confirmSubmit) return;
    
    setSubmitting(true);
    
    try {
      const response = await submitExam(attempt.id);
      navigate(`/exam/results/${attempt.id}`);
    } catch (error) {
      console.error('Error submitting exam:', error);
      setError('Failed to submit exam. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getAnsweredQuestionsCount = () => {
    return Object.keys(answers).length;
  };

  if (loading) {
    return (
      <div className="exam-loading">
        <div className="loading-spinner"></div>
        <p>Loading exam...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="exam-error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!exam || !attempt) {
    return (
      <div className="exam-error">
        <h2>Exam Not Available</h2>
        <p>Failed to load exam. Please try again.</p>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const currentQ = exam.questions[currentQuestion];

  return (
    <div className="exam-interface">
      {/* Proctoring Panel */}
      <div className="proctoring-panel">
        <div className="proctoring-header">
          <h3>Proctoring Monitor</h3>
          {proctoringError && (
            <div className="proctoring-error">
              <small>Error: {proctoringError}</small>
            </div>
          )}
        </div>
        
        <div className="proctoring-video">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline
            className="proctoring-video-element"
          />
          <div className="proctoring-indicators">
            <div className={`indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              🔗 {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className={`indicator ${cameraEnabled ? 'connected' : 'disconnected'}`}>
              📹 {cameraEnabled ? 'Camera ON' : 'Camera OFF'}
            </div>
            <div className={`indicator ${microphoneEnabled ? 'connected' : 'disconnected'}`}>
              🎤 {microphoneEnabled ? 'Mic ON' : 'Mic OFF'}
            </div>
            <div className={`indicator ${faceDetected ? 'detected' : 'not-detected'}`}>
              👤 {faceDetected ? 'Face OK' : 'No Face'}
            </div>
            <div className="audio-indicator">
              🔊 Audio: {Math.round(audioLevel * 100)}%
            </div>
          </div>
          
          {!isInitialized && (
            <div className="proctoring-status">
              <p>Initializing proctoring...</p>
            </div>
          )}
        </div>
        
        {violations.length > 0 && (
          <div className="violations-alert">
            <h4>⚠️ Violations ({violations.length})</h4>
            <div className="violations-list">
              {violations.slice(-3).map((violation, index) => (
                <div key={index} className="violation-item">
                  <span className="violation-type">
                    {violation.type || violation.violation_type}
                  </span>
                  <span className="violation-time">
                    {new Date(violation.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="exam-progress">
          <h4>Progress</h4>
          <div className="progress-stats">
            <div className="stat">
              <span className="label">Answered:</span>
              <span className="value">{getAnsweredQuestionsCount()}/{exam.questions.length}</span>
            </div>
            <div className="stat">
              <span className="label">Current:</span>
              <span className="value">{currentQuestion + 1}</span>
            </div>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${(getAnsweredQuestionsCount() / exam.questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Exam Content */}
      <div className="exam-content">
        {/* Header */}
        <div className="exam-header">
          <div className="exam-info">
            <h1>{exam.title}</h1>
            <div className="exam-meta">
              <span>Question {currentQuestion + 1} of {exam.questions.length}</span>
              {autoSaveStatus && (
                <span className="auto-save-status">{autoSaveStatus}</span>
              )}
            </div>
          </div>
          <div className="exam-timer">
            <div className={`timer ${timeRemaining < 300 ? 'warning' : ''} ${timeRemaining < 60 ? 'critical' : ''}`}>
              ⏰ {formatTime(timeRemaining)}
            </div>
          </div>
        </div>

        {/* Question Navigation */}
        <div className="question-navigation">
          <div className="nav-grid">
            {exam.questions.map((_, index) => (
              <button
                key={index}
                onClick={() => goToQuestion(index)}
                className={`nav-btn ${index === currentQuestion ? 'active' : ''} ${
                  answers[exam.questions[index].id] ? 'answered' : ''
                }`}
                title={`Question ${index + 1}${answers[exam.questions[index].id] ? ' (Answered)' : ''}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Question Content */}
        <div className="question-content">
          <div className="question-header">
            <div className="question-info">
              <h2>Question {currentQuestion + 1}</h2>
              <span className="question-marks">Marks: {currentQ.marks}</span>
              <span className="question-type">{currentQ.question_type}</span>
            </div>
          </div>

          <div className="question-text">
            <p>{currentQ.question_text}</p>
          </div>

          <div className="options-container">
            {currentQ.options && currentQ.options.map((option) => (
              <label
                key={option.id}
                className={`option-label ${
                  answers[currentQ.id] === option.id ? 'selected' : ''
                }`}
              >
                <input
                  type="radio"
                  name={`question-${currentQ.id}`}
                  value={option.id}
                  checked={answers[currentQ.id] === option.id}
                  onChange={() => handleAnswerSelect(currentQ.id, option.id)}
                />
                <span className="option-indicator"></span>
                <span className="option-text">{option.option_text}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="question-actions">
          <div className="nav-buttons">
            <button
              onClick={previousQuestion}
              disabled={currentQuestion === 0}
              className="btn btn-secondary"
            >
              ← Previous
            </button>
            
            <button
              onClick={nextQuestion}
              disabled={currentQuestion === exam.questions.length - 1}
              className="btn btn-secondary"
            >
              Next →
            </button>
          </div>
          
          <div className="submit-section">
            <button
              onClick={handleSubmitExam}
              disabled={submitting}
              className="btn btn-danger submit-btn"
            >
              {submitting ? 'Submitting...' : 'Submit Exam'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamInterface;
