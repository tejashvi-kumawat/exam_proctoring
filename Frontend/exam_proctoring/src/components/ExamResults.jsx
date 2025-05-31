// frontend/src/components/ExamResults.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExam } from '../hooks/useExam';
import './ExamResults.css';

const ExamResults = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { getExamResults } = useExam();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchResults();
  }, [attemptId]);

  const fetchResults = async () => {
    try {
      const data = await getExamResults(attemptId);
      console.log('Results data:', data); // Debug log
      setResults(data);
    } catch (err) {
      console.error('Error fetching results:', err);
      setError('Failed to load exam results');
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = () => {
    if (!results?.attempt?.score || !results?.attempt?.exam?.total_marks) return 0;
    return Math.round((results.attempt.score / results.attempt.exam.total_marks) * 100);
  };

  const getGrade = (percentage) => {
    if (percentage >= 90) return { grade: 'A+', color: '#4caf50' };
    if (percentage >= 80) return { grade: 'A', color: '#8bc34a' };
    if (percentage >= 70) return { grade: 'B', color: '#ffc107' };
    if (percentage >= 60) return { grade: 'C', color: '#ff9800' };
    if (percentage >= 50) return { grade: 'D', color: '#ff5722' };
    return { grade: 'F', color: '#f44336' };
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
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading results...</p>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error || 'Failed to load results'}</p>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Safe access to nested properties with fallbacks
  const attempt = results.attempt || {};
  const exam = attempt.exam || {};
  const answers = results.answers || [];
  
  const percentage = calculatePercentage();
  const gradeInfo = getGrade(percentage);
  const passed = isPassed();

  return (
    <div className="exam-results">
      <div className="results-container">
        <div className="results-header">
          <h1>Exam Results</h1>
          <div className={`result-status ${passed ? 'passed' : 'failed'}`}>
            {passed ? '✅ PASSED' : '❌ FAILED'}
          </div>
        </div>

        <div className="results-content">
          {/* Score Summary */}
          <div className="score-summary">
            <div className="score-circle">
              <div className="score-value" style={{ color: gradeInfo.color }}>
                {percentage}%
              </div>
              <div className="score-grade" style={{ color: gradeInfo.color }}>
                {gradeInfo.grade}
              </div>
            </div>
            
            <div className="score-details">
              <h2>{attempt.exam_title || exam.title || 'Exam Results'}</h2>
              <div className="score-stats">
                <div className="stat">
                  <span className="label">Score:</span>
                  <span className="value">
                    {attempt.score || 0} / {exam.total_marks || 0}
                  </span>
                </div>
                <div className="stat">
                  <span className="label">Correct Answers:</span>
                  <span className="value">
                    {attempt.correct_answers || 0} / {attempt.total_questions || 0}
                  </span>
                </div>
                <div className="stat">
                  <span className="label">Passing Marks:</span>
                  <span className="value">{exam.passing_marks || 0}</span>
                </div>
                <div className="stat">
                  <span className="label">Duration:</span>
                  <span className="value">{getDuration()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Results */}
          {answers.length > 0 && (
            <div className="detailed-results">
              <h3>Question-wise Results</h3>
              <div className="questions-results">
                {answers.map((answer, index) => (
                  <div key={answer.id || index} className={`question-result ${answer.is_correct ? 'correct' : 'incorrect'}`}>
                    <div className="question-header">
                      <span className="question-number">Q{index + 1}</span>
                      <span className={`result-indicator ${answer.is_correct ? 'correct' : 'incorrect'}`}>
                        {answer.is_correct ? '✓' : '✗'}
                      </span>
                    </div>
                    
                    <div className="question-content">
                      <p className="question-text">
                        {answer.question?.question_text || 'Question text not available'}
                      </p>
                      
                      <div className="answer-details">
                        {answer.selected_option ? (
                          <div className="selected-answer">
                            <span className="label">Your Answer:</span>
                            <span className={`answer ${answer.is_correct ? 'correct' : 'incorrect'}`}>
                              {answer.selected_option.option_text}
                            </span>
                          </div>
                        ) : answer.answer_text ? (
                          <div className="selected-answer">
                            <span className="label">Your Answer:</span>
                            <span className={`answer ${answer.is_correct ? 'correct' : 'incorrect'}`}>
                              {answer.answer_text}
                            </span>
                          </div>
                        ) : (
                          <div className="selected-answer">
                            <span className="answer not-answered">Not Answered</span>
                          </div>
                        )}
                        
                        {!answer.is_correct && answer.question?.options && (
                          <div className="correct-answer">
                            <span className="label">Correct Answer:</span>
                            <span className="answer correct">
                              {answer.question.options.find(opt => opt.is_correct)?.option_text || 'N/A'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Analysis */}
          <div className="performance-analysis">
            <h3>Performance Analysis</h3>
            <div className="analysis-grid">
              <div className="analysis-item">
                <h4>Accuracy</h4>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${attempt.total_questions ? 
                        (attempt.correct_answers / attempt.total_questions) * 100 : 0}%` 
                    }}
                  />
                </div>
                <span>
                  {attempt.total_questions ? 
                    Math.round((attempt.correct_answers / attempt.total_questions) * 100) : 0}%
                </span>
              </div>
              
              <div className="analysis-item">
                <h4>Completion Rate</h4>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${attempt.total_questions ? 
                        (answers.filter(a => a.selected_option || a.answer_text).length / attempt.total_questions) * 100 : 0}%` 
                    }}
                  />
                </div>
                <span>
                  {attempt.total_questions ? 
                    Math.round((answers.filter(a => a.selected_option || a.answer_text).length / attempt.total_questions) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="results-actions">
          <button 
            onClick={() => navigate('/dashboard')}
            className="btn btn-primary"
          >
            Back to Dashboard
          </button>
          <button 
            onClick={() => window.print()}
            className="btn btn-secondary"
          >
            Print Results
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamResults;
