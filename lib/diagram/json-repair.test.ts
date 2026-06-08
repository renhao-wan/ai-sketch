import { describe, it, expect } from 'vitest';
import { stripCodeFences, repairJsonClosure, extractFirstJsonArray, extractCompleteElements } from './json-repair';

describe('stripCodeFences', () => {
  it('应移除 json 代码块', () => {
    expect(stripCodeFences('```json\n[{"a":1}]\n```')).toBe('[{"a":1}]');
  });

  it('应移除无语言标记的代码块', () => {
    expect(stripCodeFences('```\nhello\n```')).toBe('hello');
  });

  it('应移除 mermaid 代码块', () => {
    expect(stripCodeFences('```mermaid\ngraph TD\n```')).toBe('graph TD');
  });

  it('应处理无代码块的文本', () => {
    expect(stripCodeFences('plain text')).toBe('plain text');
  });

  it('应处理空字符串', () => {
    expect(stripCodeFences('')).toBe('');
  });

  it('应处理 null/undefined', () => {
    expect(stripCodeFences(null as unknown as string)).toBeNull();
    expect(stripCodeFences(undefined as unknown as string)).toBeUndefined();
  });
});

describe('repairJsonClosure', () => {
  it('应修复未闭合的数组', () => {
    const result = repairJsonClosure('[{"a":1}');
    expect(JSON.parse(result)).toEqual([{ a: 1 }]);
  });

  it('应修复未闭合的对象', () => {
    const result = repairJsonClosure('{"a":1');
    expect(JSON.parse(result)).toEqual({ a: 1 });
  });

  it('应修复未闭合的字符串', () => {
    const result = repairJsonClosure('{"a":"hello');
    expect(JSON.parse(result)).toEqual({ a: 'hello' });
  });

  it('应移除尾部逗号后闭合', () => {
    const result = repairJsonClosure('[{"a":1},');
    expect(JSON.parse(result)).toEqual([{ a: 1 }]);
  });

  it('应处理嵌套未闭合结构', () => {
    const result = repairJsonClosure('{"a":{"b":1}');
    expect(JSON.parse(result)).toEqual({ a: { b: 1 } });
  });

  it('应跳过前导文字', () => {
    const result = repairJsonClosure('Here is the JSON: [{"a":1}]');
    expect(JSON.parse(result)).toEqual([{ a: 1 }]);
  });

  it('应处理已正确的 JSON', () => {
    const input = '[{"a":1},{"b":2}]';
    const result = repairJsonClosure(input);
    expect(JSON.parse(result)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('应处理空输入', () => {
    expect(repairJsonClosure('')).toBe('');
    expect(repairJsonClosure(null as unknown as string)).toBeNull();
  });

  it('应处理无 JSON 内容的文本', () => {
    expect(repairJsonClosure('no json here')).toBe('no json here');
  });

  it('应处理代码块包裹的 JSON', () => {
    const result = repairJsonClosure('```json\n[{"a":1}]\n```');
    expect(JSON.parse(result)).toEqual([{ a: 1 }]);
  });
});

describe('extractFirstJsonArray', () => {
  it('应提取纯 JSON 数组', () => {
    const result = extractFirstJsonArray('[{"a":1},{"b":2}]');
    expect(JSON.parse(result!)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('应从混合文本中提取数组', () => {
    const result = extractFirstJsonArray('Here is the data: [{"a":1}] done');
    expect(JSON.parse(result!)).toEqual([{ a: 1 }]);
  });

  it('应处理包含字符串中 ] 的数组', () => {
    const result = extractFirstJsonArray('[{"a":"hello]world"}]');
    expect(JSON.parse(result!)).toEqual([{ a: 'hello]world' }]);
  });

  it('无数组时返回 null', () => {
    expect(extractFirstJsonArray('no array here')).toBeNull();
  });

  it('空输入返回 null', () => {
    expect(extractFirstJsonArray('')).toBeNull();
    expect(extractFirstJsonArray(null as unknown as string)).toBeNull();
  });

  it('应跳过无效数组尝试下一个', () => {
    const result = extractFirstJsonArray('[invalid] [{"a":1}]');
    expect(JSON.parse(result!)).toEqual([{ a: 1 }]);
  });
});

describe('extractCompleteElements', () => {
  it('应提取完整的 JSON 对象', () => {
    const buffer = '[{"a":1},{"b":2}]';
    const { elements, consumed } = extractCompleteElements(buffer);
    expect(elements).toEqual([{ a: 1 }, { b: 2 }]);
    expect(consumed).toBeGreaterThan(0);
  });

  it('应处理流式不完整 buffer', () => {
    const buffer = '[{"a":1},{"b":2';
    const { elements, consumed } = extractCompleteElements(buffer);
    expect(elements).toEqual([{ a: 1 }]);
    expect(consumed).toBeGreaterThan(0);
  });

  it('应处理空 buffer', () => {
    expect(extractCompleteElements('')).toEqual({ elements: [], consumed: 0 });
  });

  it('应处理无数组的 buffer', () => {
    expect(extractCompleteElements('no array')).toEqual({ elements: [], consumed: 0 });
  });

  it('应支持 startFrom 参数续传', () => {
    const buffer = '[{"a":1},{"b":2},{"c":3}]';
    const first = extractCompleteElements(buffer);
    const second = extractCompleteElements(buffer, first.consumed);
    // 第一次提取全部 3 个，第二次无新内容
    expect(first.elements.length).toBe(3);
    expect(second.elements.length).toBe(0);
  });

  it('应跳过格式错误的对象', () => {
    const buffer = '[{invalid},{"a":1}]';
    const { elements } = extractCompleteElements(buffer);
    expect(elements).toEqual([{ a: 1 }]);
  });
});
