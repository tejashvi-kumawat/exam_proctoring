// Breadcrumb navigation component
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';
import './Breadcrumbs.css';

const Breadcrumbs = ({ items = [] }) => {
  const location = useLocation();
  
  // Auto-generate breadcrumbs from path if items not provided
  const pathSegments = location.pathname.split('/').filter(Boolean);
  
  const breadcrumbs = items.length > 0 ? items : pathSegments.map((segment, index) => {
    const path = '/' + pathSegments.slice(0, index + 1).join('/');
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return {
      label,
      path,
      isLast: index === pathSegments.length - 1
    };
  });

  if (breadcrumbs.length <= 1) return null;

  return (
    <nav className="breadcrumbs">
      <ol className="breadcrumbs-list">
        <li className="breadcrumb-item">
          <Link to="/admin" className="breadcrumb-link">
            <Icon name="Home" size={16} />
            <span>Admin</span>
          </Link>
        </li>
        {breadcrumbs.map((crumb, index) => (
          <li key={index} className="breadcrumb-item">
            <span className="breadcrumb-separator">
              <Icon name="ChevronRight" size={16} />
            </span>
            {crumb.isLast ? (
              <span className="breadcrumb-current">{crumb.label}</span>
            ) : (
              <Link to={crumb.path} className="breadcrumb-link">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;

