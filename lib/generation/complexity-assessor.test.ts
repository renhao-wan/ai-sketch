import { describe, it, expect } from 'vitest';
import { assessComplexity, calculateComplexityScore } from './complexity-assessor';

describe('calculateComplexityScore', () => {
  it('空字符串应返回 0', () => {
    expect(calculateComplexityScore('')).toBe(0);
  });

  it('短文本（< 20 字符）应返回 0', () => {
    expect(calculateComplexityScore('画一个矩形')).toBe(0);
  });

  it('20-49 字符应返回 1', () => {
    const input = '画'.repeat(25);
    expect(calculateComplexityScore(input)).toBe(1);
  });

  it('50-99 字符应返回 2', () => {
    const input = '画'.repeat(60);
    expect(calculateComplexityScore(input)).toBe(2);
  });

  it('100-199 字符应返回 3', () => {
    const input = '画'.repeat(150);
    expect(calculateComplexityScore(input)).toBe(3);
  });

  it('200-299 字符应返回 4', () => {
    const input = '画'.repeat(250);
    expect(calculateComplexityScore(input)).toBe(4);
  });

  it('300-399 字符应返回 5', () => {
    const input = '画'.repeat(350);
    expect(calculateComplexityScore(input)).toBe(5);
  });

  it('400-499 字符应返回 6', () => {
    const input = '画'.repeat(450);
    expect(calculateComplexityScore(input)).toBe(6);
  });

  it('500-599 字符应返回 7', () => {
    const input = '画'.repeat(550);
    expect(calculateComplexityScore(input)).toBe(7);
  });

  it('600-799 字符应返回 8', () => {
    const input = '画'.repeat(700);
    expect(calculateComplexityScore(input)).toBe(8);
  });

  it('800-999 字符应返回 9', () => {
    const input = '画'.repeat(900);
    expect(calculateComplexityScore(input)).toBe(9);
  });

  it('>= 1000 字符应返回 10', () => {
    const input = '画'.repeat(1200);
    expect(calculateComplexityScore(input)).toBe(10);
  });

  it('较长输入评分应高于较短输入', () => {
    const short = calculateComplexityScore('画一个图');
    const long = calculateComplexityScore('画'.repeat(300));
    expect(long).toBeGreaterThan(short);
  });
});

describe('assessComplexity', () => {
  it('Mermaid 格式始终返回 fast', () => {
    expect(assessComplexity('画一个包含 50 个节点的复杂微服务架构图', 'mermaid')).toBe('fast');
    expect(assessComplexity('简单', 'mermaid')).toBe('fast');
    expect(assessComplexity('画'.repeat(1000), 'mermaid')).toBe('fast');
  });

  it('短输入返回 fast', () => {
    expect(assessComplexity('画一个矩形', 'excalidraw')).toBe('fast');
    expect(assessComplexity('画'.repeat(100), 'excalidraw')).toBe('fast');
  });

  it('>= 500 字符的输入返回 quality', () => {
    const longInput = '画'.repeat(500);
    expect(assessComplexity(longInput, 'excalidraw')).toBe('quality');
  });

  it('接近阈值的输入行为正确', () => {
    const justBelow = '画'.repeat(499);
    const justAbove = '画'.repeat(500);
    expect(assessComplexity(justBelow, 'excalidraw')).toBe('fast');
    expect(assessComplexity(justAbove, 'excalidraw')).toBe('quality');
  });

  it('drawio 格式的评分逻辑与 excalidraw 一致', () => {
    const shortInput = '画一个简单的图';
    const longInput = '画'.repeat(600);
    expect(assessComplexity(shortInput, 'drawio')).toBe(assessComplexity(shortInput, 'excalidraw'));
    expect(assessComplexity(longInput, 'drawio')).toBe(assessComplexity(longInput, 'excalidraw'));
  });
});
