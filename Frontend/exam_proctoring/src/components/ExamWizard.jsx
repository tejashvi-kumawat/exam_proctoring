// Integrated Exam Creation Wizard - Combines exam creation and question adding
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import Icon from './Icon';
import Breadcrumbs from './Breadcrumbs';
import ConfirmationModal from './ConfirmationModal';
import './ExamWizard.css';

const ExamWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [errors, setErrors] = useState({});
  const [examId, setExamId] = useState(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, questionId: null });

  const [examForm, setExamForm] = useState({
    title: '',
    subject: '',
    description: '',
    duration_minutes: 60,
    total_marks: 0,
    passing_marks: 40,
    start_time: '',
    end_time: '',
    shuffle_questions: true,
    shuffle_options: true,
    is_active: true,
    auto_calculate_total: true
  });

  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    question_type: 'MCQ',
    marks: 1,
    question_image: null,
    options: [
      { option_text: '', is_correct: false, option_image: null },
      { option_text: '', is_correct: false, option_image: null },
      { option_text: '', is_correct: false, option_image: null },
      { option_text: '', is_correct: false, option_image: null }
    ]
  });

  const steps = [
    { number: 1, title: 'Basic Info', icon: 'FileText' },
    { number: 2, title: 'Settings', icon: 'Settings' },
    { number: 3, title: 'Questions', icon: 'HelpCircle' },
    { number: 4, title: 'Review', icon: 'CheckCircle' }
  ];

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (examId) {
      fetchQuestions();
    }
  }, [examId]);

  const fetchSubjects = async () => {
    try {
      setLoadingSubjects(true);
      const response = await api.get('/exam/admin/subjects/');
      setSubjects(response.data || []);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast.error('Failed to load subjects');
      setSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const createSubject = async () => {
    if (!newSubjectName.trim()) {
      toast.error('Subject name is required');
      return;
    }
    try {
      const response = await api.post('/exam/admin/subjects/', { name: newSubjectName.trim() });
      setSubjects([...subjects, response.data]);
      setNewSubjectName('');
      setShowAddSubject(false);
      toast.success('Subject created successfully');
    } catch (error) {
      console.error('Error creating subject:', error);
      toast.error('Failed to create subject');
    }
  };

  const fetchQuestions = async () => {
    if (!examId) return;
    try {
      const response = await api.get(`/exam/admin/exams/${examId}/questions/`);
      const questionsData = response.data.questions || response.data;
      setQuestions(questionsData);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const handleExamFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setExamForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateStep1 = () => {
    const newErrors = {};
    if (!examForm.title.trim()) newErrors.title = 'Title is required';
    if (!examForm.subject) newErrors.subject = 'Subject is required';
    if (!examForm.description.trim()) newErrors.description = 'Description is required';
    return newErrors;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (examForm.duration_minutes < 1) newErrors.duration_minutes = 'Duration must be at least 1 minute';
    if (!examForm.auto_calculate_total && examForm.total_marks < 1) {
      newErrors.total_marks = 'Total marks must be at least 1';
    }
    if (!examForm.start_time) newErrors.start_time = 'Start time is required';
    if (!examForm.end_time) newErrors.end_time = 'End time is required';
    if (new Date(examForm.end_time) <= new Date(examForm.start_time)) {
      newErrors.end_time = 'End time must be after start time';
    }
    return newErrors;
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      const validationErrors = validateStep1();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      const validationErrors = validateStep2();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
      // Create exam
      await createExam();
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (questions.length === 0) {
        toast.error('Please add at least one question');
        return;
      }
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const createExam = async () => {
    if (examId) return; // Already created
    
    setLoading(true);
    try {
      const startTime = new Date(examForm.start_time);
      const endTime = new Date(examForm.end_time);
      
      const examData = {
        ...examForm,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        subject: parseInt(examForm.subject),
        duration_minutes: parseInt(examForm.duration_minutes),
        passing_marks: parseInt(examForm.passing_marks),
        // Only include total_marks if auto_calculate_total is False
        ...(examForm.auto_calculate_total ? {} : { total_marks: parseInt(examForm.total_marks) })
      };
      
      const response = await api.post('/exam/admin/exams/', examData);
      setExamId(response.data.id);
      toast.success('Exam created! Now add questions.');
    } catch (error) {
      console.error('Error creating exam:', error);
      if (error.response?.data) {
        const errorMsg = typeof error.response.data === 'string' 
          ? error.response.data 
          : error.response.data.non_field_errors?.[0] || JSON.stringify(error.response.data);
        toast.error(`Failed to create exam: ${errorMsg}`);
      } else {
        toast.error('Failed to create exam');
      }
      throw error;
    } finally {
      setLoading(false);
    }
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
    setQuestionForm(prev => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    setQuestionForm(prev => ({
      ...prev,
      options: [...prev.options, { option_text: '', is_correct: false, option_image: null }]
    }));
  };

  const removeOption = (index) => {
    setQuestionForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const saveQuestion = async () => {
    try {
      if (!questionForm.question_text.trim() && !questionForm.question_image) {
        toast.error('Question text or image is required');
        return;
      }
      
      const hasQuestionImage = questionForm.question_image instanceof File;
      const hasOptionImages = questionForm.options.some(opt => opt.option_image instanceof File);

      if (hasQuestionImage || hasOptionImages) {
        // Use FormData for image uploads
        const formData = new FormData();
        formData.append('exam', examId);
        formData.append('question_text', questionForm.question_text.trim() || '');
        formData.append('question_type', questionForm.question_type);
        formData.append('marks', parseInt(questionForm.marks));
        formData.append('order', questions.length);

        if (hasQuestionImage) {
          formData.append('question_image', questionForm.question_image);
        }

        const validOptions = questionForm.options.filter(opt => opt.option_text.trim() || opt.option_image instanceof File);
        validOptions.forEach((option, index) => {
          formData.append(`options[${index}][option_text]`, option.option_text.trim() || '');
          formData.append(`options[${index}][is_correct]`, option.is_correct);
          if (option.option_image instanceof File) {
            formData.append(`option_images`, option.option_image);
          }
        });

        let response;
        if (editingQuestion) {
          response = await api.put(`/exam/admin/questions/${editingQuestion.id}/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          toast.success('Question updated');
        } else {
          response = await api.post('/exam/admin/questions/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          toast.success('Question added');
        }
      } else {
        // Regular JSON request
        const questionData = {
          exam: examId,
          question_text: questionForm.question_text.trim(),
          question_type: questionForm.question_type,
          marks: parseInt(questionForm.marks),
          order: questions.length,
          options: questionForm.options.filter(opt => opt.option_text.trim()).map(opt => ({
            option_text: opt.option_text.trim(),
            is_correct: opt.is_correct
          }))
        };
        
        let response;
        if (editingQuestion) {
          response = await api.put(`/exam/admin/questions/${editingQuestion.id}/`, questionData);
          toast.success('Question updated');
        } else {
          response = await api.post('/exam/admin/questions/', questionData);
          toast.success('Question added');
        }
      }
      
      fetchQuestions();
      resetQuestionForm();
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Failed to save question');
    }
  };

  const deleteQuestion = async (questionId) => {
    try {
      await api.delete(`/exam/admin/questions/${questionId}/`);
      fetchQuestions();
      toast.success('Question deleted');
      setDeleteConfirm({ isOpen: false, questionId: null });
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
      setDeleteConfirm({ isOpen: false, questionId: null });
    }
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      question_text: '',
      question_type: 'MCQ',
      marks: 1,
      question_image: null,
      options: [
        { option_text: '', is_correct: false, option_image: null },
        { option_text: '', is_correct: false, option_image: null },
        { option_text: '', is_correct: false, option_image: null },
        { option_text: '', is_correct: false, option_image: null }
      ]
    });
    setEditingQuestion(null);
    setShowAddQuestion(false);
  };

  const editQuestion = (question) => {
    setEditingQuestion(question);
    setQuestionForm({
      question_text: question.question_text,
      question_type: question.question_type,
      marks: question.marks,
      question_image: question.question_image_url || null,
      options: (question.options || []).map(opt => ({
        option_text: opt.option_text || '',
        is_correct: opt.is_correct || false,
        option_image: opt.option_image_url || null
      })).concat([
        { option_text: '', is_correct: false, option_image: null },
        { option_text: '', is_correct: false, option_image: null },
        { option_text: '', is_correct: false, option_image: null },
        { option_text: '', is_correct: false, option_image: null }
      ]).slice(0, Math.max(4, question.options?.length || 4))
    });
    setShowAddQuestion(true);
  };

  const finishWizard = () => {
    toast.success('Exam created successfully!');
    navigate('/admin');
  };

  const getTotalQuestionMarks = () => {
    return questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  };

  return (
    <div className="exam-wizard">
      <Breadcrumbs items={[
        { label: 'Admin', path: '/admin' },
        { label: 'Create Exam', path: '/admin/create-exam', isLast: true }
      ]} />

      <div className="wizard-header">
        <h1>Create New Exam</h1>
      </div>

      {/* Progress Indicator */}
      <div className="wizard-progress">
        {steps.map((step, index) => (
          <div key={step.number} className="progress-step-container">
            <div className={`progress-step ${currentStep >= step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}>
              <div className="step-icon">
                {currentStep > step.number ? (
                  <Icon name="Check" size={20} />
                ) : (
                  <Icon name={step.icon} size={20} />
                )}
              </div>
              <span className="step-title">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`progress-line ${currentStep > step.number ? 'completed' : ''}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="wizard-content">
        {currentStep === 1 && (
          <div className="wizard-step">
            <h2>Basic Information</h2>
            <div className="form-group">
              <label htmlFor="title">Exam Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={examForm.title}
                onChange={handleExamFormChange}
                className={errors.title ? 'error' : ''}
                placeholder="Enter exam title"
              />
              {errors.title && <span className="field-error">{errors.title}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="subject">Subject *</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <select
                  id="subject"
                  name="subject"
                  value={examForm.subject}
                  onChange={handleExamFormChange}
                  className={errors.subject ? 'error' : ''}
                  style={{ flex: 1 }}
                  disabled={loadingSubjects}
                >
                  <option value="">
                    {loadingSubjects ? 'Loading subjects...' : subjects.length === 0 ? 'No subjects available' : 'Select Subject'}
                  </option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddSubject(true)}
                  className="btn btn-outline"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <Icon name="Plus" size={18} style={{ marginRight: '4px' }} />
                  Add Subject
                </button>
              </div>
              {errors.subject && <span className="field-error">{errors.subject}</span>}
              {subjects.length === 0 && !loadingSubjects && (
                <small style={{ color: 'var(--gray-600)', display: 'block', marginTop: '4px' }}>
                  No subjects found. Click "Add Subject" to create one.
                </small>
              )}
            </div>

            {/* Add Subject Modal */}
            {showAddSubject && (
              <div className="modal-overlay" onClick={() => setShowAddSubject(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                  <div className="modal-header">
                    <h3>Add New Subject</h3>
                    <button onClick={() => setShowAddSubject(false)} className="modal-close">
                      <Icon name="X" size={20} />
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="form-group">
                      <label>Subject Name *</label>
                      <input
                        type="text"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        placeholder="Enter subject name"
                        onKeyPress={(e) => e.key === 'Enter' && createSubject()}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button onClick={() => setShowAddSubject(false)} className="btn btn-secondary">Cancel</button>
                    <button onClick={createSubject} className="btn btn-primary">Create</button>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                name="description"
                value={examForm.description}
                onChange={handleExamFormChange}
                className={errors.description ? 'error' : ''}
                placeholder="Enter exam description"
                rows={4}
              />
              {errors.description && <span className="field-error">{errors.description}</span>}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="wizard-step">
            <h2>Exam Settings</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="duration_minutes">Duration (minutes) *</label>
                <input
                  type="number"
                  id="duration_minutes"
                  name="duration_minutes"
                  value={examForm.duration_minutes}
                  onChange={handleExamFormChange}
                  className={errors.duration_minutes ? 'error' : ''}
                  min="1"
                />
                {errors.duration_minutes && <span className="field-error">{errors.duration_minutes}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="total_marks">
                  Total Marks {!examForm.auto_calculate_total && '*'}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    id="total_marks"
                    name="total_marks"
                    value={examForm.total_marks}
                    onChange={handleExamFormChange}
                    className={errors.total_marks ? 'error' : ''}
                    min="0"
                    disabled={examForm.auto_calculate_total}
                    style={{ flex: 1 }}
                  />
                  <label className="checkbox-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      name="auto_calculate_total"
                      checked={examForm.auto_calculate_total}
                      onChange={handleExamFormChange}
                    />
                    <span className="checkbox-custom"></span>
                    Auto-calculate
                  </label>
                </div>
                {examForm.auto_calculate_total && (
                  <small style={{ color: 'var(--gray-600)', display: 'block', marginTop: '4px' }}>
                    Total marks will be calculated from question marks
                  </small>
                )}
                {errors.total_marks && <span className="field-error">{errors.total_marks}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="passing_marks">Passing Marks *</label>
                <input
                  type="number"
                  id="passing_marks"
                  name="passing_marks"
                  value={examForm.passing_marks}
                  onChange={handleExamFormChange}
                  className={errors.passing_marks ? 'error' : ''}
                  min="1"
                />
                {errors.passing_marks && <span className="field-error">{errors.passing_marks}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="start_time">Start Time *</label>
                <input
                  type="datetime-local"
                  id="start_time"
                  name="start_time"
                  value={examForm.start_time}
                  onChange={handleExamFormChange}
                  className={errors.start_time ? 'error' : ''}
                />
                {errors.start_time && <span className="field-error">{errors.start_time}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="end_time">End Time *</label>
                <input
                  type="datetime-local"
                  id="end_time"
                  name="end_time"
                  value={examForm.end_time}
                  onChange={handleExamFormChange}
                  className={errors.end_time ? 'error' : ''}
                />
                {errors.end_time && <span className="field-error">{errors.end_time}</span>}
              </div>
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="shuffle_questions"
                  checked={examForm.shuffle_questions}
                  onChange={handleExamFormChange}
                />
                <span className="checkbox-custom"></span>
                Shuffle Questions
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="shuffle_options"
                  checked={examForm.shuffle_options}
                  onChange={handleExamFormChange}
                />
                <span className="checkbox-custom"></span>
                Shuffle Options
              </label>
            </div>
          </div>
        )}

        {currentStep === 3 && examId && (
          <div className="wizard-step">
            <div className="step-header-actions">
              <h2>Add Questions</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <label className="btn btn-outline" style={{ cursor: 'pointer', margin: 0 }}>
                  <Icon name="Upload" size={18} style={{ marginRight: '8px' }} />
                  Import Questions (JSON/CSV/DOCX)
                  <input
                    type="file"
                    accept=".json,.csv,.docx,.doc"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          formData.append('overwrite', false);
                          
                          const response = await api.post(`/exam/admin/exams/${examId}/import-questions/`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          });
                          
                          toast.success(`Imported ${response.data.imported} questions successfully`);
                          fetchQuestions();
                          e.target.value = ''; // Reset file input
                        } catch (error) {
                          console.error('Error importing questions:', error);
                          toast.error(error.response?.data?.error || 'Failed to import questions');
                          e.target.value = ''; // Reset file input
                        }
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddQuestion(true)}
                  className="btn btn-primary"
                >
                  <Icon name="Plus" size={18} style={{ marginRight: '8px' }} />
                  Add Question
                </button>
              </div>
            </div>

            <div className="questions-summary">
              <p>Total Questions: <strong>{questions.length}</strong></p>
              <p>Total Marks: <strong>{getTotalQuestionMarks()}</strong></p>
            </div>

            {questions.length === 0 ? (
              <div className="empty-state">
                <Icon name="HelpCircle" size={48} style={{ color: 'var(--gray-400)', marginBottom: '16px' }} />
                <p>No questions added yet. Click "Add Question" to get started.</p>
              </div>
            ) : (
              <div className="questions-list">
                {questions.map((question, index) => (
                  <div key={question.id} className="question-item">
                    <div className="question-header">
                      <span className="question-number">Q{index + 1}</span>
                      <span className="question-marks">{question.marks} marks</span>
                      <div className="question-actions">
                        <button onClick={() => editQuestion(question)} className="btn btn-sm btn-outline">
                          Edit
                        </button>
                        <button onClick={() => setDeleteConfirm({ isOpen: true, questionId: question.id })} className="btn btn-sm btn-danger">
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="question-text">{question.question_text}</p>
                    {question.question_image_url && (
                      <img
                        src={question.question_image_url}
                        alt="Question"
                        loading="lazy" decoding="async"
                        style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '4px', marginTop: '10px' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add/Edit Question Modal */}
            {showAddQuestion && (
              <div className="modal-overlay" onClick={resetQuestionForm}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>{editingQuestion ? 'Edit Question' : 'Add Question'}</h3>
                    <button onClick={resetQuestionForm} className="modal-close">
                      <Icon name="X" size={20} />
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="form-group">
                      <label>Question Text</label>
                      <textarea
                        value={questionForm.question_text}
                        onChange={(e) => handleQuestionFormChange('question_text', e.target.value)}
                        rows={4}
                        placeholder="Enter question text..."
                      />
                    </div>

                    <div className="form-group">
                      <label>Question Image (Optional)</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            handleQuestionFormChange('question_image', file);
                          }
                        }}
                      />
                      {questionForm.question_image && (
                        <div style={{ marginTop: '10px' }}>
                          <img
                            src={questionForm.question_image instanceof File ? URL.createObjectURL(questionForm.question_image) : questionForm.question_image}
                            alt="Preview"
                            loading="lazy" decoding="async"
                            style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '4px' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleQuestionFormChange('question_image', null)}
                            className="btn btn-sm btn-danger"
                            style={{ marginLeft: '10px' }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Type</label>
                        <select
                          value={questionForm.question_type}
                          onChange={(e) => handleQuestionFormChange('question_type', e.target.value)}
                        >
                          <option value="MCQ">Multiple Choice</option>
                          <option value="TF">True/False</option>
                          <option value="SA">Short Answer</option>
                          <option value="TEXT">Text Answer</option>
                          <option value="IMAGE_UPLOAD">Image Upload Answer</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Marks</label>
                        <input
                          type="number"
                          value={questionForm.marks}
                          onChange={(e) => handleQuestionFormChange('marks', parseInt(e.target.value) || 1)}
                          min="1"
                        />
                      </div>
                    </div>
                    {questionForm.question_type === 'MCQ' && (
                      <div className="options-section">
                        <label>Options</label>
                        {questionForm.options.map((option, index) => (
                          <div key={index} className="option-input">
                            <input
                              type="text"
                              value={option.option_text}
                              onChange={(e) => handleOptionChange(index, 'option_text', e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + index)}`}
                            />
                            <div style={{ marginTop: '8px' }}>
                              <label style={{ fontSize: '12px', color: 'var(--gray-600)', display: 'block', marginBottom: '4px' }}>
                                Option Image (Optional):
                              </label>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    handleOptionChange(index, 'option_image', file);
                                  }
                                }}
                                style={{ fontSize: '12px' }}
                              />
                              {option.option_image && (
                                <div style={{ marginTop: '8px' }}>
                                  <img
                                    src={option.option_image instanceof File ? URL.createObjectURL(option.option_image) : option.option_image}
                                    alt="Preview"
                                    loading="lazy" decoding="async"
                                    style={{ maxWidth: '150px', maxHeight: '100px', borderRadius: '4px' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleOptionChange(index, 'option_image', null)}
                                    className="btn btn-sm btn-danger"
                                    style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 8px' }}
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                            <label>
                              <input
                                type="checkbox"
                                checked={option.is_correct}
                                onChange={(e) => handleOptionChange(index, 'is_correct', e.target.checked)}
                              />
                              Correct
                            </label>
                            {questionForm.options.length > 2 && (
                              <button onClick={() => removeOption(index)} className="btn btn-sm btn-danger">
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={addOption} className="btn btn-sm btn-outline">
                          Add Option
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button onClick={resetQuestionForm} className="btn btn-secondary">Cancel</button>
                    <button onClick={saveQuestion} className="btn btn-primary">Save</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="wizard-step">
            <h2>Review & Complete</h2>
            <div className="review-section">
              <h3>Exam Details</h3>
              <p><strong>Title:</strong> {examForm.title}</p>
              <p><strong>Subject:</strong> {subjects.find(s => s.id === parseInt(examForm.subject))?.name}</p>
              <p><strong>Duration:</strong> {examForm.duration_minutes} minutes</p>
              <p><strong>Total Marks:</strong> {examForm.auto_calculate_total ? getTotalQuestionMarks() : examForm.total_marks}</p>
              <p><strong>Passing Marks:</strong> {examForm.passing_marks}</p>
              <p><strong>Questions:</strong> {questions.length}</p>
            </div>
            <div className="review-actions">
              <button onClick={() => setCurrentStep(3)} className="btn btn-outline">
                Back to Questions
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Actions */}
      <div className="wizard-actions">
        {currentStep > 1 && (
          <button onClick={handleBack} className="btn btn-secondary">
            <Icon name="ChevronLeft" size={18} style={{ marginRight: '8px' }} />
            Back
          </button>
        )}
        <div style={{ flex: 1 }} />
        {currentStep < 4 ? (
          <button onClick={handleNext} className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Next'}
            <Icon name="ChevronRight" size={18} style={{ marginLeft: '8px' }} />
          </button>
        ) : (
          <button onClick={finishWizard} className="btn btn-primary">
            <Icon name="Check" size={18} style={{ marginRight: '8px' }} />
            Finish
          </button>
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, questionId: null })}
        onConfirm={() => deleteQuestion(deleteConfirm.questionId)}
        title="Delete Question"
        message="Are you sure you want to delete this question?"
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

export default ExamWizard;

