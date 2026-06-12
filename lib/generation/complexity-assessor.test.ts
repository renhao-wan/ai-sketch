import { describe, it, expect } from 'vitest';
import { assessComplexity, calculateComplexityScore } from './complexity-assessor';

describe('calculateComplexityScore', () => {
  it('简单输入应返回低分', () => {
    const score = calculateComplexityScore('画一个矩形');
    expect(score).toBeLessThan(12);
  });

  it('包含大量节点应返回高分', () => {
    const score = calculateComplexityScore('画一个包含 20 个节点的流程图');
    expect(score).toBeGreaterThanOrEqual(6); // 数量指标 +6
  });

  it('包含关系词应增加分数', () => {
    const base = calculateComplexityScore('画一个图');
    const withRelation = calculateComplexityScore('画一个图，节点之间有连接和依赖关系');
    expect(withRelation).toBeGreaterThan(base);
  });

  it('包含结构复杂度词应增加分数', () => {
    const score = calculateComplexityScore('画一个微服务架构图，包含数据库和分层组件');
    expect(score).toBeGreaterThanOrEqual(6); // 多个复杂度指标
  });

  it('包含分组词应增加分数', () => {
    const base = calculateComplexityScore('画一个图');
    const withGroup = calculateComplexityScore('画一个图，分为三个模块，包括前端和后端');
    expect(withGroup).toBeGreaterThan(base);
  });

  it('英文关键词同样生效', () => {
    const score = calculateComplexityScore('Draw a microservice architecture with 15 components that connect and communicate');
    expect(score).toBeGreaterThan(0);
  });

  it('空字符串应返回 0', () => {
    expect(calculateComplexityScore('')).toBe(0);
  });
});

describe('assessComplexity', () => {
  it('Mermaid 格式始终返回 fast', () => {
    expect(assessComplexity('画一个包含 50 个节点的复杂微服务架构图', 'mermaid')).toBe('fast');
    expect(assessComplexity('简单', 'mermaid')).toBe('fast');
  });

  it('简单需求返回 fast', () => {
    expect(assessComplexity('画一个矩形', 'excalidraw')).toBe('fast');
  });

  it('复杂需求返回 quality', () => {
    // 需要足够多的指标达到 12 分阈值
    const complexInput = '画一个包含 20 个微服务组件的架构图，分为数据层、服务层和展示层，组件之间有连接和依赖关系，包含数据库表和字段定义';
    expect(assessComplexity(complexInput, 'excalidraw')).toBe('quality');
  });

  it('drawio 格式的评分逻辑与 excalidraw 一致', () => {
    const input = '画一个简单的图';
    expect(assessComplexity(input, 'drawio')).toBe(assessComplexity(input, 'excalidraw'));
  });
});
