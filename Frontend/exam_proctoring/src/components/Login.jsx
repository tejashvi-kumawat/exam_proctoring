// frontend/src/components/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, user } = useAuth();
  const navigate = useNavigate();

  // All hooks must be called first, before any conditional returns
  React.useEffect(() => {
    if (user) {
      // If admin or instructor, redirect to admin panel
      if (user.is_staff || user.is_instructor) {
        navigate('/admin');
      } else {
        // Regular user goes to dashboard
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  // Redirect based on user role if already logged in
  if (user) {
    if (user.is_staff || user.is_instructor) {
      return <Navigate to="/admin" />;
    }
    return <Navigate to="/dashboard" />;
  }

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(credentials.username, credentials.password);
    
    if (result.success) {
      // Check if user is admin/instructor and redirect accordingly
      // We need to get the user from auth context after login
      // Since login updates the user in context, we'll check it in useEffect
      // For now, redirect to dashboard - the redirect will happen in useEffect
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Exam Proctoring System</h1>
          <p>Sign in to your account</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              required
              placeholder="Enter your username"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
            />
          </div>
          
          <button 
            type="submit" 
            className="login-btn"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="login-footer">
        <p>
            Don't have an account? 
            <Link to="/register" className="register-link"> Create one here</Link>
        </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
