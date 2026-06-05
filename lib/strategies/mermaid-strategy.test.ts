import { describe, it, expect } from 'vitest';
import { mermaidStrategy } from './mermaid-strategy';

describe('MermaidStrategy', () => {
  describe('属性', () => {
    it('format 应为 mermaid', () => {
      expect(mermaidStrategy.format).toBe('mermaid');
    });

    it('codeLanguage 应为 markdown', () => {
      expect(mermaidStrategy.codeLanguage).toBe('markdown');
    });
  });

  describe('getSystemPrompt', () => {
    it('应返回非空字符串', () => {
      const prompt = mermaidStrategy.getSystemPrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('postProcess', () => {
    it('应移除代码块', () => {
      const input = '```mermaid\ngraph TD\nA-->B\n```';
      const result = mermaidStrategy.postProcess(input);
      expect(result).toBe('graph TD\nA-->B');
    });

    it('应修复箭头语法', () => {
      const input = 'graph TD\nA -- > B';
      const result = mermaidStrategy.postProcess(input);
      expect(result).toContain('-->');
    });

    it('应为 flowchart 添加默认方向', () => {
      const input = 'flowchart\nA-->B';
      const result = mermaidStrategy.postProcess(input);
      expect(result).toMatch(/^flowchart TD/);
    });

    it('已有方向的 flowchart 不应修改', () => {
      const input = 'flowchart LR\nA-->B';
      const result = mermaidStrategy.postProcess(input);
      expect(result).toMatch(/^flowchart LR/);
    });

    it('应从解释文字中提取 Mermaid 代码', () => {
      const input = '这是一个流程图：\ngraph TD\nA-->B';
      const result = mermaidStrategy.postProcess(input);
      expect(result).toBe('graph TD\nA-->B');
    });

    it('应处理空输入', () => {
      expect(mermaidStrategy.postProcess('')).toBe('');
    });
  });

  describe('validate', () => {
    it('有效 flowchart 应返回 valid', () => {
      const result = mermaidStrategy.validate('graph TD\nA-->B');
      expect(result.valid).toBe(true);
    });

    it('有效 sequenceDiagram 应返回 valid', () => {
      const result = mermaidStrategy.validate('sequenceDiagram\nA->>B: hello');
      expect(result.valid).toBe(true);
    });

    it('无效关键字应返回 invalid', () => {
      const result = mermaidStrategy.validate('invalid content');
      expect(result.valid).toBe(false);
    });

    it('空字符串应返回 invalid', () => {
      const result = mermaidStrategy.validate('');
      expect(result.valid).toBe(false);
    });

    it('单行有效关键字应返回 valid（流式场景）', () => {
      const result = mermaidStrategy.validate('graph TD');
      expect(result.valid).toBe(true);
    });
  });

  describe('generateImagePrompt', () => {
    it('应包含图表类型', () => {
      const prompt = mermaidStrategy.generateImagePrompt('sequence');
      expect(prompt).toContain('时序图');
    });
  });
});
