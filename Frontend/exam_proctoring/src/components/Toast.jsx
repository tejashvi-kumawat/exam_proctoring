// Toast notification component using react-hot-toast
import { Toaster } from 'react-hot-toast';
import './Toast.css';

const Toast = () => {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--gray-800)',
          color: 'var(--gray-50)',
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: 'var(--shadow-lg)',
        },
        success: {
          iconTheme: {
            primary: 'var(--success-color)',
            secondary: 'white',
          },
        },
        error: {
          iconTheme: {
            primary: 'var(--danger-color)',
            secondary: 'white',
          },
        },
      }}
    />
  );
};

export default Toast;

