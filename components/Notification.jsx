import { useEffect } from 'react';

export default function Notification({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  autoClose = true,
  duration = 3000
}) {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, duration, onClose]);

  if (!isOpen) return null;

  const typeStyles = {
    success: {
      container: 'bg-green-50 border-green-200',
      title: 'text-green-800',
      message: 'text-green-700',
      icon: '✓'
    },
    error: {
      container: 'bg-red-50 border-red-200',
      title: 'text-red-800',
      message: 'text-red-700',
      icon: '✕'
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
      icon: '⚠'
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      title: 'text-blue-800',
      message: 'text-blue-700',
      icon: 'ℹ'
    }
  };

  const styles = typeStyles[type] || typeStyles.info;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/25"
        onClick={onClose}
      />

      {/* Notification Content */}
      <div className="relative max-w-xs w-full min-w-0">
        <div className={`border rounded-lg shadow-lg p-4 ${styles.container}`}>
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <span className={`text-xl ${styles.title} flex-shrink-0`}>{styles.icon}</span>
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 className={`font-semibold text-xs ${styles.title} break-words`}>
                    {title}
                  </h3>
                )}
                {message && (
                  <p className={`text-xs mt-1 whitespace-pre-wrap break-words ${styles.message}`}>
                    {message}
                  </p>
                )}
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`ml-4 text-gray-400 hover:text-gray-600 transition-colors ${styles.title}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}