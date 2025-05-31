// frontend/src/components/QuestionManager.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './QuestionManager.css';

const QuestionManager = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [loading, setLoading] = useState(false);

  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    question_type: 'MCQ',
    marks: 1,
    options: [
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false }
    ]
  });

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const response = await api.get('/exam/admin/exams/');
      setExams(response.data);
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  };

  const fetchQuestions = async (examId) => {
    try {
      setLoading(true);
      const response = await api.get(`/exam/admin/exams/${examId}/questions/`);
      setQuestions(response.data);
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExamSelect = (exam) => {
    setSelectedExam(exam);
    fetchQuestions(exam.id);
  };

  const handleQuestionFormChange = (field, value) => {
    setQuestionForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...questionForm.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    
    // If marking as correct, unmark others
    if (field === 'is_correct' && value) {
      newOptions.forEach((option, i) => {
        if (i !== index) option.is_correct = false;
      });
    }
    
    setQuestionForm(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  const addOption = () => {
    setQuestionForm(prev => ({
      ...prev,
      options: [...prev.options, { option_text: '', is_correct: false }]
    }));
  };

  const removeOption = (index) => {
    setQuestionForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

// frontend/src/components/QuestionManager.jsx (update saveQuestion function)
const saveQuestion = async () => {
  try {
    // Validate form data
    if (!questionForm.question_text.trim()) {
      setErrors({ question_text: 'Question text is required' });
      return;
    }
    
    if (!selectedExam) {
      setErrors({ general: 'Please select an exam first' });
      return;
    }
    
    // Prepare question data
    const questionData = {
      exam: selectedExam.id,
      question_text: questionForm.question_text.trim(),
      question_type: questionForm.question_type,
      marks: parseInt(questionForm.marks),
      order: questions.length, // Set order based on current questions count
      options: questionForm.options.filter(opt => opt.option_text.trim()) // Only send non-empty options
    };
    
    console.log('Sending question data:', questionData); // Debug log
    
    let response;
    if (editingQuestion) {
      response = await api.put(`/exam/admin/questions/${editingQuestion.id}/`, questionData);
    } else {
      response = await api.post('/exam/admin/questions/', questionData);
    }
    
    console.log('Question saved successfully:', response.data);
    
    fetchQuestions(selectedExam.id);
    resetForm();
    setShowAddQuestion(false);
    
  } catch (error) {
    console.error('Error saving question:', error);
    
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
      const errorMessage = typeof error.response.data === 'string' 
        ? error.response.data 
        : error.response.data.error || JSON.stringify(error.response.data);
      setErrors({ general: errorMessage });
    } else {
      setErrors({ general: 'Failed to save question. Please try again.' });
    }
  }
};

  const deleteQuestion = async (questionId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;

    try {
      await api.delete(`/exam/admin/questions/${questionId}/`);
      fetchQuestions(selectedExam.id);
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Error deleting question');
    }
  };

  const editQuestion = (question) => {
    setEditingQuestion(question);
    setQuestionForm({
      question_text: question.question_text,
      question_type: question.question_type,
      marks: question.marks,
      options: question.options || [
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false }
      ]
    });
    setShowAddQuestion(true);
  };

  const resetForm = () => {
    setQuestionForm({
      question_text: '',
      question_type: 'MCQ',
      marks: 1,
      options: [
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false }
      ]
    });
    setEditingQuestion(null);
    setShowAddQuestion(false);
  };

  return (
    <div className="question-manager">
      <div className="manager-header">
        <h1>Question Manager</h1>
        <button 
          onClick={() => navigate('/admin')}
          className="btn btn-secondary"
        >
          Back to Admin
        </button>
      </div>

      <div className="manager-content">
        {/* Exam Selection */}
        <div className="exam-selection">
          <h2>Select Exam</h2>
          <div className="exam-list">
            {exams.map((exam) => (
              <div 
                key={exam.id}
                className={`exam-item ${selectedExam?.id === exam.id ? 'selected' : ''}`}
                onClick={() => handleExamSelect(exam)}
              >
                <h3>{exam.title}</h3>
                <p>{exam.subject_name}</p>
                {selectedExam?.id === exam.id && (
                  <span className="question-count">
                    {questions.length} questions
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Questions Management */}
        {selectedExam && (
          <div className="questions-section">
            <div className="section-heade r">
              <h2 style={{padding: '0.5em'}}>Questions for {selectedExam.title} </h2>
              <button 
                onClick={() => setShowAddQuestion(true)}
                className="btn btn-primary"
              >
                Add Question
              </button>
            </div>

            {loading ? (
              <div className="loading">Loading questions...</div>
            ) : (
              <div className="questions-list">
                {questions.map((question, index) => (
                  <div key={question.id} className="question-item">
                    <div className="question-header">
                      <span className="question-number">Q{index + 1}</span>
                      <span className="question-type">{question.question_type}</span>
                      <span className="question-marks">{question.marks} marks</span>
                      <div className="question-actions">
                        <button 
                          onClick={() => editQuestion(question)}
                          className="btn btn-sm btn-outline"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => deleteQuestion(question.id)}
                          className="btn btn-sm btn-danger"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    <div className="question-content">
                      <p className="question-text">{question.question_text}</p>
                      
                      {question.options && (
                        <div className="options-list">
                          {question.options.map((option, optIndex) => (
                            <div 
                              key={optIndex}
                              className={`option ${option.is_correct ? 'correct' : ''}`}
                            >
                              <span className="option-letter">
                                {String.fromCharCode(65 + optIndex)}
                              </span>
                              <span className="option-text">{option.option_text}</span>
                              {option.is_correct && <span className="correct-indicator">✓</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Question Modal */}
        {showAddQuestion && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>{editingQuestion ? 'Edit Question' : 'Add New Question'}</h2>
                <button 
                  onClick={resetForm}
                  className="modal-close"
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>Question Text</label>
                  <textarea
                    value={questionForm.question_text}
                    onChange={(e) => handleQuestionFormChange('question_text', e.target.value)}
                    placeholder="Enter question text..."
                    rows={4}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Question Type</label>
                    <select
                      value={questionForm.question_type}
                      onChange={(e) => handleQuestionFormChange('question_type', e.target.value)}
                    >
                      <option value="MCQ">Multiple Choice</option>
                      <option value="TF">True/False</option>
                      <option value="SA">Short Answer</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Marks</label>
                    <input
                      type="number"
                      value={questionForm.marks}
                      onChange={(e) => handleQuestionFormChange('marks', parseInt(e.target.value))}
                      min="1"
                      max="10"
                    />
                  </div>
                </div>

                {questionForm.question_type === 'MCQ' && (
                  <div className="options-section">
                    <div className="options-header">
                      <label>Options</label>
                      <button 
                        type="button"
                        onClick={addOption}
                        className="btn btn-sm btn-outline"
                      >
                        Add Option
                      </button>
                    </div>

                    {questionForm.options.map((option, index) => (
                      <div key={index} className="option-input">
                        <span className="option-number">{String.fromCharCode(65 + index)}</span>
                        <input
                          type="text"
                          value={option.option_text}
                          onChange={(e) => handleOptionChange(index, 'option_text', e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + index)}`}
                        />
                        <label className="correct-checkbox">
                          <input
                            type="checkbox"
                            checked={option.is_correct}
                            onChange={(e) => handleOptionChange(index, 'is_correct', e.target.checked)}
                          />
                          Correct
                        </label>
                        {questionForm.options.length > 2 && (
                          <button 
                            type="button"
                            onClick={() => removeOption(index)}
                            className="btn btn-sm btn-danger"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button 
                  onClick={resetForm}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveQuestion}
                  className="btn btn-primary"
                >
                  {editingQuestion ? 'Update Question' : 'Save Question'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionManager;
