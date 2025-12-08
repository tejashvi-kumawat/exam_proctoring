import toast from 'react-hot-toast';

export const useToast = () => {
  const showSuccess = (message) => {
    toast.success(message, {
      duration: 3000,
      style: {
        background: '#10b981',
        color: 'white',
      },
    });
  };

  const showError = (message) => {
    toast.error(message, {
      duration: 4000,
      style: {
        background: '#ef4444',
        color: 'white',
      },
    });
  };

  const showInfo = (message) => {
    toast.loading(message, {
      duration: 3000,
      style: {
        background: '#3b82f6',
        color: 'white',
      },
    });
  };

  const showWarning = (message) => {
    toast(message, {
      duration: 3000,
      style: {
        background: '#f59e0b',
        color: 'white',
      },
    });
  };

  const confirm = (message) => {
    return new Promise((resolve) => {
      const toastId = toast.custom(
        (t) => (
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              minWidth: '280px',
            }}
          >
            <p style={{ margin: '0 0 12px 0', color: '#1f2937', fontSize: '14px', fontWeight: '500' }}>
              {message}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  toast.dismiss(toastId);
                  resolve(false);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#e5e7eb',
                  color: '#1f2937',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.target.style.background = '#d1d5db')}
                onMouseLeave={(e) => (e.target.style.background = '#e5e7eb')}
              >
                No
              </button>
              <button
                onClick={() => {
                  toast.dismiss(toastId);
                  resolve(true);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.target.style.background = '#2563eb')}
                onMouseLeave={(e) => (e.target.style.background = '#3b82f6')}
              >
                Yes
              </button>
            </div>
          </div>
        ),
        {
          duration: Infinity,
          style: {
            background: 'transparent',
            boxShadow: 'none',
          },
        }
      );
    });
  };

  return {
    showSuccess,
    showError,
    showInfo,
    showWarning,
    confirm,
  };
};
