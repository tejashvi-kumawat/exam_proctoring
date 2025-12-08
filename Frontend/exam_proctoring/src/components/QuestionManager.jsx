// frontend/src/components/QuestionManager.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import Icon from './Icon';
import ConfirmationModal from './ConfirmationModal';
import Breadcrumbs from './Breadcrumbs';
import './QuestionManager.css';

const QuestionManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, questionId: null });
  const [editingExam, setEditingExam] = useState(null);
  const [showEditExamModal, setShowEditExamModal] = useState(false);
  const [deleteExamConfirm, setDeleteExamConfirm] = useState({ isOpen: false, examId: null });
  const [subjects, setSubjects] = useState([]);
  const [draggedQuestion, setDraggedQuestion] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [errors, setErrors] = useState({});

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
  const [marksWarning, setMarksWarning] = useState(null);

  useEffect(() => {
    fetchExams();
    fetchSubjects();
    const examId = searchParams.get('examId');
    if (examId) {
      const exam = exams.find(e => e.id === parseInt(examId));
      if (exam) {
        handleExamSelect(exam);
      }
    }
  }, [searchParams]);
  
  const fetchSubjects = async () => {
    try {
      const response = await api.get('/exam/admin/subjects/');
      setSubjects(response.data || []);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };
  
  useEffect(() => {
    const examId = searchParams.get('examId');
    if (examId && exams.length > 0) {
      const exam = exams.find(e => e.id === parseInt(examId));
      if (exam && (!selectedExam || selectedExam.id !== exam.id)) {
        handleExamSelect(exam);
      }
    }
  }, [exams, searchParams]);

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
      const questionsData = response.data.questions || response.data; // Handle both formats
      setQuestions(questionsData);
      
      // Update exam total marks if provided in response
      if (response.data.exam_total_marks !== undefined && selectedExam) {
        setSelectedExam({ ...selectedExam, total_marks: response.data.exam_total_marks });
      }
      
      checkMarksDistribution(examId, questionsData);
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkMarksDistribution = (examId, questionsList) => {
    if (!selectedExam) return;
    
    const totalQuestionMarks = questionsList.reduce((sum, q) => sum + (q.marks || 0), 0);
    const examTotalMarks = selectedExam.total_marks || 0;
    
    if (examTotalMarks > 0) {
      if (totalQuestionMarks > examTotalMarks) {
        setMarksWarning({
          type: 'error',
          icon: 'AlertTriangle',
          message: `Total question marks (${totalQuestionMarks}) exceeds exam total marks (${examTotalMarks}). Please adjust question marks.`
        });
      } else if (totalQuestionMarks < examTotalMarks) {
        const remaining = examTotalMarks - totalQuestionMarks;
        setMarksWarning({
          type: 'warning',
          icon: 'Info',
          message: `Total question marks (${totalQuestionMarks}) is less than exam total marks (${examTotalMarks}). Remaining: ${remaining} marks to distribute.`
        });
      } else {
        setMarksWarning({
          type: 'success',
          icon: 'CheckCircle',
          message: `Marks distribution is correct: ${totalQuestionMarks}/${examTotalMarks}`
        });
      }
    } else {
      setMarksWarning(null);
    }
  };

  const getTotalQuestionMarks = () => {
    return questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  };

  const handleExamSelect = async (exam) => {
    setSelectedExam(exam);
    await fetchQuestions(exam.id);
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
    
    // Check if we need to use FormData (if images are present)
    const hasQuestionImage = questionForm.question_image instanceof File;
    const hasOptionImages = questionForm.options.some(opt => opt.option_image instanceof File);
    
    if (hasQuestionImage || hasOptionImages) {
      // Use FormData for multipart/form-data
      const formData = new FormData();
      formData.append('exam', selectedExam.id);
      formData.append('question_text', questionForm.question_text.trim());
      formData.append('question_type', questionForm.question_type);
      formData.append('marks', parseInt(questionForm.marks));
      // Only set order for NEW questions, preserve order for editing
      if (!editingQuestion) {
        formData.append('order', questions.length);
      }
      
      if (hasQuestionImage) {
        formData.append('question_image', questionForm.question_image);
      }
      
      // Filter options properly
      console.log('All questionForm.options:', questionForm.options); // Debug
      
      const validOptions = questionForm.options.filter(opt => {
        // Check if option has any content
        const hasText = opt.option_text && opt.option_text.toString().trim().length > 0;
        const hasNewImage = opt.option_image instanceof File;
        const hasExistingImage = opt.option_image && typeof opt.option_image === 'string' && opt.option_image.length > 0;
        
        const isValid = hasText || hasNewImage || hasExistingImage;
        console.log(`Option check: text="${opt.option_text}", hasText=${hasText}, hasNewImage=${hasNewImage}, hasExisting=${hasExistingImage}, valid=${isValid}`);
        
        return isValid;
      });
      
      console.log(`Filtered ${validOptions.length} valid options from ${questionForm.options.length} total`); // Debug log
      
      // CRITICAL DEBUG - Show what's being sent
      const debugData = {
        mode: editingQuestion ? 'EDIT' : 'CREATE',
        questionId: editingQuestion?.id,
        totalOptions: questionForm.options.length,
        validOptions: validOptions.length,
        options: validOptions.map(opt => ({
          text: opt.option_text,
          is_correct: opt.is_correct,
          hasImage: !!opt.option_image
        })),
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('lastQuestionSave', JSON.stringify(debugData, null, 2));
      console.log('=== SENDING OPTIONS TO BACKEND ===');
      console.log(debugData);
      console.log('==================================');
      
      validOptions.forEach((option, index) => {
        // CRITICAL: Always send option_text even if empty string
        const optionText = (option.option_text || '').toString();
        formData.append(`options[${index}][option_text]`, optionText);
        formData.append(`options[${index}][is_correct]`, option.is_correct ? 'true' : 'false');
        
        console.log(`FormData appending option ${index}: text="${optionText}", is_correct=${option.is_correct}`);
        
        // Handle option images
        if (option.option_image instanceof File) {
          // New image file being uploaded
          formData.append(`option_images`, option.option_image);
          console.log(`  - Added new image for option ${index}`);
        } else if (option.option_image && typeof option.option_image === 'string') {
          // Existing image URL - send it so backend can preserve it
          formData.append(`options[${index}][existing_image_url]`, option.option_image);
          console.log(`  - Preserved existing image for option ${index}`);
        }
      });
      
      console.log(`Total options sent in FormData: ${validOptions.length}`);
      
      let response;
      if (editingQuestion) {
        response = await api.put(`/exam/admin/questions/${editingQuestion.id}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        response = await api.post('/exam/admin/questions/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      console.log('Question saved successfully:', response.data);
      console.log('Response options count:', response.data.options?.length);
      
      // DON'T refresh immediately - let user see console
      alert(`Question ${editingQuestion ? 'updated' : 'added'}! Check console for debug info before page refreshes.`);
      
      toast.success(editingQuestion ? 'Question updated successfully' : 'Question added successfully');
      fetchQuestions(selectedExam.id);
      resetForm();
    } else {
      // Regular JSON request
      const questionData = {
        exam: selectedExam.id,
        question_text: questionForm.question_text.trim(),
        question_type: questionForm.question_type,
        marks: parseInt(questionForm.marks),
        options: questionForm.options.filter(opt => opt.option_text.trim()).map(opt => ({
          option_text: opt.option_text.trim(),
          is_correct: opt.is_correct
        }))
      };
      
      // Only set order for NEW questions, preserve order for editing
      if (!editingQuestion) {
        questionData.order = questions.length;
      }
      
      console.log('Sending question data:', questionData);
      
      let response;
      if (editingQuestion) {
        response = await api.put(`/exam/admin/questions/${editingQuestion.id}/`, questionData);
      } else {
        response = await api.post('/exam/admin/questions/', questionData);
      }
      
      console.log('Question saved successfully:', response.data);
      toast.success(editingQuestion ? 'Question updated successfully' : 'Question added successfully');
      
      // Refresh exam data to get updated total_marks if auto-calculated
      const examResponse = await api.get(`/exam/admin/exams/${selectedExam.id}/`);
      setSelectedExam(examResponse.data);
      
      fetchQuestions(selectedExam.id);
      resetForm();
    }
    
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
    try {
      await api.delete(`/exam/admin/questions/${questionId}/`);
      fetchQuestions(selectedExam.id);
      toast.success('Question deleted successfully');
      setDeleteConfirm({ isOpen: false, questionId: null });
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Error deleting question');
      setDeleteConfirm({ isOpen: false, questionId: null });
    }
  };
  
  const handleDeleteClick = (questionId) => {
    setDeleteConfirm({ isOpen: true, questionId });
  };

  const editQuestion = (question) => {
    console.log('Editing question:', question);
    console.log('Question options:', question.options);
    
    setEditingQuestion(question);
    
    // Map existing options properly
    const mappedOptions = (question.options || []).map(opt => ({
      option_text: opt.option_text || '',
      is_correct: opt.is_correct || false,
      option_image: opt.option_image_url || null
    }));
    
    console.log('Mapped options:', mappedOptions);
    
    // Ensure we have at least 4 option slots
    const paddedOptions = [...mappedOptions];
    while (paddedOptions.length < 4) {
      paddedOptions.push({ option_text: '', is_correct: false, option_image: null });
    }
    
    setQuestionForm({
      question_text: question.question_text,
      question_type: question.question_type,
      marks: question.marks,
      question_image: question.question_image_url || null,
      options: paddedOptions
    });
    
    console.log('Question form set with options:', paddedOptions);
    setShowAddQuestion(true);
  };

  const resetForm = () => {
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

  // Drag and Drop handlers
  const handleDragStart = (e, question, index) => {
    setDraggedQuestion({ question, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget);
    // Add slight opacity to dragged item
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedQuestion(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedQuestion && draggedQuestion.index !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedQuestion || draggedQuestion.index === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newQuestions = [...questions];
    const draggedItem = newQuestions[draggedQuestion.index];
    
    // Remove from old position
    newQuestions.splice(draggedQuestion.index, 1);
    // Insert at new position
    newQuestions.splice(dropIndex, 0, draggedItem);
    
    // Update local state immediately for smooth UX
    setQuestions(newQuestions);
    setDragOverIndex(null);

    // Update order in backend
    try {
      const orderData = newQuestions.map((q, idx) => ({
        id: q.id,
        order: idx
      }));

      await api.post(`/exam/admin/exams/${selectedExam.id}/reorder-questions/`, {
        questions: orderData
      });

      toast.success('Questions reordered successfully');
    } catch (error) {
      console.error('Error reordering questions:', error);
      toast.error('Failed to save question order');
      // Revert on error
      fetchQuestions(selectedExam.id);
    }
  };

  const handleEditExam = (exam) => {
    setEditingExam({
      ...exam,
      start_time: exam.start_time ? new Date(exam.start_time).toISOString().slice(0, 16) : '',
      end_time: exam.end_time ? new Date(exam.end_time).toISOString().slice(0, 16) : ''
    });
    setShowEditExamModal(true);
  };

  const handleDeleteExam = (examId) => {
    setDeleteExamConfirm({ isOpen: true, examId });
  };

  const deleteExam = async () => {
    try {
      await api.delete(`/exam/admin/exams/${deleteExamConfirm.examId}/`);
      toast.success('Exam deleted successfully');
      setDeleteExamConfirm({ isOpen: false, examId: null });
      if (selectedExam?.id === deleteExamConfirm.examId) {
        setSelectedExam(null);
        setQuestions([]);
      }
      fetchExams();
    } catch (error) {
      console.error('Error deleting exam:', error);
      toast.error(error.response?.data?.error || 'Failed to delete exam');
      setDeleteExamConfirm({ isOpen: false, examId: null });
    }
  };

  const updateExam = async () => {
    try {
      const examData = {
        ...editingExam,
        start_time: editingExam.start_time ? new Date(editingExam.start_time).toISOString() : null,
        end_time: editingExam.end_time ? new Date(editingExam.end_time).toISOString() : null,
        subject: typeof editingExam.subject === 'object' ? editingExam.subject.id : editingExam.subject,
        duration_minutes: parseInt(editingExam.duration_minutes),
        passing_marks: parseInt(editingExam.passing_marks),
        total_marks: editingExam.auto_calculate_total ? undefined : parseInt(editingExam.total_marks)
      };
      
      const response = await api.put(`/exam/admin/exams/${editingExam.id}/`, examData);
      toast.success('Exam updated successfully');
      setShowEditExamModal(false);
      setEditingExam(null);
      fetchExams();
      // Update selected exam if it was the one being edited
      if (selectedExam?.id === editingExam.id) {
        setSelectedExam(response.data);
        fetchQuestions(response.data.id);
      }
    } catch (error) {
      console.error('Error updating exam:', error);
      toast.error(error.response?.data?.error || 'Failed to update exam');
    }
  };

  const handleDeleteAllQuestions = async () => {
    if (!selectedExam) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ALL ${questions.length} questions from "${selectedExam.title}"?\n\nThis action cannot be undone!`
    );
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/exam/admin/exams/${selectedExam.id}/delete-all-questions/`);
      toast.success(`All questions deleted from "${selectedExam.title}"`);
      fetchQuestions(selectedExam.id);
      fetchExams(); // Refresh exam stats
    } catch (error) {
      console.error('Error deleting all questions:', error);
      toast.error(error.response?.data?.error || 'Failed to delete questions');
    }
  };

  return (
    <div className="question-manager">
      <Breadcrumbs items={[
        { label: 'Admin', path: '/admin' },
        { label: 'Question Manager', path: '/admin/questions', isLast: true }
      ]} />
      
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
        {/* Exam Selection - Sidebar Style */}
        <div className="manager-layout">
          <div className="exam-sidebar">
            <div className="sidebar-header">
              <h2>
                <Icon name="BookOpen" size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Select Exam
              </h2>
              <button 
                onClick={() => navigate('/admin/create-exam')}
                className="btn btn-primary btn-sm"
                style={{ whiteSpace: 'nowrap' }}
              >
                <Icon name="Plus" size={16} style={{ marginRight: '4px' }} />
                New Exam
              </button>
            </div>
            {exams.length === 0 ? (
              <div className="empty-exams">
                <Icon name="BookOpen" size={48} style={{ color: 'var(--gray-400)', marginBottom: '16px' }} />
                <p>No exams found</p>
                <button 
                  onClick={() => navigate('/admin/create-exam')}
                  className="btn btn-primary"
                >
                  Create First Exam
                </button>
              </div>
            ) : (
              <div className="exam-list">
                {exams.map((exam) => (
                  <div 
                    key={exam.id}
                    className={`exam-item ${selectedExam?.id === exam.id ? 'selected' : ''}`}
                  >
                    <div 
                      className="exam-item-content"
                      onClick={() => handleExamSelect(exam)}
                    >
                      <div className="exam-item-header">
                        <h3>{exam.title}</h3>
                        {selectedExam?.id === exam.id && (
                          <Icon name="CheckCircle" size={18} style={{ color: 'var(--success-color)' }} />
                        )}
                      </div>
                      <p className="exam-subject">{exam.subject_name || 'No Subject'}</p>
                      <div className="exam-meta">
                        <span className="exam-meta-item">
                          <Icon name="HelpCircle" size={14} style={{ marginRight: '4px' }} />
                          {exam.questions_count || 0} questions
                        </span>
                        <span className="exam-meta-item">
                          <Icon name="Award" size={14} style={{ marginRight: '4px' }} />
                          {exam.total_marks || 0} marks
                        </span>
                      </div>
                    </div>
                    <div className="exam-item-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-icon"
                        onClick={() => handleEditExam(exam)}
                        title="Edit Exam"
                      >
                        <Icon name="Edit" size={16} />
                      </button>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => handleDeleteExam(exam.id)}
                        title="Delete Exam"
                      >
                        <Icon name="Trash2" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Questions Management */}
          {selectedExam ? (
            <div className="questions-panel">
              <div className="questions-header">
                <div className="header-left">
                  <h2>
                    <Icon name="HelpCircle" size={24} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
                    {selectedExam.title}
                  </h2>
                  <div className="exam-stats">
                    <div className="stat-badge">
                      <Icon name="HelpCircle" size={16} />
                      <span>{questions.length} Questions</span>
                    </div>
                    <div className="stat-badge">
                      <Icon name="Award" size={16} />
                      <span>{getTotalQuestionMarks()} / {selectedExam.total_marks || 'Auto'} Marks</span>
                    </div>
                    <div className="stat-badge">
                      <Icon name="Clock" size={16} />
                      <span>{selectedExam.duration_minutes} min</span>
                    </div>
                  </div>
                </div>
                <div className="header-right">
                  {marksWarning && (
                    <div className={`marks-alert ${marksWarning.type}`}>
                      <Icon name={marksWarning.icon} size={18} />
                      <span>{marksWarning.message}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                      <label className="btn btn-outline" style={{ cursor: 'pointer', margin: 0 }}>
                        <Icon name="Upload" size={18} style={{ marginRight: '8px' }} />
                        Import (JSON/CSV/DOCX)
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
                                
                                const response = await api.post(`/exam/admin/exams/${selectedExam.id}/import-questions/`, formData, {
                                  headers: { 'Content-Type': 'multipart/form-data' }
                                });
                                
                                toast.success(`Imported ${response.data.imported} questions successfully`);
                                fetchQuestions(selectedExam.id);
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
                    {questions.length > 0 && (
                      <button 
                        onClick={handleDeleteAllQuestions}
                        className="btn btn-danger"
                        title="Delete all questions"
                      >
                        <Icon name="Trash2" size={18} style={{ marginRight: '8px' }} />
                        Delete All
                      </button>
                    )}
                    <button 
                      onClick={() => setShowAddQuestion(true)}
                      className="btn btn-primary"
                    >
                      <Icon name="Plus" size={18} style={{ marginRight: '8px' }} />
                      Add Question
                    </button>
                  </div>
                </div>
              </div>

              <div className="questions-content">
                {loading ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading questions...</p>
                  </div>
                ) : questions.length === 0 ? (
                  <div className="empty-questions">
                    <Icon name="HelpCircle" size={64} style={{ color: 'var(--gray-300)', marginBottom: '16px' }} />
                    <h3>No questions yet</h3>
                    <p>Start by adding your first question</p>
                    <button 
                      onClick={() => setShowAddQuestion(true)}
                      className="btn btn-primary"
                    >
                      <Icon name="Plus" size={18} style={{ marginRight: '8px' }} />
                      Add First Question
                    </button>
                  </div>
                ) : (
                  <div className="questions-grid">
                    {questions.map((question, index) => (
                      <div 
                        key={question.id} 
                        className={`question-card ${dragOverIndex === index ? 'drag-over' : ''}`}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, question, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        <div className="question-card-header">
                          <div className="drag-handle" title="Drag to reorder">
                            <Icon name="GripVertical" size={18} style={{ color: 'var(--gray-400)' }} />
                          </div>
                          <div className="question-number-badge">
                            Q{index + 1}
                          </div>
                          <div className="question-badges">
                            <span className="type-badge">{question.question_type}</span>
                            <span className="marks-badge">
                              <Icon name="Award" size={14} style={{ marginRight: '4px' }} />
                              {question.marks} marks
                            </span>
                          </div>
                        </div>
                        
                        <div className="question-card-body">
                          <p className="question-text">{question.question_text}</p>
                          {question.question_image_url && (
                            <img 
                              src={question.question_image_url} 
                              alt="Question" 
                              loading="lazy" decoding="async"
                              style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '4px', marginTop: '10px' }}
                            />
                          )}
                          
                          {question.options && question.options.length > 0 && (
                            <div className="options-preview">
                              {question.options.slice(0, 2).map((option, optIndex) => (
                                <div 
                                  key={optIndex}
                                  className={`option-preview ${option.is_correct ? 'correct' : ''}`}
                                >
                                  <span className="option-letter">
                                    {String.fromCharCode(65 + optIndex)}
                                  </span>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                    {option.option_image_url && (
                                      <img 
                                        src={option.option_image_url} 
                                        alt="Option" 
                                        loading="lazy" decoding="async"
                                        style={{ maxWidth: '100px', maxHeight: '60px', borderRadius: '4px' }}
                                      />
                                    )}
                                    <span className="option-text">{option.option_text}</span>
                                  </div>
                                  {option.is_correct && (
                                    <Icon name="Check" size={14} style={{ color: 'var(--success-color)' }} />
                                  )}
                                </div>
                              ))}
                              {question.options.length > 2 && (
                                <div className="more-options">
                                  +{question.options.length - 2} more options
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="question-card-footer">
                          <button 
                            onClick={() => editQuestion(question)}
                            className="btn btn-sm btn-outline"
                          >
                            <Icon name="Edit" size={14} style={{ marginRight: '4px' }} />
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(question.id)}
                            className="btn btn-sm btn-danger"
                          >
                            <Icon name="Trash2" size={14} style={{ marginRight: '4px' }} />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="no-exam-selected">
              <Icon name="BookOpen" size={64} style={{ color: 'var(--gray-300)', marginBottom: '16px' }} />
              <h3>Select an exam to manage questions</h3>
              <p>Choose an exam from the sidebar to view and manage its questions</p>
            </div>
          )}
        </div>

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
                    <label>Question Type</label>
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
                    <label>
                      Marks
                      {selectedExam && selectedExam.total_marks > 0 && (
                        <span style={{ marginLeft: '8px', color: 'var(--gray-600)', fontWeight: 'normal' }}>
                          (Remaining: {selectedExam.total_marks - getTotalQuestionMarks() + (editingQuestion ? editingQuestion.marks : 0) - questionForm.marks} marks)
                        </span>
                      )}
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        value={questionForm.marks}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          handleQuestionFormChange('marks', value);
                        }}
                        min="1"
                        step="1"
                        style={{ flex: 1 }}
                      />
                      {selectedExam && selectedExam.total_marks > 0 && questions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const remaining = selectedExam.total_marks - getTotalQuestionMarks() + (editingQuestion ? editingQuestion.marks : 0);
                            const remainingQuestions = questions.length - (editingQuestion ? 1 : 0);
                            if (remainingQuestions > 0 && remaining > 0) {
                              const equalMarks = Math.floor(remaining / remainingQuestions);
                              handleQuestionFormChange('marks', equalMarks);
                            }
                          }}
                          className="btn btn-sm btn-outline"
                          title="Distribute remaining marks equally"
                        >
                          Equal Distribute
                        </button>
                      )}
                    </div>
                    {selectedExam && (
                      <small className="marks-hint">
                        Exam Total: {selectedExam.total_marks || 'Auto'} marks | 
                        Question Total: {getTotalQuestionMarks() - (editingQuestion ? editingQuestion.marks : 0) + questionForm.marks} marks
                      </small>
                    )}
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
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <input
                            type="text"
                            value={option.option_text}
                            onChange={(e) => handleOptionChange(index, 'option_text', e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + index)}`}
                          />
                          <div>
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
                        </div>
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
        
        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, questionId: null })}
          onConfirm={() => deleteQuestion(deleteConfirm.questionId)}
          title="Delete Question"
          message="Are you sure you want to delete this question? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
        />

        {/* Delete Exam Confirmation Modal */}
        <ConfirmationModal
          isOpen={deleteExamConfirm.isOpen}
          onClose={() => setDeleteExamConfirm({ isOpen: false, examId: null })}
          onConfirm={deleteExam}
          title="Delete Exam"
          message="Are you sure you want to delete this exam? This will also delete all questions and cannot be undone. Exams with attempts cannot be deleted."
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
        />

        {/* Edit Exam Modal */}
        {showEditExamModal && editingExam && (
          <div className="modal-overlay" onClick={() => setShowEditExamModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Edit Exam</h2>
                <button 
                  className="btn-icon"
                  onClick={() => {
                    setShowEditExamModal(false);
                    setEditingExam(null);
                  }}
                >
                  <Icon name="X" size={20} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>Exam Title *</label>
                  <input
                    type="text"
                    value={editingExam.title || ''}
                    onChange={(e) => setEditingExam({ ...editingExam, title: e.target.value })}
                    placeholder="Enter exam title"
                  />
                </div>

                <div className="form-group">
                  <label>Subject *</label>
                  <select
                    value={typeof editingExam.subject === 'object' ? editingExam.subject.id : editingExam.subject}
                    onChange={(e) => setEditingExam({ ...editingExam, subject: parseInt(e.target.value) })}
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    value={editingExam.description || ''}
                    onChange={(e) => setEditingExam({ ...editingExam, description: e.target.value })}
                    placeholder="Enter exam description"
                    rows={3}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Duration (minutes) *</label>
                    <input
                      type="number"
                      value={editingExam.duration_minutes || 60}
                      onChange={(e) => setEditingExam({ ...editingExam, duration_minutes: parseInt(e.target.value) || 60 })}
                      min="1"
                    />
                  </div>

                  <div className="form-group">
                    <label>Passing Marks *</label>
                    <input
                      type="number"
                      value={editingExam.passing_marks || 40}
                      onChange={(e) => setEditingExam({ ...editingExam, passing_marks: parseInt(e.target.value) || 40 })}
                      min="0"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={editingExam.auto_calculate_total || false}
                      onChange={(e) => setEditingExam({ ...editingExam, auto_calculate_total: e.target.checked })}
                    />
                    Auto Calculate Total Marks
                  </label>
                </div>

                {!editingExam.auto_calculate_total && (
                  <div className="form-group">
                    <label>Total Marks *</label>
                    <input
                      type="number"
                      value={editingExam.total_marks || 0}
                      onChange={(e) => setEditingExam({ ...editingExam, total_marks: parseInt(e.target.value) || 0 })}
                      min="1"
                    />
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input
                      type="datetime-local"
                      value={editingExam.start_time || ''}
                      onChange={(e) => setEditingExam({ ...editingExam, start_time: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>End Time *</label>
                    <input
                      type="datetime-local"
                      value={editingExam.end_time || ''}
                      onChange={(e) => setEditingExam({ ...editingExam, end_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={editingExam.shuffle_questions || false}
                        onChange={(e) => setEditingExam({ ...editingExam, shuffle_questions: e.target.checked })}
                      />
                      Shuffle Questions
                    </label>
                  </div>

                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={editingExam.shuffle_options || false}
                        onChange={(e) => setEditingExam({ ...editingExam, shuffle_options: e.target.checked })}
                      />
                      Shuffle Options
                    </label>
                  </div>

                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={editingExam.is_active !== false}
                        onChange={(e) => setEditingExam({ ...editingExam, is_active: e.target.checked })}
                      />
                      Active
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  onClick={() => {
                    setShowEditExamModal(false);
                    setEditingExam(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={updateExam}
                  className="btn btn-primary"
                >
                  Update Exam
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
