// frontend/src/components/ExamInterface.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProctoring } from '../hooks/useProctoring';
import { useExam } from '../hooks/useExam';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import Icon from './Icon';
import './ExamInterface.css';

const ExamInterface = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToast();
  const { fetchExamById, startExam, submitAnswer, submitExam, pauseExam, resumeExam } = useExam();
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [answerTexts, setAnswerTexts] = useState({}); // For TEXT answer type
  const [answerImages, setAnswerImages] = useState({}); // For IMAGE_UPLOAD answer type
  const [answerAttachments, setAnswerAttachments] = useState({}); // For file attachments on TEXT answers
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
    stopProctoring,
    isInitialized,
    error: proctoringError,
    tabSwitchCount: proctoringTabSwitchCount
  } = useProctoring(attempt?.id, null); // No auto-submit on tab switching

  useEffect(() => {
    initializeExam();
  }, [examId]);

  // Prevent accidental submission on page refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Only show warning if exam is in progress and not already submitting
      if (attempt && attempt.status !== 'COMPLETED' && !submitting) {
        // Modern browsers ignore custom messages, but we can still prevent navigation
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
        return ''; // Some browsers require return value
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [attempt, submitting]);

  // Fullscreen enforcement removed - allowing normal browser usage

  // Cleanup localStorage after exam completion
  const cleanupExamLocalStorage = useCallback(() => {
    // Remove exam-related localStorage items
    const examRelatedKeys = [
      'proctoringPermissionsGranted',
      'proctoringSetupCompleted',
      // Add any other exam-specific keys here
    ];
    
    examRelatedKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Error removing localStorage key ${key}:`, error);
      }
    });
    
    // Also clean up any attempt-specific keys if they exist
    if (attempt?.id) {
      try {
        // Remove any attempt-specific data
        const attemptKey = `exam_attempt_${attempt.id}`;
        localStorage.removeItem(attemptKey);
      } catch (error) {
        console.error('Error cleaning attempt-specific localStorage:', error);
      }
    }
  }, [attempt]);

  // Define handleSubmitExam before it's used in useEffect
  const handleSubmitExam = useCallback(async (skipConfirmation = false) => {
    // Prevent multiple submissions
    if (submitting) return;
    
    // Check if exam is already completed
    if (attempt && attempt.status === 'COMPLETED') {
      cleanupExamLocalStorage();
      navigate(`/exam/results/${attempt.id}`);
      return;
    }
    
    // Skip confirmation only for auto-submit (time up)
    if (!skipConfirmation) {
      const confirmSubmit = window.confirm(
        'Are you sure you want to submit the exam? This action cannot be undone.'
      );
      
      if (!confirmSubmit) return;
    }
    
    setSubmitting(true);
    
    try {
      // Stop proctoring and camera before submitting
      if (isInitialized) {
        stopProctoring();
      }
      
      const response = await submitExam(attempt.id);
      
      // Clean up localStorage after successful submission
      cleanupExamLocalStorage();
      
      navigate(`/exam/results/${attempt.id}`);
    } catch (error) {
      console.error('Error submitting exam:', error);
      setError('Failed to submit exam. Please try again.');
      setSubmitting(false);
    }
  }, [attempt, submitting, isInitialized, stopProctoring, submitExam, navigate, cleanupExamLocalStorage]);

  useEffect(() => {
    if (attempt && exam && attempt.status !== 'COMPLETED') {
      // Calculate time remaining based on exam duration and elapsed time
      const duration = exam.duration_minutes * 60;
      const startTime = new Date(attempt.start_time).getTime();
      const currentTime = Date.now();
      const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
      const remaining = Math.max(0, duration - elapsedSeconds);
      
      setTimeRemaining(remaining);
      
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Stop proctoring and camera before auto-submitting
            if (isInitialized) {
              stopProctoring();
            }
            // Only auto-submit if exam is still in progress (not already submitted)
            // Use a closure to access current attempt status
            handleSubmitExam(true); // Skip confirmation for auto-submit
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else if (attempt && attempt.status === 'COMPLETED') {
      // If exam is already completed, redirect to results
      navigate(`/exam/results/${attempt.id}`);
    }
  }, [attempt, exam, isInitialized, stopProctoring, handleSubmitExam, navigate]);

  // Auto-start proctoring when attempt is available
  // Note: useProctoring hook already has auto-start logic, so this is redundant
  // Keeping it disabled to prevent double initialization
  // useEffect(() => {
  //   if (attempt && !isInitialized && attempt.status !== 'COMPLETED') {
  //     setTimeout(() => {
  //       startProctoring();
  //     }, 1000);
  //   }
  // }, [attempt, isInitialized, startProctoring]);

  // Cleanup: Stop proctoring when component unmounts or exam completes
  useEffect(() => {
    return () => {
      if (isInitialized) {
        stopProctoring();
      }
      // Clean up localStorage when component unmounts (e.g., if user navigates away)
      // Only clean if exam is not completed (to avoid cleaning during normal navigation)
      if (attempt && attempt.status !== 'COMPLETED') {
        // Don't clean here - let it be cleaned on submit
        // This prevents accidental cleanup during refresh
      }
    };
  }, [isInitialized, stopProctoring, attempt]);

  const initializeExam = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get exam details first
      const examResponse = await fetchExamById(examId);
      
      if (!examResponse) {
        throw new Error('No exam data received');
      }
      
      setExam(examResponse);

      // Check for existing attempts (completed or in-progress)
      try {
        const userAttemptsResponse = await api.get('/exam/user/attempts/');
        const userAttempts = userAttemptsResponse.data || [];
        
        // Check if user has already completed this exam
        const completedAttempt = userAttempts.find(
          attempt => attempt.exam_id === parseInt(examId) && attempt.status === 'COMPLETED'
        );
        
        if (completedAttempt) {
          // User has already completed this exam - redirect to results
          navigate(`/exam/results/${completedAttempt.id}`);
          return;
        }

        // Check if there's an in-progress attempt (STARTED, IN_PROGRESS, PAUSED)
        const inProgressAttempt = userAttempts.find(
          attempt => attempt.exam_id === parseInt(examId) && 
          (attempt.status === 'STARTED' || attempt.status === 'IN_PROGRESS' || attempt.status === 'PAUSED')
        );
        
        if (inProgressAttempt) {
          // Resume existing attempt instead of creating a new one
          try {
            if (inProgressAttempt.status === 'PAUSED') {
              await resumeExam(inProgressAttempt.id);
            }
            setAttempt(inProgressAttempt);
            setLoading(false);
            return;
          } catch (resumeError) {
            console.error('Error resuming exam:', resumeError);
            // If resume fails, continue to start new attempt
          }
        }
      } catch (err) {
        // If we can't fetch attempts, continue with starting exam
        console.error('Error fetching attempts:', err);
      }

      // Start new exam attempt only if no in-progress attempt exists
      const attemptResponse = await startExam(examId);
      
      if (!attemptResponse) {
        throw new Error('No attempt data received');
      }
      
      setAttempt(attemptResponse);

      setLoading(false);
    } catch (error) {
      let errorMessage = 'Failed to load exam. Please try again.';
      let redirectToResults = false;
      let completedAttemptId = null;
      
      if (error.response?.status === 400 && error.response?.data?.error) {
        const errorText = error.response.data.error;
        if (errorText.includes('already completed')) {
          // Try to find the completed attempt and redirect to results
          try {
            const userAttemptsResponse = await api.get('/exam/user/attempts/');
            const userAttempts = userAttemptsResponse.data || [];
            const completedAttempt = userAttempts.find(
              attempt => attempt.exam_id === parseInt(examId) && attempt.status === 'COMPLETED'
            );
            if (completedAttempt) {
              redirectToResults = true;
              completedAttemptId = completedAttempt.id;
            } else {
              errorMessage = 'You have already completed this exam. Please check your results from the dashboard.';
            }
          } catch (err) {
            errorMessage = 'You have already completed this exam. Please check your results from the dashboard.';
          }
        } else {
          errorMessage = errorText;
        }
      } else if (error.response?.status === 404) {
        errorMessage = 'Exam not found or not available.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to access this exam.';
      } else if (error.response?.status === 405) {
        errorMessage = 'Method not allowed. Please check the API endpoint.';
      }
      
      setError(errorMessage);
      setLoading(false);
      
      // Redirect to results if completed, otherwise to dashboard
      if (redirectToResults && completedAttemptId) {
        setTimeout(() => {
          navigate(`/exam/results/${completedAttemptId}`);
        }, 2000);
      } else {
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      }
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
      setAutoSaveStatus('Saved');
      setTimeout(() => setAutoSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error submitting answer:', error);
      setAutoSaveStatus('Error saving');
      setTimeout(() => setAutoSaveStatus(''), 3000);
    }
  };

  const handleTextAnswerChange = (questionId, text) => {
    // Only update state, don't auto-save
    setAnswerTexts({
      ...answerTexts,
      [questionId]: text
    });
    setAutoSaveStatus(''); // Clear any previous status
  };

  const handleSaveTextAnswer = async (questionId) => {
    const text = answerTexts[questionId] || '';
    const attachment = answerAttachments[questionId] ? [answerAttachments[questionId]] : [];
    try {
      setAutoSaveStatus('Saving...');
      await submitAnswer(attempt.id, questionId, null, text, [], attachment);
      setAutoSaveStatus('Saved');
      setTimeout(() => setAutoSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error submitting text answer:', error);
      setAutoSaveStatus('Error saving');
      setTimeout(() => setAutoSaveStatus(''), 3000);
    }
  };

  const handleImageUpload = (questionId, files) => {
    // Validate files (max 3, 10MB each)
    const MAX_IMAGES = 3;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    
    if (files.length > MAX_IMAGES) {
      showWarning(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    const validFiles = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > MAX_SIZE) {
        showError(`Image ${files[i].name} exceeds 10MB limit`);
        continue;
      }
      if (!files[i].type.startsWith('image/')) {
        showError(`${files[i].name} is not a valid image file`);
        continue;
      }
      validFiles.push(files[i]);
    }

    if (validFiles.length === 0) return;

    // Only update state, don't auto-save
    setAnswerImages({
      ...answerImages,
      [questionId]: validFiles
    });
    setAutoSaveStatus(''); // Clear any previous status
  };

  const handleSaveImageAnswer = async (questionId) => {
    const validFiles = answerImages[questionId] || [];
    const textAnswer = answerTexts[questionId] || '';
    
    if (validFiles.length === 0 && !textAnswer) {
      showError('Please upload at least one image or enter text');
      return;
    }

    try {
      setAutoSaveStatus('Saving...');
      await submitAnswer(attempt.id, questionId, null, textAnswer, validFiles);
      setAutoSaveStatus('Saved');
      setTimeout(() => setAutoSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error submitting image answer:', error);
      setAutoSaveStatus('Error saving');
      setTimeout(() => setAutoSaveStatus(''), 3000);
    }
  };

  const removeImage = (questionId, index) => {
    const currentImages = answerImages[questionId] || [];
    const newImages = currentImages.filter((_, i) => i !== index);
    setAnswerImages({
      ...answerImages,
      [questionId]: newImages
    });
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
    // Count all answered questions: MCQ answers, text answers, and image answers
    const mcqAnswered = Object.keys(answers).length;
    const textAnswered = Object.keys(answerTexts).filter(qId => answerTexts[qId] && answerTexts[qId].trim() !== '').length;
    const imageAnswered = Object.keys(answerImages).filter(qId => answerImages[qId] && answerImages[qId].length > 0).length;
    
    // Combine all unique question IDs that have been answered
    const allAnsweredIds = new Set([
      ...Object.keys(answers),
      ...Object.keys(answerTexts).filter(qId => answerTexts[qId] && answerTexts[qId].trim() !== ''),
      ...Object.keys(answerImages).filter(qId => answerImages[qId] && answerImages[qId].length > 0)
    ]);
    
    return allAnsweredIds.size;
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
    // Check if error is about completed exam
    const isCompletedError = error.includes('already completed');
    
    return (
      <div className="exam-error">
        <Icon name={isCompletedError ? "CheckCircle" : "AlertTriangle"} size={48} style={{ color: isCompletedError ? 'var(--success-color)' : 'var(--danger-color)', marginBottom: '20px' }} />
        <h2>{isCompletedError ? 'Exam Already Completed' : 'Error'}</h2>
        <p>{error}</p>
        {isCompletedError ? (
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
              <Icon name="Home" size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Go to Dashboard
            </button>
            <button onClick={async () => {
              try {
                const userAttemptsResponse = await api.get('/exam/user/attempts/');
                const userAttempts = userAttemptsResponse.data || [];
                const completedAttempt = userAttempts.find(
                  attempt => attempt.exam_id === parseInt(examId) && attempt.status === 'COMPLETED'
                );
                if (completedAttempt) {
                  navigate(`/exam/results/${completedAttempt.id}`);
                } else {
                  navigate('/dashboard');
                }
              } catch (err) {
                navigate('/dashboard');
              }
            }} className="btn btn-success">
              <Icon name="FileText" size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              View Results
            </button>
          </div>
        ) : (
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ marginTop: '20px' }}>
            Back to Dashboard
          </button>
        )}
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

  // Fullscreen modals removed - no longer enforcing fullscreen

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
              <Icon name="Link" size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className={`indicator ${cameraEnabled ? 'connected' : 'disconnected'}`}>
              <Icon name="Video" size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {cameraEnabled ? 'Camera ON' : 'Camera OFF'}
            </div>
            <div className={`indicator ${microphoneEnabled ? 'connected' : 'disconnected'}`}>
              <Icon name="Mic" size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {microphoneEnabled ? 'Mic ON' : 'Mic OFF'}
            </div>
            <div className={`indicator ${faceDetected ? 'detected' : 'not-detected'}`}>
              <Icon name="User" size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {faceDetected ? 'Face OK' : 'No Face'}
            </div>
            <div className="audio-indicator">
              <Icon name="Volume2" size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Audio: {Math.round(audioLevel * 100)}%
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
            <h4>
              <Icon name="AlertTriangle" size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Violations ({violations.length})
            </h4>
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
            {exam.questions.map((question, index) => {
              const questionId = question.id;
              const isAnswered = answers[questionId] || answerTexts[questionId] || (answerImages[questionId] && answerImages[questionId].length > 0);
              return (
                <button
                  key={index}
                  onClick={() => goToQuestion(index)}
                  className={`nav-btn ${index === currentQuestion ? 'active' : ''} ${
                    isAnswered ? 'answered' : 'not-attempted'
                  }`}
                  title={`Question ${index + 1}${isAnswered ? ' (Answered)' : ' (Not Attempted)'}`}
                >
                  {index + 1}
                </button>
              );
            })}
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
                {currentQ.question_image_url && (
                  <div className="question-image-container">
                    <img 
                      src={currentQ.question_image_url} 
                      alt="Question" 
                      loading="lazy" decoding="async"
                      className="question-image"
                      style={{ maxWidth: '100%', maxHeight: '400px', marginTop: '15px', borderRadius: '8px' }}
                    />
                  </div>
                )}
          </div>

          {/* MCQ/TF Options */}
          {(currentQ.question_type === 'MCQ' || currentQ.question_type === 'TF') && (
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
                  <div className="option-content">
                    {option.option_image_url && (
                      <img 
                        src={option.option_image_url} 
                        alt="Option" 
                        loading="lazy" decoding="async"
                        className="option-image"
                        style={{ maxWidth: '200px', maxHeight: '150px', marginBottom: '8px', borderRadius: '4px' }}
                      />
                    )}
                    <span className="option-text">{option.option_text}</span>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* TEXT Answer Type */}
          {currentQ.question_type === 'TEXT' && (
            <div className="text-answer-container" style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '500', color: 'var(--gray-700)' }}>
                Your Answer:
              </label>
              <textarea
                value={answerTexts[currentQ.id] || ''}
                onChange={(e) => handleTextAnswerChange(currentQ.id, e.target.value)}
                placeholder="Type your answer here..."
                className="text-answer-input"
                rows={10}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  border: '2px solid var(--gray-300)', 
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: '200px'
                }}
              />
              
              {/* File Attachment for TEXT Answer */}
              <div style={{ marginTop: '16px', padding: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#047857', fontSize: '13px' }}>
                  📎 Attach File (Optional) - PDF, DOC, DOCX, JPG, PNG, TXT
                </label>
                <input
                  type="file"
                  id={`file-${currentQ.id}`}
                  onChange={(e) => {
                    if (e.target.files?.length > 0) {
                      setAnswerAttachments({
                        ...answerAttachments,
                        [currentQ.id]: e.target.files[0]
                      });
                    }
                  }}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xlsx,.xls"
                  style={{ display: 'none' }}
                />
                <label htmlFor={`file-${currentQ.id}`} style={{
                  display: 'inline-block',
                  padding: '8px 14px',
                  background: 'white',
                  border: '2px dashed #10b981',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#047857',
                  fontWeight: '500',
                  fontSize: '13px',
                  transition: 'all 0.2s'
                }}>
                  Choose File
                </label>
                {answerAttachments[currentQ.id] && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', fontSize: '13px' }}>
                    ✓ {answerAttachments[currentQ.id].name}
                    <button
                      onClick={() => {
                        const newAttachments = { ...answerAttachments };
                        delete newAttachments[currentQ.id];
                        setAnswerAttachments(newAttachments);
                      }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => handleSaveTextAnswer(currentQ.id)}
                className="btn btn-primary"
                style={{ marginTop: '12px' }}
              >
                <Icon name="Save" size={16} style={{ marginRight: '6px' }} />
                Save Answer
              </button>
              {autoSaveStatus && (
                <small style={{ 
                  display: 'block', 
                  marginTop: '8px', 
                  color: autoSaveStatus === 'Saved' ? 'var(--success-color)' : 'var(--gray-600)',
                  fontStyle: 'italic'
                }}>
                  {autoSaveStatus}
                </small>
              )}
            </div>
          )}

          {/* Short Answer (SA) Answer Type */}
          {currentQ.question_type === 'SA' && (
            <div className="text-answer-container" style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '500', color: 'var(--gray-700)' }}>
                Your Answer:
              </label>
              <textarea
                value={answerTexts[currentQ.id] || ''}
                onChange={(e) => handleTextAnswerChange(currentQ.id, e.target.value)}
                placeholder="Type your short answer here..."
                className="text-answer-input"
                rows={6}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  border: '2px solid var(--gray-300)', 
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: '120px'
                }}
              />
              
              {/* File Attachment for SA Answer */}
              <div style={{ marginTop: '16px', padding: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#047857', fontSize: '13px' }}>
                  📎 Attach File (Optional) - PDF, DOC, DOCX, JPG, PNG, TXT
                </label>
                <input
                  type="file"
                  id={`file-sa-${currentQ.id}`}
                  onChange={(e) => {
                    if (e.target.files?.length > 0) {
                      setAnswerAttachments({
                        ...answerAttachments,
                        [currentQ.id]: e.target.files[0]
                      });
                    }
                  }}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xlsx,.xls"
                  style={{ display: 'none' }}
                />
                <label htmlFor={`file-sa-${currentQ.id}`} style={{
                  display: 'inline-block',
                  padding: '8px 14px',
                  background: 'white',
                  border: '2px dashed #10b981',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#047857',
                  fontWeight: '500',
                  fontSize: '13px',
                  transition: 'all 0.2s'
                }}>
                  Choose File
                </label>
                {answerAttachments[currentQ.id] && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', fontSize: '13px' }}>
                    ✓ {answerAttachments[currentQ.id].name}
                    <button
                      onClick={() => {
                        const newAttachments = { ...answerAttachments };
                        delete newAttachments[currentQ.id];
                        setAnswerAttachments(newAttachments);
                      }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => handleSaveTextAnswer(currentQ.id)}
                className="btn btn-primary"
                style={{ marginTop: '12px' }}
              >
                <Icon name="Save" size={16} style={{ marginRight: '6px' }} />
                Save Answer
              </button>
              {autoSaveStatus && (
                <small style={{ 
                  display: 'block', 
                  marginTop: '8px', 
                  color: autoSaveStatus === 'Saved' ? 'var(--success-color)' : 'var(--gray-600)',
                  fontStyle: 'italic'
                }}>
                  {autoSaveStatus}
                </small>
              )}
            </div>
          )}

          {/* IMAGE_UPLOAD Answer Type */}
          {currentQ.question_type === 'IMAGE_UPLOAD' && (
            <div className="image-upload-container">
              <div className="image-upload-section">
                <label 
                  className="image-upload-label"
                  htmlFor={`file-input-${currentQ.id}`}
                >
                  <Icon name="Upload" size={20} style={{ marginRight: '8px' }} />
                  Upload Answer Images (Max 3, 10MB each)
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      handleImageUpload(currentQ.id, Array.from(e.target.files));
                    }}
                    style={{ display: 'none' }}
                    disabled={(answerImages[currentQ.id] || []).length >= 3}
                    id={`file-input-${currentQ.id}`}
                  />
                </label>
                <small style={{ color: 'var(--gray-600)', display: 'block', marginTop: '8px' }}>
                  Supported formats: JPG, PNG, GIF, etc.
                </small>
              </div>

              {/* Text answer (optional) */}
              <div className="text-answer-section" style={{ marginTop: '20px' }}>
                <label>Additional Text Answer (Optional):</label>
                <textarea
                  value={answerTexts[currentQ.id] || ''}
                  onChange={(e) => handleTextAnswerChange(currentQ.id, e.target.value)}
                  placeholder="Add any additional text explanation..."
                  className="text-answer-input"
                  rows={4}
                />
              </div>

              {/* Preview uploaded images */}
              {answerImages[currentQ.id] && answerImages[currentQ.id].length > 0 && (
                <div className="uploaded-images-preview" style={{ marginTop: '20px' }}>
                  <h4>Uploaded Images:</h4>
                  <div className="images-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginTop: '10px' }}>
                    {answerImages[currentQ.id].map((file, index) => (
                      <div key={index} className="image-preview-item" style={{ position: 'relative' }}>
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Upload ${index + 1}`}
                          style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px' }}
                        />
                        <button
                          onClick={() => removeImage(currentQ.id, index)}
                          className="btn btn-sm btn-danger"
                          style={{ position: 'absolute', top: '5px', right: '5px' }}
                        >
                          <Icon name="X" size={14} />
                        </button>
                        <div style={{ fontSize: '12px', color: 'var(--gray-600)', marginTop: '5px' }}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save button for IMAGE_UPLOAD */}
              <button
                onClick={() => handleSaveImageAnswer(currentQ.id)}
                className="btn btn-primary"
                style={{ marginTop: '20px' }}
              >
                <Icon name="Save" size={16} style={{ marginRight: '6px' }} />
                Save Answer
              </button>
              {autoSaveStatus && (
                <small style={{ 
                  display: 'block', 
                  marginTop: '8px', 
                  color: autoSaveStatus === 'Saved' ? 'var(--success-color)' : 'var(--gray-600)',
                  fontStyle: 'italic'
                }}>
                  {autoSaveStatus}
                </small>
              )}
            </div>
          )}
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
