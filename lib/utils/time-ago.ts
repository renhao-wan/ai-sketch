import type { TranslationKey } from '@/lib/locales';

export function timeAgo(ts: number, t: (key: TranslationKey) => string): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return t('time.justNow');
  if (diff < 3600000) return `${Math.floor(diff / 60000)} ${t('time.minutesAgo')}`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ${t('time.hoursAgo')}`;
  return `${Math.floor(diff / 86400000)} ${t('time.daysAgo')}`;
}
