/**
 * Mermaid 语法修复工具
 *
 * 处理常见的 LLM 生成 Mermaid 代码问题：
 * - 特殊字符未转义（|, <, >, &, "）
 * - 节点标签中的特殊字符
 * - 链接标签中的特殊字符
 * - 语法格式错误
 */

/**
 * 转义 Mermaid 节点标签中的特殊字符
 * 在 Mermaid 中，| 是特殊字符（用于链接标签），需要转义为 \|
 */
export function escapeMermaidSpecialChars(str: string): string {
  if (!str || typeof str !== 'string') return str;

  // 转义特殊字符
  return str
    .replace(/\|/g, '\\|')  // | -> \|
    .replace(/</g, '&lt;')   // < -> &lt;
    .replace(/>/g, '&gt;')   // > -> &gt;
    .replace(/&/g, '&amp;')  // & -> &amp; (需要在其他转义之后)
    .replace(/"/g, '&quot;'); // " -> &quot;
}

/**
 * 修复 Mermaid 节点标签中的特殊字符
 * 匹配模式：["..."] 或 [...]
 */
export function fixMermaidNodeLabels(code: string): string {
  if (!code || typeof code !== 'string') return code;

  // 匹配节点标签：["..."] 或 [...]
  // 注意：需要处理嵌套引号和转义字符
  return code.replace(
    /\["([^"]*?)"\]/g,
    (match, content) => {
      // 检查是否已经转义过
      if (content.includes('\\|') || content.includes('&lt;') || content.includes('&gt;')) {
        return match;
      }
      // 转义特殊字符
      const escaped = escapeMermaidSpecialChars(content);
      return `["${escaped}"]`;
    }
  );
}

/**
 * 修复 Mermaid 链接标签中的特殊字符
 * 匹配模式：|"..."|
 */
export function fixMermaidLinkLabels(code: string): string {
  if (!code || typeof code !== 'string') return code;

  // 匹配链接标签：|"..."|
  return code.replace(
    /\|"([^"]*?)"\|/g,
    (match, content) => {
      // 检查是否已经转义过
      if (content.includes('\\|') || content.includes('&lt;') || content.includes('&gt;')) {
        return match;
      }
      // 转义特殊字符
      const escaped = escapeMermaidSpecialChars(content);
      return `|"${escaped}"|`;
    }
  );
}

/**
 * 修复常见的 Mermaid 语法错误
 * 1. 特殊字符转义
 * 2. 移除不支持的语法
 * 3. 修复格式问题
 */
export function fixMermaidSyntax(code: string): string {
  if (!code || typeof code !== 'string') return code;

  let result = code;

  // 1. 修复节点标签中的特殊字符
  result = fixMermaidNodeLabels(result);

  // 2. 修复链接标签中的特殊字符
  result = fixMermaidLinkLabels(result);

  // 3. 修复 subgraph 标签中的特殊字符
  result = result.replace(
    /subgraph\s+(\w+)\["([^"]*?)"\]/g,
    (match, id, content) => {
      if (content.includes('\\|') || content.includes('&lt;') || content.includes('&gt;')) {
        return match;
      }
      const escaped = escapeMermaidSpecialChars(content);
      return `subgraph ${id}["${escaped}"]`;
    }
  );

  // 4. 移除不支持的 style 语法（某些 Mermaid 版本不支持）
  // 注意：这可能会移除有效的 style，所以只移除明显错误的
  result = result.replace(/style\s+\w+\s+fill:none,stroke:none/g, '');

  return result;
}

/**
 * 预处理 Mermaid 代码，增加健壮性
 * 在渲染之前调用，尝试自动修复常见的语法问题
 */
export function preprocessMermaidCode(code: string): string {
  if (!code || typeof code !== 'string') return code;

  // 移除代码围栏
  let processed = code.trim();
  processed = processed.replace(/^```(?:mermaid)?\s*\n?/i, '');
  processed = processed.replace(/\n?```\s*$/i, '');
  processed = processed.trim();

  // 修复语法
  processed = fixMermaidSyntax(processed);

  return processed;
}
