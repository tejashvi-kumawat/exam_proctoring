// frontend/src/components/CreateExam.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './CreateExam.css';

const CreateExam = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [examForm, setExamForm] = useState({
    title: '',
    subject: '',
    description: '',
    duration_minutes: 60,
    total_marks: 100,
    passing_marks: 40,
    start_time: '',
    end_time: '',
    shuffle_questions: true,
    shuffle_options: true,
    is_active: true
  });

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const response = await api.get('/exam/admin/subjects/');
      setSubjects(response.data);
    } catch (error) {
      console.error('Error fetching subjects:', error);
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
    if (examForm.total_marks < 1) newErrors.total_marks = 'Total marks must be at least 1';
    if (examForm.passing_marks >= examForm.total_marks) {
      newErrors.passing_marks = 'Passing marks must be less than total marks';
    }
    if (!examForm.start_time) newErrors.start_time = 'Start time is required';
    if (!examForm.end_time) newErrors.end_time = 'End time is required';
    if (new Date(examForm.end_time) <= new Date(examForm.start_time)) {
      newErrors.end_time = 'End time must be after start time';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/exam/admin/exams/', examForm);
      navigate(`/admin/questions?examId=${response.data.id}`);
    } catch (error) {
      console.error('Error creating exam:', error);
      setErrors({ general: 'Failed to create exam. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-exam">
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
                <select
                  id="subject"
                  name="subject"
                  value={examForm.subject}
                  onChange={handleChange}
                  className={errors.subject ? 'error' : ''}
                >
                  <option value="">Select Subject</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                {errors.subject && <span className="field-error">{errors.subject}</span>}
              </div>
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
                <label htmlFor="total_marks">Total Marks *</label>
                <input
                  type="number"
                  id="total_marks"
                  name="total_marks"
                  value={examForm.total_marks}
                  onChange={handleChange}
                  className={errors.total_marks ? 'error' : ''}
                  min="1"
                />
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
