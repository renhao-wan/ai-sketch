/**
 * AI Sketch Design System
 * 产品级设计令牌与工具类
 */

// ============================================
// Glass Morphism
// ============================================

export const glass = {
  default: 'bg-white/60 backdrop-blur-[40px] border border-white/10',
  strong: 'bg-white/80 backdrop-blur-[60px] border border-white/15',
  subtle: 'bg-white/45 backdrop-blur-2xl border border-white/8',
  panel: 'bg-white/65 backdrop-blur-2xl border-r border-white/10',
};

// ============================================
// Shadows
// ============================================

export const shadows = {
  soft: 'shadow-[0_4px_20px_rgba(15,23,42,0.06)]',
  floating: 'shadow-[0_10px_40px_rgba(15,23,42,0.12)]',
  glow: 'shadow-[0_0_40px_rgba(99,102,241,0.18)]',
  card: 'shadow-[0_2px_12px_rgba(15,23,42,0.04)]',
  prompt: 'shadow-[0_10px_60px_rgba(0,0,0,0.08)]',
};

// ============================================
// Colors
// ============================================

export const colors = {
  bg: '#F5F7FB',
  fg: '#0F172A',
  muted: '#64748B',
  primary: '#111827',
  accent: {
    indigo: '#6366F1',
    violet: '#8B5CF6',
    cyan: '#06B6D4',
  },
  border: 'rgba(255, 255, 255, 0.12)',
  card: 'rgba(255, 255, 255, 0.72)',
};

// ============================================
// Radius
// ============================================

export const radius = {
  card: 'rounded-3xl',       // 24px
  button: 'rounded-2xl',     // 16px
  floating: 'rounded-full',  // 999px
  input: 'rounded-xl',       // 12px
  chip: 'rounded-full',
};

// ============================================
// Animation
// ============================================

export const animation = {
  easeOut: 'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
  easeOutSlow: 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
  hoverLift: 'hover:-translate-y-px active:scale-[0.98]',
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
};

// ============================================
// Typography
// ============================================

export const typography = {
  heading: 'font-bold tracking-tight text-[var(--fg)]',
  body: 'text-[var(--fg)] leading-relaxed',
  muted: 'text-[var(--muted)]',
  mono: 'font-[var(--font-geist-mono)]',
};

// ============================================
// Spacing
// ============================================

export const spacing = {
  page: 'px-6 py-4',
  card: 'p-6',
  section: 'py-16 px-8',
  input: 'px-4 py-3',
};

// ============================================
// Focus Ring
// ============================================

export const focus = {
  default: 'focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 focus:border-[var(--accent-indigo)]',
  subtle: 'focus:outline-none focus:ring-1 focus:ring-black/5',
};
