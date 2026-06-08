import { describe, it, expect, vi, afterEach } from 'vitest';
import { timeAgo } from './time-ago';

// Mock 翻译函数
const t = (key: string): string => {
  const map: Record<string, string> = {
    'time.justNow': '刚刚',
    'time.minutesAgo': '分钟前',
    'time.hoursAgo': '小时前',
    'time.daysAgo': '天前',
  };
  return map[key] || key;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('timeAgo', () => {
  it('小于 1 分钟应返回"刚刚"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000);
    expect(timeAgo(1000000 - 30000, t)).toBe('刚刚');
  });

  it('1-59 分钟应返回分钟数', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000);
    expect(timeAgo(1000000 - 5 * 60000, t)).toBe('5 分钟前');
  });

  it('1-23 小时应返回小时数', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000);
    expect(timeAgo(1000000 - 3 * 3600000, t)).toBe('3 小时前');
  });

  it('1 天以上应返回天数', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000);
    expect(timeAgo(1000000 - 2 * 86400000, t)).toBe('2 天前');
  });

  it('正好 1 分钟应返回"1 分钟前"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000);
    expect(timeAgo(1000000 - 60000, t)).toBe('1 分钟前');
  });
});
