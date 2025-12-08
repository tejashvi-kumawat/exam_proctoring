// frontend/src/components/AttemptDetails.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import Icon from './Icon';
import Logo from './Logo';
import './AttemptDetails.css';
import '../CompactStats.css';

const AttemptDetails = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, confirm } = useToast();
  const [attempt, setAttempt] = useState(null);
  const [violations, setViolations] = useState([]);
  const [highlightedViolationId, setHighlightedViolationId] = useState(null);
  const violationListRef = React.useRef(null);
  const highlightTimeoutRef = React.useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [violationsLoading, setViolationsLoading] = useState(false);
  const [markingAnswer, setMarkingAnswer] = useState(null);
  const [marksInput, setMarksInput] = useState('');
  const [solutionText, setSolutionText] = useState('');
  const [solutionFiles, setSolutionFiles] = useState([]);
  const [editingSolutionFor, setEditingSolutionFor] = useState(null);
  const [editingSolutionText, setEditingSolutionText] = useState('');
  const [editingSolutionFiles, setEditingSolutionFiles] = useState([]);
  const [solutionUploading, setSolutionUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [filter, setFilter] = useState('all'); // all, correct, incorrect, not-answered, pending
  
  const [releasingResults, setReleasingResults] = useState(false);
  

  useEffect(() => {
    fetchAttemptDetails();
  }, [attemptId]);

  const fetchAttemptDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [attemptResponse, violationsResponse] = await Promise.all([
        api.get(`/exam/admin/attempts/${attemptId}/`).catch(err => {
          return { data: null };
        }),
        api.get(`/proctoring/admin/attempts/${attemptId}/violations/`).catch(err => {
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
      setError('Failed to load attempt details');
    } finally {
      setLoading(false);
    }
  };

  // On-demand violations refresh to avoid continuous polling
  const refreshViolations = async () => {
    if (!attemptId) return;
    try {
      setViolationsLoading(true);
      const resp = await api.get(`/proctoring/admin/attempts/${attemptId}/violations/`);
      const latest = resp.data || [];
      setViolations(latest);
    } catch (e) {
      // ignore refresh errors to keep UI quiet
    } finally {
      setViolationsLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  const handleMarkAnswer = async (answerId) => {
    if (!answerId) {
      showError('Cannot mark an unanswered question. Student did not submit any answer.');
      return;
    }
    
    if (!marksInput || marksInput === '') {
      showError('Please enter marks');
      return;
    }

    const marks = parseFloat(marksInput);
    const answer = attempt.answers.find(a => a.id === answerId);
    if (!answer) return;

    if (marks < 0 || marks > answer.question.marks) {
      showError(`Marks must be between 0 and ${answer.question.marks}`);
      return;
    }

    try {
      // Always send only marks in the mark endpoint. Solution edits are separate.
      const response = await api.post(`/exam/admin/answers/${answerId}/mark/`, {
        marks_awarded: marks,
        is_correct: marks > 0
      });

      const updatedAnswers = attempt.answers.map(a => 
        a.id === answerId 
          ? { ...a, marks_awarded: marks, is_correct: marks > 0, is_manually_marked: true }
          : a
      );

      setAttempt({
        ...attempt,
        answers: updatedAnswers,
        score: response.data.attempt_score || attempt.score
      });

      setMarkingAnswer(null);
      setMarksInput('');
      showSuccess('Answer marked successfully!');
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to mark answer');
    }
  };

  const handleReleaseResults = async () => {
    if (attempt.results_ready) {
      showError('Results are already released');
      return;
    }
    const confirmed = await confirm('Are you sure you want to release results? Students will be able to see their marks and any per-question solutions after this.');
    if (!confirmed) return;

    try {
      setReleasingResults(true);
      await api.post(`/exam/admin/attempts/${attemptId}/release-results/`);
      setAttempt({ ...attempt, results_ready: true });
      showSuccess('Results released successfully');
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to release results');
    } finally {
      setReleasingResults(false);
    }
  };

  const handleRestartExam = async () => {
    const confirmed = await confirm(`Are you sure you want to restart the exam for ${attempt.user_name}? All their answers will be deleted and they will need to retake the exam.`);
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.post(`/exam/admin/attempts/${attemptId}/restart/`);
      showSuccess(`Exam restarted successfully! New attempt ID: ${response.data.new_attempt_id}`);
      navigate('/admin');
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to restart exam');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSolutions = async () => {
    const confirmed = await confirm(
      'Delete all solution files (images/attachments)?\n\nThis will permanently delete uploaded files but keep text answers and marks. Cannot be undone!'
    );
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.delete(`/exam/admin/attempts/${attemptId}/delete-solutions/`);
      showSuccess(`Deleted ${response.data.deleted_counts.images} images and ${response.data.deleted_counts.attachments} attachments`);
      // Refresh attempt details to update UI
      fetchAttemptDetails();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete solutions');
    } finally {
      setLoading(false);
    }
  };

  

  const getAnswerStatus = (answer) => {
    if (answer.needs_manual_marking && !answer.is_manually_marked) {
      return { status: 'pending', label: 'Pending Review', color: '#f59e0b' };
    }
    if (!answer.selected_option && !answer.answer_text && (!answer.answer_images || answer.answer_images.length === 0)) {
      return { status: 'not-answered', label: 'Not Answered', color: '#6b7280' };
    }
    if (answer.is_correct) {
      return { status: 'correct', label: 'Correct', color: '#10b981' };
    }
    return { status: 'incorrect', label: 'Incorrect', color: '#ef4444' };
  };

  const filteredAnswers = useMemo(() => {
    if (!attempt?.answers) return [];
    if (filter === 'all') return attempt.answers;
    if (filter === 'correct') return attempt.answers.filter(a => a.is_correct === true);
    if (filter === 'incorrect') return attempt.answers.filter(a => a.is_correct === false && (a.selected_option || a.answer_text));
    if (filter === 'not-answered') return attempt.answers.filter(a => !a.selected_option && !a.answer_text && (!a.answer_images || a.answer_images.length === 0));
    if (filter === 'pending') return attempt.answers.filter(a => a.needs_manual_marking && !a.is_manually_marked);
    return attempt.answers;
  }, [attempt?.answers, filter]);

  const currentAnswer = filteredAnswers[currentQuestionIndex] || null;
  const currentQuestionNumber = currentAnswer 
    ? attempt.answers.findIndex(a => a.id === currentAnswer.id) + 1 
    : 0;

  // Statistics
  const stats = useMemo(() => {
    if (!attempt?.answers) return null;
    const answers = attempt.answers;
    return {
      total: answers.length,
      correct: answers.filter(a => a.is_correct === true).length,
      incorrect: answers.filter(a => a.is_correct === false && (a.selected_option || a.answer_text)).length,
      notAnswered: answers.filter(a => !a.selected_option && !a.answer_text && (!a.answer_images || a.answer_images.length === 0)).length,
      pending: answers.filter(a => a.needs_manual_marking && !a.is_manually_marked).length
    };
  }, [attempt?.answers]);

  if (loading) {
    return (
      <div className="loading-container-attempt">
        <div className="loading-spinner-attempt"></div>
        <p>Loading attempt details...</p>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="error-container-attempt">
        <Icon name="AlertCircle" size={48} style={{ color: '#ef4444', marginBottom: '20px' }} />
        <h2>Error</h2>
        <p>{error || 'Attempt not found'}</p>
        <button onClick={() => navigate('/admin')} className="btn btn-primary">
          Back to Admin
        </button>
      </div>
    );
  }

  return (
    <div className="attempt-details-redesigned">
      {/* Header */}
      <div className="header-professional">
        <div className="header-left">
          <button 
            onClick={() => navigate('/admin')}
            className="btn btn-icon"
          >
            <Icon name="ArrowLeft" size={18} />
          </button>
          <Logo size="small" onClick={() => navigate('/admin')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px', minWidth: 0 }}>
            <span style={{ fontWeight: 600, color: 'var(--gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attempt.user_name || 'N/A'}</span>
            <span style={{ color: 'var(--gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attempt.exam_title || 'N/A'}</span>
          </div>
        </div>
        <div className="header-right">
          <span className={`badge ${
            attempt.status === 'COMPLETED' ? 'badge-success' : 
            attempt.status === 'IN_PROGRESS' ? 'badge-primary' : 
            'badge-danger'
          }`}>
            {attempt.status || 'Unknown'}
          </span>
          {attempt.status === 'COMPLETED' && (
            <button
              onClick={handleReleaseResults}
              className={attempt.results_ready ? 'btn btn-sm btn-secondary' : 'btn btn-sm btn-primary'}
              disabled={attempt.results_ready}
            >
              <Icon name={attempt.results_ready ? "CheckCircle" : "Send"} size={16} />
              {attempt.results_ready ? 'Released' : 'Release'}
            </button>
          )}
          {(attempt.status === 'COMPLETED' || attempt.status === 'IN_PROGRESS' || attempt.status === 'PAUSED') && (
            <>
              <button
                onClick={handleDeleteSolutions}
                className="btn btn-sm btn-danger"
                title="Delete solution files (images/attachments)"
              >
                <Icon name="FileX" size={16} />
                Delete Files
              </button>
              <button
                onClick={handleRestartExam}
                className="btn btn-sm btn-secondary"
              >
                <Icon name="RotateCcw" size={16} />
                Restart
              </button>
            </>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* Student Info */}
        <div className="info-grid">
          <div className="info-card-pro">
            <div className="info-icon">
              <Icon name="User" size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="info-content">
              <span className="info-label">Student</span>
              <span className="info-value">{attempt.user_name || 'N/A'}</span>
              <span className="info-sub">{attempt.user_email || 'N/A'}</span>
            </div>
          </div>
          <div className="info-card-pro">
            <div className="info-icon">
              <Icon name="Award" size={20} style={{ color: 'var(--success)' }} />
            </div>
            <div className="info-content">
              <span className="info-label">Score</span>
              <span className="info-value">
                {attempt.score !== null && attempt.total_marks 
                  ? `${attempt.score}/${attempt.total_marks}` 
                  : 'Pending'}
              </span>
              <span className="info-sub">
                {attempt.percentage_score !== null && attempt.percentage_score !== undefined
                  ? `${attempt.percentage_score.toFixed(1)}%`
                  : '-'}
              </span>
            </div>
          </div>
          <div className="info-card-pro">
            <div className="info-icon">
              <Icon name="Clock" size={20} style={{ color: 'var(--warning)' }} />
            </div>
            <div className="info-content">
              <span className="info-label">Duration</span>
              <span className="info-value">
                {attempt.start_time && attempt.end_time 
                  ? `${Math.round((new Date(attempt.end_time) - new Date(attempt.start_time)) / 60000)} min`
                  : 'N/A'}
              </span>
              <span className="info-sub">
                {attempt.start_time && new Date(attempt.start_time).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="info-card-pro">
            <div className="info-icon">
              <Icon name="AlertTriangle" size={20} style={{ color: 'var(--danger)' }} />
            </div>
            <div className="info-content">
              <span className="info-label">Violations</span>
              <span className="info-value">{violations.length}</span>
              <span className="info-sub">Proctoring issues</span>
            </div>
          </div>
        </div>

        {/* Answer Statistics */}
        {stats && (
          <div className="stats-row">
            <div className="stat-card-pro">
              <div className="stat-icon-pro">
                <Icon name="FileText" size={22} style={{ color: 'var(--primary)' }} />
              </div>
              <div className="stat-content-pro">
                <span className="stat-value-pro">{stats.total}</span>
                <span className="stat-label-pro">Total Questions</span>
              </div>
            </div>
            <div className="stat-card-pro">
              <div className="stat-icon-pro">
                <Icon name="CheckCircle" size={22} style={{ color: 'var(--success)' }} />
              </div>
              <div className="stat-content-pro">
                <span className="stat-value-pro">{stats.correct}</span>
                <span className="stat-label-pro">Correct</span>
              </div>
            </div>
            <div className="stat-card-pro">
              <div className="stat-icon-pro">
                <Icon name="XCircle" size={22} style={{ color: 'var(--danger)' }} />
              </div>
              <div className="stat-content-pro">
                <span className="stat-value-pro">{stats.incorrect}</span>
                <span className="stat-label-pro">Incorrect</span>
              </div>
            </div>
            <div className="stat-card-pro">
              <div className="stat-icon-pro">
                <Icon name="MinusCircle" size={22} style={{ color: 'var(--gray-500)' }} />
              </div>
              <div className="stat-content-pro">
                <span className="stat-value-pro">{stats.notAnswered}</span>
                <span className="stat-label-pro">Not Answered</span>
              </div>
            </div>
            {stats.pending > 0 && (
              <div className="stat-card-pro">
                <div className="stat-icon-pro">
                  <Icon name="Clock" size={22} style={{ color: 'var(--warning)' }} />
                </div>
                <div className="stat-content-pro">
                  <span className="stat-value-pro">{stats.pending}</span>
                  <span className="stat-label-pro">Pending Review</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filter Dropdown */}
        <div className="filter-section">
          <div className="filter-label">
            <Icon name="Filter" size={16} />
            Filter:
          </div>
          <select 
            className="filter-select"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setCurrentQuestionIndex(0);
            }}
          >
            <option value="all">All ({stats?.total || 0})</option>
            <option value="correct">Correct ({stats?.correct || 0})</option>
            <option value="incorrect">Incorrect ({stats?.incorrect || 0})</option>
            <option value="not-answered">Not Answered ({stats?.notAnswered || 0})</option>
            {stats?.pending > 0 && (
              <option value="pending">Pending ({stats.pending})</option>
            )}
          </select>
        </div>

        {/* Question Navigation */}
        {filteredAnswers.length > 0 && (
          <div className="question-navigation-attempt">
            <div className="question-counter-attempt">
              Question {currentQuestionIndex + 1} of {filteredAnswers.length}
            </div>
            <div className="question-nav-buttons-attempt">
              <button
                onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0}
                className="nav-btn-attempt"
              >
                <Icon name="ChevronLeft" size={20} />
                Previous
              </button>
              <button
                onClick={() => setCurrentQuestionIndex(Math.min(filteredAnswers.length - 1, currentQuestionIndex + 1))}
                disabled={currentQuestionIndex === filteredAnswers.length - 1}
                className="nav-btn-attempt"
              >
                Next
                <Icon name="ChevronRight" size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Question Display */}
        {currentAnswer ? (
          <div className="question-display-attempt">
            <div className={`question-card-attempt ${getAnswerStatus(currentAnswer).status}`}>
              <div className="question-header-attempt">
                <div className="question-number-attempt">
                  Question {currentQuestionNumber}
                  <span className="question-type-badge-attempt">{currentAnswer.question.question_type}</span>
                </div>
                <div className={`answer-status-badge-attempt ${getAnswerStatus(currentAnswer).status}`} style={{ background: getAnswerStatus(currentAnswer).color }}>
                  {getAnswerStatus(currentAnswer).label}
                </div>
              </div>

              <div className="question-content-attempt">
                <h3>{currentAnswer.question.question_text}</h3>
                {currentAnswer.question.question_image_url && (
                  <img 
                    src={currentAnswer.question.question_image_url} 
                    alt="Question" 
                    loading="lazy" decoding="async"
                    className="question-image-attempt"
                  />
                )}
              </div>

              <div className="answer-section-attempt">
                <h4>Student Answer:</h4>
                {currentAnswer.selected_option ? (
                  <div className="answer-display-attempt">
                    <div className="selected-option-attempt">
                      {currentAnswer.selected_option.option_image_url && (
                        <img 
                          src={currentAnswer.selected_option.option_image_url} 
                          alt="Option" 
                          loading="lazy" decoding="async"
                          className="option-image-attempt"
                        />
                      )}
                      <span>{currentAnswer.selected_option.option_text}</span>
                    </div>
                    {!currentAnswer.is_correct && currentAnswer.question.options && (
                      <div className="correct-answer-display-attempt">
                        <strong>Correct Answer:</strong>
                        {currentAnswer.question.options.find(opt => opt.is_correct)?.option_image_url && (
                          <img 
                            src={currentAnswer.question.options.find(opt => opt.is_correct).option_image_url} 
                            alt="Correct Option" 
                            loading="lazy" decoding="async"
                            className="option-image-attempt"
                          />
                        )}
                        <span>{currentAnswer.question.options.find(opt => opt.is_correct)?.option_text || 'N/A'}</span>
                      </div>
                    )}
                  </div>
                ) : currentAnswer.answer_text ? (
                  <div className="answer-display-attempt">
                    <div className="text-answer-attempt">
                      {currentAnswer.answer_text}
                    </div>
                  </div>
                ) : currentAnswer.answer_images && currentAnswer.answer_images.length > 0 ? (
                  <div className="answer-display-attempt">
                    <div className="images-answer-attempt">
                        {currentAnswer.answer_images.map((img, idx) => {
                          return (
                            <img 
                              key={img.id || idx}
                              src={img.image_url} 
                              alt={`Answer ${idx + 1}`}
                              loading="lazy" 
                              decoding="async" 
                              className="answer-image-attempt"
                            />
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div className="not-answered-display-attempt">
                    <Icon name="MinusCircle" size={24} style={{ color: '#9ca3af', marginRight: '8px' }} />
                    Not Answered
                  </div>
                )}

                {/* Answer Attachments Display */}
                {currentAnswer.attachments && currentAnswer.attachments.length > 0 && (
                  <div className="answer-attachments-display-attempt">
                    <h5 style={{ marginTop: '20px', marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>
                      <Icon name="Paperclip" size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                      Student Attachments
                    </h5>
                    <div className="attachments-list-attempt">
                      {currentAnswer.attachments.map((attachment) => (
                        <div key={attachment.id} className="attachment-item-attempt">
                          <Icon name="File" size={16} style={{ marginRight: '8px', color: '#6b7280' }} />
                          <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" className="attachment-link-attempt">
                            {attachment.file_name}
                          </a>
                          <span className="attachment-size-attempt" style={{ color: '#9ca3af', fontSize: '12px' }}>
                            {(attachment.file_size / 1024).toFixed(2)} KB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentAnswer.marks_awarded !== null && currentAnswer.marks_awarded !== undefined && (
                  <div className="marks-display-attempt">
                    <strong>Marks Awarded:</strong> {currentAnswer.marks_awarded} / {currentAnswer.question.marks}
                  </div>
                )}

                {/* Marking Interface - Combined and Compact */}
                <div className="marking-solution-combined-attempt">
                  {/* Marks Section */}
                  <div className="marking-interface-attempt">
                    <h5>
                      <Icon name="Award" size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                      Marks
                    </h5>
                    {!currentAnswer.id ? (
                      <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '6px', color: '#6b7280', fontSize: '14px' }}>
                        <Icon name="AlertCircle" size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        Question not answered - no marks to award
                      </div>
                    ) : markingAnswer === currentAnswer.id ? (
                      <div className="marking-input-group-attempt">
                        <input
                          type="number"
                          min="0"
                          max={currentAnswer.question.marks}
                          step="0.5"
                          value={marksInput}
                          onChange={(e) => setMarksInput(e.target.value)}
                          placeholder={`Max: ${currentAnswer.question.marks}`}
                          className="marks-input-attempt"
                        />
                        <span>/ {currentAnswer.question.marks}</span>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button
                            onClick={() => handleMarkAnswer(currentAnswer.id)}
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
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setMarkingAnswer(currentAnswer.id);
                          setMarksInput(currentAnswer.marks_awarded || '');
                        }}
                        className={`btn btn-sm ${
                          currentAnswer.marks_awarded !== null && currentAnswer.marks_awarded !== undefined 
                            ? 'btn-warning' 
                            : 'btn-primary'
                        }`}
                      >
                        <Icon name="Edit" size={14} style={{ marginRight: '6px' }} />
                        {currentAnswer.marks_awarded !== null && currentAnswer.marks_awarded !== undefined 
                          ? 'Edit' 
                          : 'Add Marks'}
                      </button>
                    )}
                  </div>

                  {/* Solution Section */}
                  <div className="solution-editor-container-attempt">
                    <h5>
                      <Icon name="BookOpen" size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                      Solution
                    </h5>
                    
                    {!currentAnswer.id ? (
                      <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '6px', color: '#6b7280', fontSize: '14px' }}>
                        <Icon name="AlertCircle" size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        Solutions can only be added for answered questions
                      </div>
                    ) : editingSolutionFor === currentAnswer.id ? (
                    <div className="solution-editor-form-attempt">
                      <textarea 
                        value={editingSolutionText} 
                        onChange={(e) => setEditingSolutionText(e.target.value)} 
                        placeholder="Enter solution explanation for this answer..."
                        className="solution-textarea-attempt"
                      />
                      
                      {/* Drag-and-drop area for solution files */}
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                        onDrop={(e) => {
                          e.preventDefault(); setIsDragging(false);
                          const files = Array.from(e.dataTransfer.files || []);
                          if (files.length) {
                            setEditingSolutionFiles(prev => [...prev, ...files]);
                          }
                        }}
                        className={`solution-drag-area-attempt ${isDragging ? 'active' : ''}`}
                      >
                        <Icon name="Upload" size={32} style={{ color: isDragging ? '#2563eb' : '#d1d5db', marginBottom: 8 }} />
                        <div>Drag & drop files here, or</div>
                        <label style={{ color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>
                          <input
                            type="file"
                            accept="image/*,.pdf,.doc,.docx,.txt"
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              if (files.length) setEditingSolutionFiles(prev => [...prev, ...files]);
                              e.target.value = null;
                            }}
                            style={{ display: 'none' }}
                          />
                          Browse
                        </label>
                      </div>

                      {/* File previews */}
                      {editingSolutionFiles.length > 0 && (
                        <div className="solution-files-preview-attempt">
                          {editingSolutionFiles.map((f, idx) => {
                            const isImage = f.type && f.type.startsWith('image/');
                            const url = URL.createObjectURL(f);
                            return (
                              <div key={idx} className="solution-file-card-attempt">
                                {isImage ? (
                                  <img src={url} alt={f.name} loading="lazy" decoding="async" className="solution-file-preview-attempt" />
                                ) : (
                                  <div className="solution-file-icon-attempt">{f.name.split('.').pop().toUpperCase()}</div>
                                )}
                                <div className="solution-file-name-attempt">{f.name}</div>
                                <button 
                                  type="button" 
                                  onClick={() => setEditingSolutionFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="btn btn-sm btn-danger"
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="solution-actions-attempt">
                        <button 
                          className="btn btn-primary" 
                          onClick={async () => {
                            setSolutionUploading(true);
                            try {
                              // update solution text
                              await api.put(`/exam/admin/answers/${currentAnswer.id}/solution/`, { solution_text: editingSolutionText });
                              // upload files if present
                              if (editingSolutionFiles.length > 0) {
                                const form = new FormData();
                                editingSolutionFiles.forEach(f => form.append('files', f));
                                const resp = await api.post(`/exam/admin/answers/${currentAnswer.id}/solutions/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
                                const created = resp.data.created || [];
                                setAttempt(prev => ({
                                  ...prev,
                                  answers: prev.answers.map(a => a.id === currentAnswer.id ? {
                                    ...a,
                                    solution_attachments: [...(a.solution_attachments || []), ...created]
                                  } : a)
                                }));
                              }
                              setAttempt(prev => ({
                                ...prev,
                                answers: prev.answers.map(a => a.id === currentAnswer.id ? { ...a, solution_text: editingSolutionText } : a)
                              }));
                              setEditingSolutionFor(null);
                              setEditingSolutionText('');
                              setEditingSolutionFiles([]);
                              showSuccess('Solution saved successfully');
                            } catch (err) {
                              showError(err.response?.data?.error || 'Failed to save solution');
                            } finally {
                              setSolutionUploading(false);
                            }
                          }} 
                          disabled={solutionUploading}
                        >
                          {solutionUploading ? 'Saving...' : 'Save Solution'}
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => { 
                            setEditingSolutionFor(null); 
                            setEditingSolutionText(''); 
                            setEditingSolutionFiles([]); 
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    ) : (
                      <div className="solution-display-attempt">
                        {currentAnswer.solution_text || (currentAnswer.solution_attachments && currentAnswer.solution_attachments.length > 0) ? (
                          <>
                            {currentAnswer.solution_text && (
                              <div className="existing-solution-text-compact">
                                {currentAnswer.solution_text}
                              </div>
                            )}
                            
                            {currentAnswer.solution_attachments && currentAnswer.solution_attachments.length > 0 && (
                              <div className="solution-attachments-compact">
                                {currentAnswer.solution_attachments.map(att => {
                                  const ext = (att.file_type || '').toLowerCase();
                                  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                                  return (
                                    <div key={att.id} className="attachment-chip-compact">
                                      <Icon name={isImage ? "Image" : "File"} size={14} />
                                      <span>{att.file_name}</span>
                                      <a href={att.file_url} download className="download-icon">
                                        <Icon name="Download" size={12} />
                                      </a>
                                      <button 
                                        className="delete-icon" 
                                        onClick={async () => {
                                          const confirmed = await confirm(`Delete ${att.file_name}?`);
                                          if (!confirmed) return;
                                          try {
                                            await api.delete(`/exam/admin/answers/solutions/${att.id}/`);
                                            setAttempt(prev => ({
                                              ...prev,
                                              answers: prev.answers.map(a => a.id === currentAnswer.id ? {
                                                ...a,
                                                solution_attachments: (a.solution_attachments || []).filter(sa => sa.id !== att.id)
                                              } : a)
                                            }));
                                            showSuccess('Deleted');
                                          } catch (err) {
                                            showError('Failed to delete');
                                          }
                                        }}
                                      >
                                        <Icon name="X" size={12} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="no-solution-compact">No solution added</p>
                        )}

                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            setEditingSolutionFor(currentAnswer.id);
                            setEditingSolutionText(currentAnswer.solution_text || '');
                          }}
                        >
                          <Icon name="Edit" size={14} style={{ marginRight: 4 }} />
                          {currentAnswer.solution_text || (currentAnswer.solution_attachments && currentAnswer.solution_attachments.length > 0) ? 'Edit' : 'Add'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-questions-attempt">
            <Icon name="FileText" size={64} style={{ color: '#9ca3af', marginBottom: '20px' }} />
            <p>No questions match the selected filter</p>
          </div>
        )}

        {/* Questions Overview */}
        {attempt.answers && attempt.answers.length > 0 && (
          <div className="questions-overview-attempt">
            <h3>All Questions Overview</h3>
            <div className="questions-grid-attempt">
              {attempt.answers.map((answer, index) => {
                const status = getAnswerStatus(answer);
                return (
                  <button
                    key={answer.id || index}
                    onClick={() => {
                      const filteredIndex = filteredAnswers.findIndex(a => a.id === answer.id);
                      if (filteredIndex !== -1) {
                        setCurrentQuestionIndex(filteredIndex);
                      } else {
                        setFilter('all');
                        setTimeout(() => {
                          const newIndex = attempt.answers.findIndex(a => a.id === answer.id);
                          if (newIndex !== -1) {
                            const filteredIdx = filteredAnswers.findIndex(a => a.id === answer.id);
                            setCurrentQuestionIndex(filteredIdx);
                          }
                        }, 100);
                      }
                    }}
                    className={`question-mini-card-attempt ${status.status} ${currentQuestionNumber === index + 1 ? 'active' : ''}`}
                  >
                    <div className="question-mini-number-attempt">Q{index + 1}</div>
                    <div className={`question-mini-status-attempt ${status.status}`} style={{ background: status.color }}>
                      {status.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Violations Section */}
        <div className="violations-section-attempt">
          <div className="violations-header-attempt">
            <h3>Proctoring Violations ({violations.length})</h3>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={refreshViolations}
              disabled={violationsLoading}
              style={{ marginLeft: 'auto' }}
            >
              {violationsLoading ? 'Refreshing...' : 'Refresh once'}
            </button>
          </div>
          {violations.length === 0 ? (
            <div className="no-violations-attempt">
              <Icon name="CheckCircle" size={48} style={{ color: '#10b981', marginBottom: '12px' }} />
              <p>No violations recorded</p>
            </div>
          ) : (
            <div className="violations-list-attempt" ref={violationListRef}>
              {violations.map((violation, index) => (
                <div key={violation.id || index} className={`violation-item-attempt ${violation.id === highlightedViolationId ? 'new-violation' : ''}`}>
                  <div className="violation-header-attempt">
                    <span className="violation-type-attempt">{violation.violation_type || 'Unknown'}</span>
                    <span className={`severity-badge-attempt ${(violation.severity || '').toLowerCase()}`}>
                      {violation.severity || 'Unknown'}
                    </span>
                    <span className="violation-time-attempt">
                      {violation.timestamp ? formatTimestamp(violation.timestamp) : 'N/A'}
                    </span>
                  </div>
                  <div className="violation-description-attempt">
                    {violation.description || 'No description available'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Release-with-solutions modal removed: Release Results now only toggles results_ready */}
    </div>
  );
};

export default AttemptDetails;
