'use client';

import { useLocale } from '@/locales';
import { AppIcon } from '@/components/layout/TopBar';
import { User, Code2, FileText, Shield, ExternalLink } from 'lucide-react';

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
              className="p-4 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)] hover:border-[var(--accent-indigo)]/30 hover:shadow-sm transition-all duration-200"
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
                {dep.description}
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
    </div>
  );
}
