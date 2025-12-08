// Logo component for the exam proctoring system
import React from 'react';
import './Logo.css';

const Logo = ({ size = 'medium', variant = 'full', onClick }) => {
  const sizeClasses = {
    small: 'logo-small',
    medium: 'logo-medium',
    large: 'logo-large'
  };

  if (variant === 'icon') {
    return (
      <div className={`logo-icon ${sizeClasses[size]}`}>
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="40" height="40" rx="8" fill="#2563eb" />
          <path
            d="M20 8L28 14V26L20 32L12 26V14L20 8Z"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="20" cy="20" r="4" fill="white" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`logo-container ${sizeClasses[size]}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="logo-icon">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="40" height="40" rx="8" fill="#2563eb" />
          <path
            d="M20 8L28 14V26L20 32L12 26V14L20 8Z"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="20" cy="20" r="4" fill="white" />
        </svg>
      </div>
      <div className="logo-text">
        <span className="logo-title">ExamProctor</span>
        {size === 'large' && <span className="logo-subtitle">Secure Online Testing</span>}
      </div>
    </div>
  );
};

export default Logo;

