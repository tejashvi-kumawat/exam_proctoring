// frontend/src/components/CreateExam.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import Icon from './Icon';
import Breadcrumbs from './Breadcrumbs';
import './CreateExam.css';

const CreateExam = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [errors, setErrors] = useState({});
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

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

  useEffect(() => {
    fetchSubjects();
  }, []);

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setExamForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!examForm.title.trim()) newErrors.title = 'Title is required';
    if (!examForm.subject) newErrors.subject = 'Subject is required';
    if (!examForm.description.trim()) newErrors.description = 'Description is required';
    if (examForm.duration_minutes < 1) newErrors.duration_minutes = 'Duration must be at least 1 minute';
    if (!examForm.auto_calculate_total && examForm.total_marks < 1) {
      newErrors.total_marks = 'Total marks must be at least 1';
    }
    if (!examForm.auto_calculate_total && examForm.total_marks > 0 && examForm.passing_marks >= examForm.total_marks) {
      newErrors.passing_marks = 'Passing marks must be less than total marks';
    }
    if (!examForm.start_time) newErrors.start_time = 'Start time is required';
    if (!examForm.end_time) newErrors.end_time = 'End time is required';
    if (new Date(examForm.end_time) <= new Date(examForm.start_time)) {
      newErrors.end_time = 'End time must be after start time';
    }

    return newErrors;
  };

// frontend/src/components/CreateExam.jsx (update handleSubmit)
const handleSubmit = async (e) => {
  e.preventDefault();
  
  const validationErrors = validateForm();
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;
  }

  setLoading(true);
  try {
    // Convert datetime-local to proper ISO format
    const startTime = new Date(examForm.start_time);
    const endTime = new Date(examForm.end_time);
    
    // Debug: Log the times being sent
    console.log('Sending exam with times:', {
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      current_time: new Date().toISOString()
    });
    
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
    console.log('Exam created successfully:', response.data);
    toast.success('Exam created successfully! Now add questions.');
    navigate(`/admin/questions?examId=${response.data.id}`);
  } catch (error) {
    console.error('Error creating exam:', error);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
      setErrors({ general: JSON.stringify(error.response.data) });
    } else {
      setErrors({ general: 'Failed to create exam. Please try again.' });
    }
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="create-exam">
      <Breadcrumbs items={[
        { label: 'Admin', path: '/admin' },
        { label: 'Create Exam', path: '/admin/create-exam', isLast: true }
      ]} />
      
      <div className="create-exam-header">
        <h1>Create New Exam</h1>
        <button 
          onClick={() => navigate('/admin')}
          className="btn btn-secondary"
        >
          Back to Admin
        </button>
      </div>

      <div className="create-exam-content">
        <form onSubmit={handleSubmit} className="exam-form">
          {errors.general && (
            <div className="error-message">{errors.general}</div>
          )}

          <div className="form-section">
            <h2>Basic Information</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="title">Exam Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={examForm.title}
                  onChange={handleChange}
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
                    onChange={handleChange}
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
            </div>

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                name="description"
                value={examForm.description}
                onChange={handleChange}
                className={errors.description ? 'error' : ''}
                placeholder="Enter exam description"
                rows={4}
              />
              {errors.description && <span className="field-error">{errors.description}</span>}
            </div>
          </div>

          <div className="form-section">
            <h2>Exam Settings</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="duration_minutes">Duration (minutes) *</label>
                <input
                  type="number"
                  id="duration_minutes"
                  name="duration_minutes"
                  value={examForm.duration_minutes}
                  onChange={handleChange}
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
                    onChange={handleChange}
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
                      onChange={handleChange}
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
                  onChange={handleChange}
                  className={errors.passing_marks ? 'error' : ''}
                  min="1"
                />
                {errors.passing_marks && <span className="field-error">{errors.passing_marks}</span>}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Schedule</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="start_time">Start Time *</label>
                <input
                  type="datetime-local"
                  id="start_time"
                  name="start_time"
                  value={examForm.start_time}
                  onChange={handleChange}
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
                  onChange={handleChange}
                  className={errors.end_time ? 'error' : ''}
                />
                {errors.end_time && <span className="field-error">{errors.end_time}</span>}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Options</h2>
            
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="shuffle_questions"
                  checked={examForm.shuffle_questions}
                  onChange={handleChange}
                />
                <span className="checkbox-custom"></span>
                Shuffle Questions
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="shuffle_options"
                  checked={examForm.shuffle_options}
                  onChange={handleChange}
                />
                <span className="checkbox-custom"></span>
                Shuffle Options
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={examForm.is_active}
                  onChange={handleChange}
                />
                <span className="checkbox-custom"></span>
                Active
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="button"
              onClick={() => navigate('/admin')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Creating...' : 'Create Exam'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateExam;
