// Reusable confirmation modal component
import React from 'react';
import Icon from './Icon';
import './ConfirmationModal.css';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger' // 'danger', 'warning', 'info'
}) => {
  if (!isOpen) return null;

  const iconMap = {
    danger: 'AlertTriangle',
    warning: 'AlertCircle',
    info: 'Info'
  };

  const iconColorMap = {
    danger: 'var(--danger-color)',
    warning: 'var(--warning-color)',
    info: 'var(--info-color)'
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirmation-modal-header">
          <div className="confirmation-icon" style={{ color: iconColorMap[type] }}>
            <Icon name={iconMap[type]} size={24} />
          </div>
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <Icon name="X" size={20} />
          </button>
        </div>
        
        <div className="confirmation-modal-body">
          <p>{message}</p>
        </div>
        
        <div className="confirmation-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {cancelText}
          </button>
          <button 
            className={`btn btn-${type === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;

