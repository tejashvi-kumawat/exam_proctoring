// frontend/src/components/ExamResults.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Icon from './Icon';
import Logo from './Logo';
import './ExamResults.css';

const ExamResults = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [filter, setFilter] = useState('all'); // all, correct, partial, incorrect, not-answered, pending

  useEffect(() => {
    let isMounted = true;
    
    // Cleanup exam-related localStorage when viewing results
    const cleanupExamLocalStorage = () => {
      const examRelatedKeys = [
        'proctoringPermissionsGranted',
        'proctoringSetupCompleted',
      ];
      
      examRelatedKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error(`Error removing localStorage key ${key}:`, error);
        }
      });
    };
    
    // Clean up immediately when results page loads
    cleanupExamLocalStorage();
    
    const fetchResults = async () => {
      try {
        const response = await api.get(`/exam/attempts/${attemptId}/results/`);
        if (isMounted) {
          setResults(response.data);
          setError('');
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load exam results');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchResults();
    return () => {
      isMounted = false;
    };
  }, [attemptId]);

  const attempt = results?.attempt || {};
  const exam = attempt.exam || {};
  const answers = results?.answers || [];
  
  // Check if results are ready (from backend)
  // results_ready will be True only after admin releases results
  const resultsReady = attempt.results_ready === true;
  
  // Show "Coming Soon" if results are not ready
  const showComingSoon = !resultsReady;

  const getAnswerStatus = (answer) => {
    // Check if question was not answered (no answer record exists)
    if (answer.id === null) {
      return { status: 'not-answered', label: 'Not Answered', color: '#6b7280' };
    }
    
    if (answer.needs_manual_marking && !answer.is_manually_marked) {
      return { status: 'pending', label: 'Pending Review', color: '#f59e0b' };
    }
    if (!answer.selected_option && !answer.answer_text && (!answer.answer_images || answer.answer_images.length === 0)) {
      return { status: 'not-answered', label: 'Not Answered', color: '#6b7280' };
    }
    
    // Check for partial correct (marks > 0 but < full marks)
    if (answer.marks_awarded !== null && answer.marks_awarded !== undefined && answer.question?.marks) {
      const marksAwarded = parseFloat(answer.marks_awarded);
      const fullMarks = parseFloat(answer.question.marks);
      
      if (marksAwarded === fullMarks) {
        return { status: 'correct', label: 'Correct', color: '#10b981' };
      } else if (marksAwarded > 0 && marksAwarded < fullMarks) {
        return { status: 'partial', label: 'Partial Correct', color: '#3b82f6' };
      } else if (marksAwarded === 0) {
        return { status: 'incorrect', label: 'Incorrect', color: '#ef4444' };
      }
    }
    
    // Fallback to is_correct if marks not available
    if (answer.is_correct) {
      return { status: 'correct', label: 'Correct', color: '#10b981' };
    }
    return { status: 'incorrect', label: 'Incorrect', color: '#ef4444' };
  };
  
  // Filter answers based on selected filter
  const filteredAnswers = useMemo(() => {
    if (filter === 'all') return answers;
    if (filter === 'correct') return answers.filter(a => {
      const status = getAnswerStatus(a);
      return status.status === 'correct';
    });
    if (filter === 'partial') return answers.filter(a => {
      const status = getAnswerStatus(a);
      return status.status === 'partial';
    });
    if (filter === 'incorrect') return answers.filter(a => {
      const status = getAnswerStatus(a);
      return status.status === 'incorrect';
    });
    if (filter === 'not-answered') return answers.filter(a => !a.selected_option && !a.answer_text && (!a.answer_images || a.answer_images.length === 0));
    if (filter === 'pending') return answers.filter(a => a.needs_manual_marking && !a.is_manually_marked);
    return answers;
  }, [answers, filter]);

  const currentAnswer = filteredAnswers[currentQuestionIndex] || null;
  const currentQuestionNumber = currentAnswer 
    ? answers.findIndex(a => a.id === currentAnswer.id) + 1 
    : 0;

  const calculatePercentage = () => {
    if (!results?.attempt?.score || !results?.attempt?.exam?.total_marks) {
      return 0;
    }
    return Math.round((results.attempt.score / results.attempt.exam.total_marks) * 100);
  };

  const getGrade = (percentage) => {
    if (percentage >= 90) return { grade: 'A+', color: '#10b981' };
    if (percentage >= 80) return { grade: 'A', color: '#3b82f6' };
    if (percentage >= 70) return { grade: 'B', color: '#f59e0b' };
    if (percentage >= 60) return { grade: 'C', color: '#f97316' };
    if (percentage >= 50) return { grade: 'D', color: '#ef4444' };
    return { grade: 'F', color: '#dc2626' };
  };

  const isPassed = () => {
    if (!results?.attempt?.score || !results?.attempt?.exam?.passing_marks) return false;
    return results.attempt.score >= results.attempt.exam.passing_marks;
  };

  const getDuration = () => {
    if (!results?.attempt?.start_time || !results?.attempt?.end_time) return 'N/A';
    const start = new Date(results.attempt.start_time);
    const end = new Date(results.attempt.end_time);
    const diffMinutes = Math.round((end - start) / 60000);
    return `${diffMinutes} minutes`;
  };

  if (loading) {
    return (
      <div className="loading-container-results">
        <div className="loading-spinner-results"></div>
        <p>Loading results...</p>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="error-container-results">
        <Icon name="AlertCircle" size={48} style={{ color: '#ef4444', marginBottom: '20px' }} />
        <h2>Error</h2>
        <p>{error || 'Failed to load results'}</p>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const percentage = showComingSoon ? 0 : calculatePercentage();
  const gradeInfo = getGrade(percentage);
  const passed = showComingSoon ? false : isPassed();

  // Statistics
  const stats = {
    total: answers.length,
    correct: answers.filter(a => getAnswerStatus(a).status === 'correct').length,
    partial: answers.filter(a => getAnswerStatus(a).status === 'partial').length,
    incorrect: answers.filter(a => getAnswerStatus(a).status === 'incorrect').length,
    notAnswered: answers.filter(a => !a.selected_option && !a.answer_text && (!a.answer_images || a.answer_images.length === 0)).length,
    pending: 0 // No pending answers when results are shown (they're only shown after release)
  };

  return (
    <div className="exam-results-redesigned">
      <div className="results-container-redesigned">
        {/* Header */}
        <div className="header-professional">
          <div className="header-left">
            <button 
              onClick={() => navigate('/dashboard')}
              className="btn btn-icon"
            >
              <Icon name="ArrowLeft" size={18} />
            </button>
            <Logo size="small" onClick={() => navigate('/dashboard')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px', minWidth: 0 }}>
              <span style={{ fontWeight: 600, color: 'var(--gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attempt.exam_title || exam.title || 'Exam Results'}</span>
              <span style={{ color: 'var(--gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="Calendar" size={12} />
                {attempt.end_time ? new Date(attempt.end_time).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
          <div className="header-right">
            <span className={`badge ${showComingSoon ? 'badge-warning' : passed ? 'badge-success' : 'badge-danger'}`}>
              <Icon name={showComingSoon ? "Clock" : passed ? "CheckCircle" : "XCircle"} size={12} />
              {showComingSoon ? 'Pending' : passed ? 'Passed' : 'Failed'}
            </span>
          </div>
        </div>

        {/* Ultra Compact Score Summary */}
        <div className="score-summary-compact">
          <div className="score-circle-compact">
            {showComingSoon ? (
              <>
                <Icon name="Clock" size={40} style={{ color: 'white' }} />
              </>
            ) : (
              <>
                <div className="score-value-compact" style={{ color: 'white' }}>
                  {percentage}%
                </div>
                <div className="score-grade-compact">
                  {gradeInfo.grade}
                </div>
              </>
            )}
          </div>
          
          <div className="score-details-compact">
            <div className="score-detail-item">
              <span className="score-detail-label">Score</span>
              <span className="score-detail-value">
                {showComingSoon ? '...' : `${attempt.score || 0}/${exam.total_marks || 0}`}
              </span>
            </div>
            <div className="score-detail-item">
              <span className="score-detail-label">Correct</span>
              <span className="score-detail-value">
                {showComingSoon ? '...' : `${stats.correct}/${stats.total}`}
              </span>
            </div>
            <div className="score-detail-item">
              <span className="score-detail-label">Passing</span>
              <span className="score-detail-value">{exam.passing_marks || 0}</span>
            </div>
            <div className="score-detail-item">
              <span className="score-detail-label">Duration</span>
              <span className="score-detail-value">{getDuration()}</span>
            </div>
          </div>
        </div>

        {/* Results Coming Soon Banner */}
        {showComingSoon && (
          <div className="results-coming-soon-banner">
            <Icon name="Clock" size={32} style={{ marginRight: '12px' }} />
            <div style={{ flex: 1 }}>
              <h3>Results Coming Soon</h3>
              <p>
                Your exam has been submitted and is being evaluated. Results will be available once the instructor reviews and releases them.
              </p>
              <button 
                onClick={() => navigate('/dashboard')} 
                className="btn btn-primary"
                style={{ marginTop: '16px' }}
              >
                <Icon name="Home" size={16} />
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Answer Statistics - Only show when results are ready */}
        {!showComingSoon && (
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
                <span className="stat-label-pro">Correct Answers</span>
              </div>
            </div>
            {stats.partial > 0 && (
              <div className="stat-card-pro">
                <div className="stat-icon-pro">
                  <Icon name="AlertCircle" size={22} style={{ color: 'var(--info)' }} />
                </div>
                <div className="stat-content-pro">
                  <span className="stat-value-pro">{stats.partial}</span>
                  <span className="stat-label-pro">Partial Credit</span>
                </div>
              </div>
            )}
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
          </div>
        )}

        {/* Filter Dropdown - Only show when results are ready */}
        {!showComingSoon && (
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
              <option value="all">All Questions ({stats.total})</option>
              <option value="correct">Correct ({stats.correct})</option>
              {stats.partial > 0 && (
                <option value="partial">Partial ({stats.partial})</option>
              )}
              <option value="incorrect">Incorrect ({stats.incorrect})</option>
              <option value="not-answered">Not Answered ({stats.notAnswered})</option>
              {stats.pending > 0 && (
                <option value="pending">Pending ({stats.pending})</option>
              )}
            </select>
          </div>
        )}

        {/* Question Navigation - Only show when results are ready */}
        {!showComingSoon && filteredAnswers.length > 0 && (
          <div className="question-navigation-results">
            <div className="question-counter">
              Question {currentQuestionIndex + 1} of {filteredAnswers.length}
            </div>
            <div className="question-nav-buttons">
              <button
                onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0}
                className="nav-btn-results"
              >
                <Icon name="ChevronLeft" size={20} />
                Previous
              </button>
              <button
                onClick={() => setCurrentQuestionIndex(Math.min(filteredAnswers.length - 1, currentQuestionIndex + 1))}
                disabled={currentQuestionIndex === filteredAnswers.length - 1}
                className="nav-btn-results"
              >
                Next
                <Icon name="ChevronRight" size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Question Display - Only show when results are ready */}
        {!showComingSoon && currentAnswer ? (
          <div className="question-display-results">
            <div className={`question-card-results ${getAnswerStatus(currentAnswer).status}`}>
              <div className="question-header-results">
                <div className="question-number-results">
                  Question {currentQuestionNumber}
                  <span className="question-type-badge">{currentAnswer.question.question_type}</span>
                </div>
                <div className={`answer-status-badge-results ${getAnswerStatus(currentAnswer).status}`} style={{ background: getAnswerStatus(currentAnswer).color }}>
                  {getAnswerStatus(currentAnswer).label}
                </div>
              </div>

              <div className="question-content-results">
                <h3>{currentAnswer.question.question_text}</h3>
                {currentAnswer.question.question_image_url && (
                  <img 
                    src={currentAnswer.question.question_image_url} 
                    alt="Question" 
                    loading="lazy" decoding="async"
                    className="question-image-results"
                  />
                )}
              </div>

              <div className="answer-section-results">
                <h4>Your Answer:</h4>
                {currentAnswer.selected_option ? (
                  <div className="answer-display-results">
                    <div className="selected-option-results">
                      {currentAnswer.selected_option.option_image_url && (
                        <img 
                          src={currentAnswer.selected_option.option_image_url} 
                          alt="Option" 
                          loading="lazy" decoding="async"
                          className="option-image-results"
                        />
                      )}
                      <span>{currentAnswer.selected_option.option_text}</span>
                    </div>
                    {!currentAnswer.is_correct && currentAnswer.question.options && (
                      <div className="correct-answer-display-results">
                        <strong>Correct Answer:</strong>
                        {currentAnswer.question.options.find(opt => opt.is_correct)?.option_image_url && (
                          <img 
                            src={currentAnswer.question.options.find(opt => opt.is_correct).option_image_url} 
                            alt="Correct Option" 
                            loading="lazy" decoding="async"
                            className="option-image-results"
                          />
                        )}
                        <span>{currentAnswer.question.options.find(opt => opt.is_correct)?.option_text || 'N/A'}</span>
                      </div>
                    )}
                  </div>
                ) : currentAnswer.answer_text ? (
                  <div className="answer-display-results">
                    <div className="text-answer-results">
                      {currentAnswer.answer_text}
                    </div>
                  </div>
                ) : currentAnswer.answer_images && currentAnswer.answer_images.length > 0 ? (
                  <div className="answer-display-results">
                    <div className="images-answer-results">
                      {currentAnswer.answer_images.map((img, idx) => (
                        <img 
                          key={img.id || idx}
                          src={img.image_url} 
                          alt={`Answer ${idx + 1}`}
                          loading="lazy" decoding="async"
                          className="answer-image-results"
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="not-answered-display-results">
                    <Icon name="MinusCircle" size={24} style={{ color: '#9ca3af', marginRight: '8px' }} />
                    Not Answered
                  </div>
                )}

                {/* Student Answer Attachments */}
                {currentAnswer.attachments && currentAnswer.attachments.length > 0 ? (
                  <div className="answer-attachments-results">
                    <strong style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', color: '#059669' }}>
                      <Icon name="Paperclip" size={18} style={{ marginRight: '8px', color: '#059669' }} />
                      Answer Attachments
                    </strong>
                    <div className="attachments-list">
                      {currentAnswer.attachments.map(att => (
                        <a 
                          key={att.id}
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="attachment-link"
                        >
                          <Icon name="Download" size={16} />
                              {att.file_name}
                              <a href={att.file_url} download className="btn btn-sm" style={{ marginLeft: 8 }}>Download</a>
                          {att.file_size && <span className="file-size">({(att.file_size / 1024 / 1024).toFixed(2)} MB)</span>}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {currentAnswer.needs_manual_marking && !currentAnswer.is_manually_marked ? (
                  <div className="pending-review-banner-results">
                    <Icon name="Clock" size={20} style={{ marginRight: '8px' }} />
                    <div>
                      <strong>Pending Review</strong>
                      <p>This answer is being reviewed by the instructor. Results will be available soon.</p>
                    </div>
                  </div>
                ) : null}

                {/* Solution Display */}
                {currentAnswer.solution_text ? (
                  <div className="solution-display-results">
                    <div className="solution-header-results">
                      <Icon name="BookOpen" size={20} style={{ marginRight: '8px', color: '#667eea' }} />
                      <strong>Solution / Explanation</strong>
                    </div>
                    <div className="solution-text-results">
                      {currentAnswer.solution_text}
                    </div>
                  </div>
                ) : null}

                {/* Solution Attachments */}
                {currentAnswer.solution_attachments && currentAnswer.solution_attachments.length > 0 ? (
                  <div className="solution-attachments-results">
                    <strong style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <Icon name="Paperclip" size={18} style={{ marginRight: '8px', color: '#10b981' }} />
                      Solution Attachments
                    </strong>
                    <div className="attachments-list" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {currentAnswer.solution_attachments.map(att => {
                        const ext = (att.file_type || '').toLowerCase();
                        const supportedImageExts = ['jpg','jpeg','png','gif','webp'];
                        const isLikelyImage = supportedImageExts.includes(ext) || (att.file_url && att.file_url.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i));
                        const isUnsupportedImage = (ext === 'heif' || ext === 'heic');
                        return (
                          <div key={att.id} style={{ width: isLikelyImage ? 160 : 'auto', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', background: 'white', padding: 8 }}>
                            {isLikelyImage ? (
                              <a href={att.file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                                <img src={att.file_url} alt={att.file_name} loading="lazy" decoding="async" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }} />
                                <div style={{ marginTop: 8, fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{att.file_name}
                                  <span style={{ marginLeft: 8, fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: 6 }}>{(ext || '').toUpperCase()}</span>
                                </div>
                                <div style={{ marginTop: 6 }}>
                                  <a href={att.file_url} download className="btn btn-sm">Download</a>
                                </div>
                              </a>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, color: '#374151' }}>{att.file_name}</div>
                                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{att.file_type}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <a href={att.file_url} className="btn btn-primary btn-sm" download>Download</a>
                                  <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', padding: '4px 6px', background: '#f3f4f6', borderRadius: 6 }}>{(ext || '').toUpperCase() || 'FILE'}</div>
                                </div>
                              </div>
                            )}
                            {isUnsupportedImage && (
                              <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 12 }}>Preview may not be supported in this browser. Use Download to view the file.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {currentAnswer.marks_awarded !== null && currentAnswer.marks_awarded !== undefined ? (
                  <div className="marks-display-results">
                    <strong>Marks Awarded:</strong> {currentAnswer.marks_awarded} / {currentAnswer.question.marks}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="no-questions-results">
            <Icon name="FileText" size={64} style={{ color: '#9ca3af', marginBottom: '20px' }} />
            <p>No questions match the selected filter</p>
          </div>
        )}

        {/* Question List Overview - Only show when results are ready */}
        {!showComingSoon && (
          <div className="questions-overview-results">
            <h3>All Questions Overview</h3>
            <div className="questions-grid-results">
              {answers.map((answer, index) => {
                const status = getAnswerStatus(answer);
                const hasSolutionAttachments = answer.solution_attachments && answer.solution_attachments.length > 0;
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
                          const newIndex = answers.findIndex(a => a.id === answer.id);
                          if (newIndex !== -1) {
                            const filteredIdx = filteredAnswers.findIndex(a => a.id === answer.id);
                            setCurrentQuestionIndex(filteredIdx);
                          }
                        }, 100);
                      }
                    }}
                    className={`question-mini-card ${status.status} ${currentQuestionNumber === index + 1 ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="question-mini-number">Q{index + 1}</div>
                      {hasSolutionAttachments && (
                        <div title="Solution attachments available" style={{ display: 'inline-flex', alignItems: 'center', background: '#eef2ff', padding: '2px 6px', borderRadius: 6, fontSize: 12, color: '#4338ca' }}>
                          <Icon name="Paperclip" size={12} />
                        </div>
                      )}
                    </div>

                    <div className={`question-mini-status ${status.status}`} style={{ background: status.color }}>
                      {status.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamResults;
