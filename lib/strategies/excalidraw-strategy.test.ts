import { describe, it, expect } from 'vitest';
import { excalidrawStrategy } from './excalidraw-strategy';

describe('ExcalidrawStrategy', () => {
  describe('属性', () => {
    it('format 应为 excalidraw', () => {
      expect(excalidrawStrategy.format).toBe('excalidraw');
    });

    it('codeLanguage 应为 json', () => {
      expect(excalidrawStrategy.codeLanguage).toBe('json');
    });
  });

  describe('getSystemPrompt', () => {
    it('应返回非空字符串', () => {
      const prompt = excalidrawStrategy.getSystemPrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('getUserPrompt', () => {
    it('应包含用户输入', () => {
      const prompt = excalidrawStrategy.getUserPrompt('画一个流程图', 'flowchart');
      expect(prompt).toContain('画一个流程图');
    });
  });

  describe('postProcess', () => {
    it('应移除代码块并修复 JSON', () => {
      const input = '```json\n[{"type":"rectangle","x":0,"y":0}]\n```';
      const result = excalidrawStrategy.postProcess(input);
      expect(JSON.parse(result)).toEqual([{ type: 'rectangle', x: 0, y: 0 }]);
    });

    it('应修复未闭合的数组', () => {
      const input = '[{"type":"rectangle","x":0}';
      const result = excalidrawStrategy.postProcess(input);
      expect(JSON.parse(result)).toEqual([{ type: 'rectangle', x: 0 }]);
    });

    it('应处理空输入', () => {
      expect(excalidrawStrategy.postProcess('')).toBe('');
      expect(excalidrawStrategy.postProcess(null as unknown as string)).toBeNull();
    });

    it('应处理纯 JSON（无代码块）', () => {
      const input = '[{"type":"text","x":100,"y":200}]';
      const result = excalidrawStrategy.postProcess(input);
      expect(JSON.parse(result)).toEqual([{ type: 'text', x: 100, y: 200 }]);
    });
  });

  describe('validate', () => {
    it('有效 JSON 数组应返回 valid', () => {
      const result = excalidrawStrategy.validate('[{"type":"rectangle","x":0,"y":0}]');
      expect(result.valid).toBe(true);
    });

    it('非数组应返回 invalid', () => {
      const result = excalidrawStrategy.validate('{"type":"rectangle"}');
      expect(result.valid).toBe(false);
    });

    it('无效 JSON 应返回 invalid', () => {
      const result = excalidrawStrategy.validate('[{invalid}]');
      expect(result.valid).toBe(false);
    });

    it('空字符串应返回 invalid', () => {
      const result = excalidrawStrategy.validate('');
      expect(result.valid).toBe(false);
    });
  });

  describe('generateImagePrompt', () => {
    it('应包含图表类型', () => {
      const prompt = excalidrawStrategy.generateImagePrompt('flowchart');
      expect(prompt).toContain('流程图');
    });
  });
});
