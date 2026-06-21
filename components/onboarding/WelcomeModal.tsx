'use client';

import { useLocale } from '@/lib/locales';
import { useOnboarding } from './useOnboarding';
import { Zap, BookOpen, ArrowRight } from 'lucide-react';

/**
 * 首次打开时的欢迎弹窗
 * 让用户选择引导模式或跳过
 */
export function WelcomeModal() {
  const { t } = useLocale();
  const { showWelcome, startOnboarding, closeWelcome, skip } =
    useOnboarding();

  if (!showWelcome) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

      {/* 弹窗主体 */}
      <div className="relative bg-[var(--surface-warm)] backdrop-blur-2xl rounded-3xl border border-[var(--border)] shadow-[0_20px_60px_rgba(28,25,23,0.10)] max-w-md w-full animate-slide-up">
        {/* 内容 */}
        <div className="px-8 pt-8 pb-6 text-center">
          {/* 图标 */}
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center">
            <Zap className="w-8 h-8 text-white" />
          </div>

          {/* 标题 */}
          <h2 className="text-xl font-bold text-[var(--fg)] mb-2">
            {t('onboarding.welcome.title')}
          </h2>
          <p className="text-sm text-[var(--muted)] mb-6">
            {t('onboarding.welcome.subtitle')}
          </p>

          {/* 引导模式选项 */}
          <div className="space-y-3 mb-6">
            {/* 快速引导 */}
            <button
              onClick={() => startOnboarding('core')}
              className="w-full p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--accent-indigo)]/50 transition-all duration-200 text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-indigo)]/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-[var(--accent-indigo)]" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[var(--fg)]">
                    {t('onboarding.welcome.core')}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {t('onboarding.welcome.coreDesc')}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>

            {/* 完整引导 */}
            <button
              onClick={() => startOnboarding('full')}
              className="w-full p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--accent-purple)]/50 transition-all duration-200 text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-purple)]/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-[var(--accent-purple)]" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[var(--fg)]">
                    {t('onboarding.welcome.full')}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {t('onboarding.welcome.fullDesc')}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          </div>

          {/* 跳过链接 */}
          <button
            onClick={() => {
              skip();
              closeWelcome();
            }}
            className="text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            {t('onboarding.welcome.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}
