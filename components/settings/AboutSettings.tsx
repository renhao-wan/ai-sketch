'use client';

import { useState, useEffect } from 'react';
import { useLocale, type TranslationKey } from '@/lib/locales';
import { AppIcon } from '@/components/layout/TopBar';
import { User, Code2, FileText, Shield, ExternalLink, RefreshCw, Download, Check, ArrowUpCircle } from 'lucide-react';
import { useUpdate } from '@/hooks/useUpdate';
import Notification from '@/components/ui/Notification';
import type { NotificationState } from '@/lib/types';

/** 应用信息（从 package.json 读取） */
const APP_INFO = {
  name: 'AI Sketch',
  version: '0.1.0',
  description: 'AI 驱动的图表生成 Web 应用，支持 Excalidraw JSON、Mermaid、Draw.io XML 三种格式。',
  author: {
    name: 'Renhao Wan',
    email: '2653990378@qq.com',
  },
  repository: {
    type: 'git',
    url: 'https://github.com/renhao-wan/ai-sketch',
  },
  license: 'Apache-2.0',
  dependencies: [
    { name: 'Next.js', version: '16.0.1', description: 'React 框架', license: 'MIT' },
    { name: 'React', version: '19.2.0', description: 'UI 库', license: 'MIT' },
    { name: 'TypeScript', version: '5.9.3', description: '类型安全', license: 'Apache-2.0' },
    { name: 'Tailwind CSS', version: '4', description: 'CSS 框架', license: 'MIT' },
    { name: 'Excalidraw', version: '0.18.0', description: '白板绘图', license: 'MIT' },
    { name: 'Mermaid', version: '11.15.0', description: '图表渲染', license: 'MIT' },
    { name: 'Monaco Editor', version: '0.55.1', description: '代码编辑器', license: 'MIT' },
    { name: 'sql.js', version: '1.14.1', description: 'SQLite WASM', license: 'MIT' },
  ],
};

export function AboutSettings() {
  const { t } = useLocale();
  const { isElectron, status, info, progress, error, checkForUpdates, downloadUpdate, installUpdate } = useUpdate();
  const [localChecking, setLocalChecking] = useState(false);
  const [notification, setNotification] = useState<NotificationState>({ isOpen: false, title: '', message: '', type: 'info' });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCheck = () => {
    setLocalChecking(true);
    checkForUpdates();
    setTimeout(() => setLocalChecking(false), 3000);
  };

  const isChecking = status === 'checking' || localChecking;

  // 状态变化时重置本地 checking + 弹出通知
  useEffect(() => {
    if (status !== 'idle' && status !== 'checking') {
      setLocalChecking(false);
    }
    if (status === 'available' && info?.version) {
      setNotification({ isOpen: true, title: t('update.available'), message: `v${info.version}`, type: 'info' });
    } else if (status === 'downloaded') {
      setNotification({ isOpen: true, title: t('update.downloaded'), message: t('update.downloadedHint'), type: 'success' });
    } else if (status === 'error') {
      // 截取错误信息的第一行，避免过长
      const shortError = error?.split('\n')[0]?.substring(0, 60) || t('update.error');
      setNotification({ isOpen: true, title: t('update.error'), message: shortError, type: 'error' });
    } else if (status === 'not-available') {
      setNotification({ isOpen: true, title: t('about.upToDate'), message: '', type: 'success' });
    }
  }, [status, info, error, t]);

  return (
    <div className="space-y-8">
      {/* 应用信息 */}
      <section>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <AppIcon size={48} />
            <div className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] opacity-20 blur-xl scale-150" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--fg)]">
              {APP_INFO.name}
            </h2>
            <p className="text-sm text-[var(--muted)]">
              v{APP_INFO.version}
            </p>
          </div>
        </div>
        <p className="text-[var(--fg)] leading-relaxed">
          {t('about.defaultDescription')}
        </p>
      </section>

      {/* 版本更新 */}
      <section>
        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <ArrowUpCircle size={18} className="text-[var(--accent-indigo)]" />
            <div>
              <p className="text-sm font-medium text-[var(--fg)]">{t('about.versionUpdate')}</p>
              <p className="text-xs text-[var(--muted)]">v{APP_INFO.version}</p>
            </div>
          </div>

          {/* 状态对应的操作区 */}
          <div className="flex items-center gap-2">
            {/* 已是最新 */}
            {status === 'not-available' && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Check size={12} />{t('about.upToDate')}
              </span>
            )}

            {/* 有新版本 */}
            {status === 'available' && (
              <button
                onClick={downloadUpdate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-lg hover:bg-[var(--btn-primary-hover)] active:scale-[0.98] transition-all duration-200"
              >
                <Download size={12} />
                {t('update.download')} v{info?.version}
              </button>
            )}

            {/* 下载中 */}
            {status === 'downloading' && (
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-[var(--surface-warm-hover)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent-indigo)] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-[var(--muted)]">{Math.round(progress)}%</span>
              </div>
            )}

            {/* 下载完成 */}
            {status === 'downloaded' && (
              <button
                onClick={installUpdate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 active:scale-[0.98] transition-all duration-200"
              >
                <Check size={12} />
                {t('update.install')}
              </button>
            )}

            {/* 错误 */}
            {status === 'error' && (
              <button
                onClick={handleCheck}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-all duration-200"
              >
                <RefreshCw size={12} />
                {t('about.retry')}
              </button>
            )}

            {/* 检查更新 */}
            {(status === 'idle' || status === 'checking' || localChecking) && (
              mounted && isElectron ? (
                <button
                  onClick={handleCheck}
                  disabled={isChecking}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/20 rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} />
                  {isChecking ? t('about.checking') : t('about.checkUpdate')}
                </button>
              ) : (
                <span className="text-xs text-[var(--muted)]">{t('about.desktopOnly')}</span>
              )
            )}
          </div>
        </div>
      </section>

      {/* 开发者信息 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
          <User size={18} className="text-[var(--accent-indigo)]" />
          {t('about.developer')}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-indigo)]/10 flex items-center justify-center">
              <User size={18} className="text-[var(--accent-indigo)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--fg)]">
                {APP_INFO.author.name}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {APP_INFO.author.email}
              </p>
            </div>
          </div>
          <a
            href={APP_INFO.repository.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)] hover:bg-[var(--surface-warm-hover)] transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--accent-indigo)]/10 flex items-center justify-center">
              <Code2 size={18} className="text-[var(--accent-indigo)]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--fg)]">
                {t('about.repository')}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {APP_INFO.repository.url}
              </p>
            </div>
            <ExternalLink size={16} className="text-[var(--muted)] group-hover:text-[var(--fg)]" />
          </a>
        </div>
      </section>

      {/* 许可证信息 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
          <FileText size={18} className="text-[var(--accent-indigo)]" />
          {t('about.license')}
        </h3>
        <div className="p-4 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 text-xs font-medium bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] rounded">
              {APP_INFO.license}
            </span>
          </div>
          <p className="text-sm text-[var(--muted)]">
            {t('about.licenseDescription')}
          </p>
        </div>
      </section>

      {/* 隐私与条款 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
          <Shield size={18} className="text-[var(--accent-indigo)]" />
          {t('about.privacy')}
        </h3>
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]">
            <h4 className="text-sm font-medium text-[var(--fg)] mb-2">
              {t('about.dataCollection')}
            </h4>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {t('about.dataCollectionDesc')}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]">
            <h4 className="text-sm font-medium text-[var(--fg)] mb-2">
              {t('about.thirdPartyServices')}
            </h4>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {t('about.thirdPartyServicesDesc')}
            </p>
          </div>
        </div>
      </section>

      {/* 依赖信息 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
          <FileText size={18} className="text-[var(--accent-indigo)]" />
          {t('about.dependencies')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {APP_INFO.dependencies.map(dep => (
            <div
              key={dep.name}
              className="p-4 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-indigo)]/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-[var(--accent-indigo)]">
                    {dep.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--fg)] truncate">
                    {dep.name}
                  </p>
                </div>
              </div>
              <p className="text-xs text-[var(--muted)] mb-2 line-clamp-2">
                {t(`about.dep.${dep.name}` as TranslationKey)}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 px-2 py-0.5 rounded">
                  v{dep.version}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {dep.license}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Notification
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />
    </div>
  );
}
