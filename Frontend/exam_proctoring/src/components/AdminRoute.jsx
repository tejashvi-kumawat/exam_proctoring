// frontend/src/components/AdminRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Check if user is staff OR approved instructor
  const isAuthorized = user && (
    user.is_staff || 
    (user.is_instructor && user.instructor_approved)
  );
  
  if (!isAuthorized) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

export default AdminRoute;
