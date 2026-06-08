import { describe, it, expect } from 'vitest';
import { generateId, parseStoredImages } from './index';

describe('generateId', () => {
  it('应返回字符串', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('应返回非空字符串', () => {
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('连续调用应返回不同值', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('parseStoredImages', () => {
  it('无参数应返回空数组', () => {
    expect(parseStoredImages()).toEqual([]);
    expect(parseStoredImages(undefined, undefined)).toEqual([]);
    expect(parseStoredImages('', '')).toEqual([]);
  });

  it('单图应返回包含一项的数组', () => {
    const result = parseStoredImages('base64data', 'image/png');
    expect(result).toEqual([{ data: 'base64data', mimeType: 'image/png' }]);
  });

  it('多图 JSON 应解析为数组', () => {
    const images = [
      { data: 'img1', mimeType: 'image/png' },
      { data: 'img2', mimeType: 'image/jpeg' },
    ];
    const result = parseStoredImages(JSON.stringify(images), 'application/json');
    expect(result).toEqual(images);
  });

  it('无效 JSON 且 mimeType 为 application/json 应降级为单图', () => {
    const result = parseStoredImages('not-json', 'application/json');
    expect(result).toEqual([{ data: 'not-json', mimeType: 'image/png' }]);
  });

  it('非 application/json 的 mimeType 应作为单图处理', () => {
    const result = parseStoredImages('data', 'image/jpeg');
    expect(result).toEqual([{ data: 'data', mimeType: 'image/jpeg' }]);
  });
});
