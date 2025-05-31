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

  // Check if user is admin or instructor
  if (!user || (!user.is_staff && !user.is_instructor)) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

export default AdminRoute;
