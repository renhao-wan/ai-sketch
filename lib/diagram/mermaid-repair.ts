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
 * 注意：只转义节点标签中的特殊字符，不转义链接标签中的
 * 链接标签格式：|"标签文本"|
 * 节点标签格式：["标签文本"] 或 (标签文本) 等
 *
 * 重要：不转义 < 和 > 字符，因为它们在 Mermaid 的箭头语法中是必需的
 * 只转义 & 字符，不转义 " 字符（因为 " 是 Mermaid 标签的一部分）
 */
export function escapeMermaidNodeLabel(str: string): string {
  if (!str || typeof str !== 'string') return str;

  // 先检查是否已经转义过，避免重复转义
  if (str.includes('&amp;')) {
    return str;
  }

  // 只转义 & 字符，不转义 <, >, " 字符
  // 因为 < 和 > 在 Mermaid 的箭头语法中是必需的（如 -->, <-->）
  // 因为 " 是 Mermaid 标签的一部分（如 ["content"]）
  return str
    .replace(/&/g, '&amp;');  // & -> &amp; (必须最先)
}

/**
 * 修复 Mermaid 节点标签中的特殊字符
 * 匹配模式：
 * - ["..."] - 带引号的标准节点标签
 * - [...] - 不带引号的标准节点标签
 * - {"..."} - 带引号的菱形节点标签
 * - {...} - 不带引号的菱形节点标签
 * 注意：不转义 | 字符，因为这会破坏链接标签语法
 */
export function fixMermaidNodeLabels(code: string): string {
  if (!code || typeof code !== 'string') return code;

  let result = code;

  // 1. 匹配带引号的节点标签：["..."]
  result = result.replace(
    /\["([^"]*?)"\]/g,
    (match, content) => {
      if (content.includes('&lt;') || content.includes('&gt;')) {
        return match;
      }
      const escaped = escapeMermaidNodeLabel(content);
      return `["${escaped}"]`;
    }
  );

  // 2. 匹配不带引号的节点标签：[...]
  // 注意：需要排除链接标签 |...| 和箭头语法中的 ]
  result = result.replace(
    /(?<![->])\[([^\]]*?)\]/g,
    (match, content) => {
      // 排除链接标签
      if (match.startsWith('|') || match.endsWith('|')) {
        return match;
      }
      // 排除空内容
      if (!content.trim()) {
        return match;
      }
      // 检查是否需要转义（包含 < 或 > 或 &）
      if (content.includes('&lt;') || content.includes('&gt;')) {
        return match;
      }
      if (!content.includes('<') && !content.includes('>') && !content.includes('&')) {
        return match;
      }
      const escaped = escapeMermaidNodeLabel(content);
      return `[${escaped}]`;
    }
  );

  // 3. 匹配带引号的菱形节点标签：{"..."}
  result = result.replace(
    /\{"([^"]*?)"\}/g,
    (match, content) => {
      if (content.includes('&lt;') || content.includes('&gt;')) {
        return match;
      }
      const escaped = escapeMermaidNodeLabel(content);
      return `{"${escaped}"}`;
    }
  );

  // 4. 匹配不带引号的菱形节点标签：{...}
  result = result.replace(
    /\{([^}]*?)\}/g,
    (match, content) => {
      // 排除空内容
      if (!content.trim()) {
        return match;
      }
      // 检查是否需要转义（包含 < 或 > 或 &）
      if (content.includes('&lt;') || content.includes('&gt;')) {
        return match;
      }
      if (!content.includes('<') && !content.includes('>') && !content.includes('&')) {
        return match;
      }
      const escaped = escapeMermaidNodeLabel(content);
      return `{${escaped}}`;
    }
  );

  return result;
}

/**
 * 修复 Mermaid subgraph 标签中的特殊字符
 */
export function fixMermaidSubgraphLabels(code: string): string {
  if (!code || typeof code !== 'string') return code;

  // 匹配 subgraph 标签
  return code.replace(
    /subgraph\s+(\w+)\["([^"]*?)"\]/g,
    (match, id, content) => {
      if (content.includes('&lt;') || content.includes('&gt;')) {
        return match;
      }
      const escaped = escapeMermaidNodeLabel(content);
      return `subgraph ${id}["${escaped}"]`;
    }
  );
}

/**
 * 修复 Mermaid 链接标签中的特殊字符
 * 匹配模式：|"..."| 和 |...|
 */
export function fixMermaidLinkLabels(code: string): string {
  if (!code || typeof code !== 'string') return code;

  let result = code;

  // 匹配带引号的链接标签：|"..."|
  result = result.replace(
    /\|"([^"]*?)"\|/g,
    (match, content) => {
      if (content.includes('&lt;') || content.includes('&gt;')) {
        return match;
      }
      if (!content.includes('<') && !content.includes('>') && !content.includes('&')) {
        return match;
      }
      const escaped = escapeMermaidNodeLabel(content);
      return `|"${escaped}"|`;
    }
  );

  // 匹配不带引号的链接标签：|...|
  // 注意：需要排除箭头语法中的 |，如 -->|
  result = result.replace(
    /\|([^|]+?)\|/g,
    (match, content) => {
      // 排除空内容
      if (!content.trim()) {
        return match;
      }
      // 排除箭头语法中的 |
      if (match.startsWith('>') || match.startsWith('-')) {
        return match;
      }
      // 检查是否需要转义（包含 < 或 > 或 &）
      if (content.includes('&lt;') || content.includes('&gt;')) {
        return match;
      }
      if (!content.includes('<') && !content.includes('>') && !content.includes('&')) {
        return match;
      }
      const escaped = escapeMermaidNodeLabel(content);
      return `|${escaped}|`;
    }
  );

  return result;
}

/**
 * 修复常见的 Mermaid 语法错误
 * 1. 特殊字符转义（节点标签和链接标签）
 * 2. 移除不支持的语法
 * 3. 修复格式问题
 */
export function fixMermaidSyntax(code: string): string {
  if (!code || typeof code !== 'string') return code;

  let result = code;

  // 1. 修复节点标签中的特殊字符
  result = fixMermaidNodeLabels(result);

  // 2. 修复 subgraph 标签中的特殊字符
  result = fixMermaidSubgraphLabels(result);

  // 3. 修复链接标签中的特殊字符
  result = fixMermaidLinkLabels(result);

  // 4. 移除不支持的 style 语法（某些 Mermaid 版本不支持）
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
