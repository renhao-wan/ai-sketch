import { AlertTriangle, X } from 'lucide-react';

interface CountBannerProps {
  /** 是否显示 Banner */
  show: boolean;
  /** 标题文本 */
  title: string;
  /** 描述文本 */
  description: string;
  /** 关闭回调 */
  onDismiss: () => void;
}

/**
 * 通用数量提示 Banner 组件
 * 同步初始化 + 条件渲染，无过渡动画，避免布局闪烁
 *
 * @example
 * ```tsx
 * <CountBanner
 *   show={showBanner}
 *   title={t('conversation.bannerTitle')}
 *   description={t('conversation.bannerDescription').replace('{count}', String(count))}
 *   onDismiss={handleDismissBanner}
 * />
 * ```
 */
export default function CountBanner({ show, title, description, onDismiss }: CountBannerProps) {
  if (!show) return null;

  return (
    <div className="p-4 rounded-2xl border border-[var(--accent-cyan)]/20 bg-[var(--accent-cyan)]/5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-[var(--accent-cyan)]/10 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={16} className="text-[var(--accent-cyan)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--fg)]">{title}</p>
          <p className="text-xs text-[var(--muted)] mt-0.5">{description}</p>
        </div>
        <button
          onClick={onDismiss}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200 flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
