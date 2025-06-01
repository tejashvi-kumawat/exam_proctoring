// frontend/src/components/Register.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Register.css';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    is_student: true,
    is_instructor: false
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear specific error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.password2) {
      newErrors.password2 = 'Please confirm your password';
    } else if (formData.password !== formData.password2) {
      newErrors.password2 = 'Passwords do not match';
    }

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }

    return newErrors;
  };

// frontend/src/components/Register.jsx (update handleSubmit)
const handleSubmit = async (e) => {
  e.preventDefault();
  
  const validationErrors = validateForm();
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;
  }

  setLoading(true);
  setErrors({});

  const result = await register(formData);
  
  if (result.success) {
    if (result.approval_status === 'pending') {
      // Show approval pending message
      alert('Registration successful! Your instructor request has been submitted for admin approval. You will be notified once approved.');
      navigate('/login');
    } else {
      // Regular student registration
      navigate('/dashboard');
    }
  } else {
    setErrors({ general: result.error });
  }
  
  setLoading(false);
};


  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <h1>Create Account</h1>
          <p>Join the Exam Proctoring System</p>
        </div>
        
        <form onSubmit={handleSubmit} className="register-form">
          {errors.general && (
            <div className="error-message">{errors.general}</div>
          )}
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">First Name *</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className={errors.first_name ? 'error' : ''}
                placeholder="Enter your first name"
              />
              {errors.first_name && <span className="field-error">{errors.first_name}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="last_name">Last Name *</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className={errors.last_name ? 'error' : ''}
                placeholder="Enter your last name"
              />
              {errors.last_name && <span className="field-error">{errors.last_name}</span>}
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={errors.username ? 'error' : ''}
              placeholder="Choose a username"
            />
            {errors.username && <span className="field-error">{errors.username}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
              placeholder="Enter your email address"
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="phone_number">Phone Number</label>
            <input
              type="tel"
              id="phone_number"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              placeholder="Enter your phone number (optional)"
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
                placeholder="Create a password"
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="password2">Confirm Password *</label>
              <input
                type="password"
                id="password2"
                name="password2"
                value={formData.password2}
                onChange={handleChange}
                className={errors.password2 ? 'error' : ''}
                placeholder="Confirm your password"
              />
              {errors.password2 && <span className="field-error">{errors.password2}</span>}
            </div>
          </div>
          
          <div className="user-type-section">
            <label className="section-label">Account Type</label>
            <div className="user-type-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="user_type"
                  checked={formData.is_student}
                  onChange={() => setFormData(prev => ({ 
                    ...prev, 
                    is_student: true, 
                    is_instructor: false 
                  }))}
                />
                <span className="radio-custom"></span>
                <div className="option-content">
                  <strong>Student</strong>
                  <p>Take exams and view results</p>
                </div>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="user_type"
                  checked={formData.is_instructor}
                  onChange={() => setFormData(prev => ({ 
                    ...prev, 
                    is_student: false, 
                    is_instructor: true 
                  }))}
                />
                <span className="radio-custom"></span>
                <div className="option-content">
                  <strong>Instructor</strong>
                  <p>Create and manage exams</p>
                </div>
              </label>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="register-btn"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        
        <div className="register-footer">
          <p>
            Already have an account? 
            <Link to="/login" className="login-link"> Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
