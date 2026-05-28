import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function Notification({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  autoClose = true,
  duration = 3000,
}) {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => onClose(), duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, duration, onClose]);

  if (!isOpen) return null;

  const typeConfig = {
    success: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
    warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    info: { icon: Info, color: 'text-[var(--accent-indigo)]', bg: 'bg-[var(--accent-indigo)]/10' },
  };

  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 pointer-events-none">
      <div className="pointer-events-auto max-w-sm w-full animate-slide-up">
        <div className="bg-white/80 backdrop-blur-2xl rounded-2xl border border-white/15 shadow-[0_10px_40px_rgba(15,23,42,0.12)] p-4">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={16} className={config.color} />
            </div>
            <div className="flex-1 min-w-0">
              {title && <p className="text-sm font-semibold text-[var(--fg)]">{title}</p>}
              {message && <p className="text-xs text-[var(--muted)] mt-0.5 break-words">{message}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
