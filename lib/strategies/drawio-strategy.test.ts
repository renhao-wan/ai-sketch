import { describe, it, expect } from 'vitest';
import { drawioStrategy } from './drawio-strategy';

describe('DrawioStrategy', () => {
  describe('属性', () => {
    it('format 应为 drawio', () => {
      expect(drawioStrategy.format).toBe('drawio');
    });

    it('codeLanguage 应为 xml', () => {
      expect(drawioStrategy.codeLanguage).toBe('xml');
    });

    it('fileExtension 应为 drawio', () => {
      expect(drawioStrategy.fileExtension).toBe('drawio');
    });

    it('mimeType 应为 application/xml', () => {
      expect(drawioStrategy.mimeType).toBe('application/xml');
    });
  });

  describe('getSystemPrompt', () => {
    it('应返回非空字符串', () => {
      const prompt = drawioStrategy.getSystemPrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('应包含 Draw.io 相关关键词', () => {
      const prompt = drawioStrategy.getSystemPrompt();
      expect(prompt).toContain('mxGraphModel');
    });
  });

  describe('getUserPrompt', () => {
    it('应包含用户输入', () => {
      const prompt = drawioStrategy.getUserPrompt('画一个流程图', 'flowchart');
      expect(prompt).toContain('画一个流程图');
    });

    it('auto 模式应包含自动选择指引', () => {
      const prompt = drawioStrategy.getUserPrompt('画一个图', 'auto');
      expect(prompt).toContain('画一个图');
    });
  });

  describe('postProcess', () => {
    const validXml = '<mxfile><diagram name="Page-1" id="diagram-1"><mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" /></root></mxGraphModel></diagram></mxfile>';

    it('应提取 mxfile 标签', () => {
      const input = `一些文字\n${validXml}\n更多文字`;
      const result = drawioStrategy.postProcess(input);
      expect(result).toBe(validXml);
    });

    it('应从代码块中提取 XML', () => {
      const input = '```xml\n' + validXml + '\n```';
      const result = drawioStrategy.postProcess(input);
      expect(result).toBe(validXml);
    });

    it('应提取 mxGraphModel 标签（无 mxfile 包裹）', () => {
      const mxGraphXml = '<mxGraphModel><root><mxCell id="0" /></root></mxGraphModel>';
      const result = drawioStrategy.postProcess(mxGraphXml);
      expect(result).toBe(mxGraphXml);
    });

    it('无有效 XML 结构时应返回空字符串', () => {
      expect(drawioStrategy.postProcess('hello world')).toBe('');
    });

    it('应处理空输入', () => {
      expect(drawioStrategy.postProcess('')).toBe('');
    });

    it('应处理 null 输入', () => {
      expect(drawioStrategy.postProcess(null as unknown as string)).toBeNull();
    });
  });

  describe('optimize', () => {
    it('应原样返回代码（identity 优化）', () => {
      const code = '<mxfile><diagram>test</diagram></mxfile>';
      expect(drawioStrategy.optimize(code)).toBe(code);
    });
  });

  describe('validate', () => {
    it('有效 mxGraphModel 应返回 valid', () => {
      const xml = '<mxGraphModel><root><mxCell id="0" /></root></mxGraphModel>';
      const result = drawioStrategy.validate(xml);
      expect(result.valid).toBe(true);
    });

    it('有效 mxfile 应返回 valid', () => {
      const xml = '<mxfile><diagram><mxGraphModel><root><mxCell id="0" /></root></mxGraphModel></diagram></mxfile>';
      const result = drawioStrategy.validate(xml);
      expect(result.valid).toBe(true);
    });

    it('缺少 mxGraphModel 和 mxfile 应返回 invalid', () => {
      const result = drawioStrategy.validate('<div>not drawio</div>');
      expect(result.valid).toBe(false);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('mxGraphModel');
      }
    });

    it('空字符串应返回 invalid', () => {
      const result = drawioStrategy.validate('');
      expect(result.valid).toBe(false);
    });

    it('纯空白应返回 invalid', () => {
      const result = drawioStrategy.validate('   ');
      expect(result.valid).toBe(false);
    });
  });

  describe('generateImagePrompt', () => {
    it('应包含 Draw.io 关键词', () => {
      const prompt = drawioStrategy.generateImagePrompt('flowchart');
      expect(prompt).toContain('Draw.io');
    });

    it('应包含图表类型名称', () => {
      const prompt = drawioStrategy.generateImagePrompt('sequence');
      expect(prompt).toContain('时序图');
    });
  });
});
