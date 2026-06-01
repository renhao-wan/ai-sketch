/**
 * 主题工具函数
 * 提供获取当前主题颜色、检测主题类型等功能
 */

export type Theme = 'dark' | 'light' | 'ocean' | 'sakura' | 'emerald' | 'sunset';

/** 获取计算后的 CSS 变量值 */
export function getCSSVariable(varName: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/** 获取当前主题 */
export function getCurrentTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const theme = document.documentElement.dataset.theme;
  return (theme as Theme) || 'light';
}

/** 检测当前是否为深色主题 */
export function isDarkTheme(): boolean {
  const theme = getCurrentTheme();
  // light 主题是浅色，其他都是深色
  return theme !== 'light';
}

/** 获取 Mermaid 主题变量（根据当前主题） */
export function getMermaidThemeVariables() {
  const isDark = isDarkTheme();

  return {
    fontSize: '14px',
    fontFamily: 'inherit',
    lineColor: isDark ? getCSSVariable('--muted') : '#6b7280',
    primaryColor: getCSSVariable('--accent-indigo'),
    primaryTextColor: getCSSVariable('--fg'),
    primaryBorderColor: getCSSVariable('--border'),
    secondaryColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6',
    tertiaryColor: getCSSVariable('--bg'),
    background: getCSSVariable('--bg'),
    mainBkg: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6',
    nodeBorder: getCSSVariable('--accent-indigo'),
    clusterBkg: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
    clusterBorder: getCSSVariable('--border'),
    titleColor: getCSSVariable('--fg'),
    edgeLabelBackground: getCSSVariable('--bg'),
    nodeTextColor: getCSSVariable('--fg'),
  };
}

/** 获取 Excalidraw 背景色 */
export function getExcalidrawBackgroundColor(): string {
  // Excalidraw 使用十六进制颜色，需要转换
  const bg = getCSSVariable('--bg');
  if (!bg) return '#FAF8F5';

  // 如果是 rgba 格式，转换为十六进制
  if (bg.startsWith('rgba') || bg.startsWith('rgb')) {
    return rgbaToHex(bg);
  }

  return bg;
}

/** RGBA 颜色转十六进制 */
function rgbaToHex(rgba: string): string {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (!match) return '#FAF8F5';

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}
