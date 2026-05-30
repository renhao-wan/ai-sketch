'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { LocaleContext } from '@/locales';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static contextType = LocaleContext;
  declare context: React.ContextType<typeof LocaleContext>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const t = this.context?.t ?? ((k: string) => k);
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4 noise-overlay">
          <div className="relative bg-[var(--surface-warm)] backdrop-blur-2xl rounded-3xl border border-[var(--border)] shadow-[0_20px_60px_rgba(28,25,23,0.10)] p-8 max-w-md w-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--fg)] mb-2">{t('error.title')}</h2>
            <p className="text-sm text-[var(--muted)] mb-4">{t('error.description')}</p>
            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="text-xs text-[var(--muted)] cursor-pointer hover:text-[var(--fg)] transition-colors">{t('error.details')}</summary>
                <pre className="mt-2 text-[11px] font-mono bg-[var(--surface-warm-hover)] p-3 rounded-xl overflow-auto text-red-600">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[var(--primary)] text-white px-4 py-2.5 rounded-xl hover:bg-[var(--primary)]/90 active:scale-[0.98] transition-all duration-200 text-sm font-medium"
            >
              {t('error.refresh')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
