/**
 * Simple and effective JSON closure repair utilities.
 *
 * Handles common LLM output issues:
 * - Strips Markdown code fences
 * - Extracts the first JSON object/array from mixed text
 * - Closes unbalanced quotes/brackets/braces at the end
 * - Inserts missing '{' for array-of-object cases: ["k":1] -> [{"k":1}]
 * - Trims trailing comma before auto-appended closers
 * - Fixes unquoted JSON keys (e.g., `y: 450` -> `"y": 450`)
 * - Falls back to jsonrepair (npm) if parsing still fails
 */

// Optional robust repair library (loaded lazily via dynamic import)
let jsonRepairLib: ((input: string) => string) | null = null;
let jsonRepairLoadAttempted = false;

/** 延迟加载 jsonrepair 库 */
async function loadJsonRepair(): Promise<((input: string) => string) | null> {
  if (jsonRepairLoadAttempted) return jsonRepairLib;
  jsonRepairLoadAttempted = true;

  try {
    // 使用动态 import 加载可选依赖
    // 已在 next.config.mjs 的 serverExternalPackages 中配置
    const mod = await import('jsonrepair');
    jsonRepairLib = (mod.jsonrepair || (mod as Record<string, unknown>).default || null) as ((input: string) => string) | null;
  } catch {
    // not installed; proceed without it
    jsonRepairLib = null;
  }
  return jsonRepairLib;
}

/**
 * Remove leading/trailing Markdown code fences.
 */
export function stripCodeFences(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let s = text.trim();
  s = s.replace(/^```(?:json|javascript|js|mermaid|xml|html|markdown|md)?\s*\n?/i, '');
  s = s.replace(/\n?```\s*$/i, '');
  return s.trim();
}

/**
 * Fix unquoted JSON keys.
 * Converts patterns like `y: 450` or `id: "value"` to `"y": 450` or `"id": "value"`.
 * Handles keys that are valid JavaScript identifiers (letters, digits, underscores, $).
 */
export function fixUnquotedKeys(json: string): string {
  if (!json || typeof json !== 'string') return json;

  let result = '';
  let inString = false;
  let escape = false;
  let i = 0;

  while (i < json.length) {
    const ch = json[i];

    // Handle string content
    if (inString) {
      result += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    // Start of string
    if (ch === '"') {
      result += ch;
      inString = true;
      i++;
      continue;
    }

    // Check for unquoted key pattern
    if (ch === '{' || ch === ',') {
      result += ch;
      i++;

      // Skip whitespace after { or ,
      let ws = '';
      while (i < json.length && /\s/.test(json[i])) {
        ws += json[i];
        i++;
      }

      // Check if we have an unquoted identifier followed by :
      if (i < json.length && /[_A-Za-z$]/.test(json[i])) {
        let key = '';
        while (i < json.length && /[_A-Za-z0-9$]/.test(json[i])) {
          key += json[i];
          i++;
        }

        // Skip whitespace after potential key
        let wsAfterKey = '';
        while (i < json.length && /\s/.test(json[i])) {
          wsAfterKey += json[i];
          i++;
        }

        // Check if followed by colon
        if (i < json.length && json[i] === ':') {
          result += ws + '"' + key + '"' + wsAfterKey;
        } else {
          result += ws + key + wsAfterKey;
        }
      } else {
        result += ws;
      }
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * Fix comma used instead of colon for key-value pairs.
 * Converts patterns like `"id", "login-error"` to `"id": "login-error"`.
 * This is a common LLM error where comma is used instead of colon.
 */
export function fixCommaInsteadOfColon(json: string): string {
  if (!json || typeof json !== 'string') return json;

  // Pattern: `"key", "value"` should be `"key": "value"`
  // Also handles: `"key", 123` should be `"key": 123`
  // And: `"key", true/false/null` should be `"key": true/false/null`

  // This regex matches:
  // 1. A closing double quote
  // 2. Optional whitespace
  // 3. A comma
  // 4. Optional whitespace
  // 5. Either a quote (for string value), digit (for number), or true/false/null (for boolean/null)
  return json.replace(
    /"(?:[^"\\]|\\.)*"\s*,\s*(?="(?:[^"\\]|\\.)*"|[0-9]|true|false|null)/g,
    (match) => {
      // Replace the comma with a colon
      return match.replace(/,/, ':');
    }
  );
}

/**
 * Fix colon used instead of comma to separate key-value pairs.
 * Converts patterns like `"type": "rectangle": "id": "start"` to `"type": "rectangle", "id": "start"`.
 * This is a common LLM error where colon is used instead of comma between key-value pairs.
 */
export function fixColonInsteadOfComma(json: string): string {
  if (!json || typeof json !== 'string') return json;

  let result = '';
  let inString = false;
  let escape = false;
  let i = 0;

  while (i < json.length) {
    const ch = json[i];

    // Handle string content
    if (inString) {
      result += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    // Start of string
    if (ch === '"') {
      result += ch;
      inString = true;
      i++;
      continue;
    }

    // Check for pattern: "value" : "key" :
    if (ch === ':') {
      // Look back to see if we just finished a value
      let j = result.length - 1;
      while (j >= 0 && /\s/.test(result[j])) j--;

      // Check if the previous token was a closing quote, number, boolean, null, }, or ]
      const prevChar = j >= 0 ? result[j] : '';
      const isPrevValue = prevChar === '"' || /[0-9truefalsenull}\\\]]/.test(prevChar);

      // Look ahead to see if the next token is a key (starts with ")
      let k = i + 1;
      while (k < json.length && /\s/.test(json[k])) k++;
      const nextChar = k < json.length ? json[k] : '';
      const isNextKey = nextChar === '"';

      // If previous was a value and next is a key, this colon should be a comma
      if (isPrevValue && isNextKey) {
        // Check if this looks like a key-value separator
        // by seeing if there's another colon after the next key
        let tempK = k + 1;
        // Skip the key string
        while (tempK < json.length && json[tempK] !== '"') {
          if (json[tempK] === '\\') tempK++; // Skip escaped chars
          tempK++;
        }
        tempK++; // Skip closing quote
        while (tempK < json.length && /\s/.test(json[tempK])) tempK++;

        // If there's a colon after the key, then this colon should be a comma
        if (tempK < json.length && json[tempK] === ':') {
          result += ',';
          i++;
          continue;
        }
      }
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * Fix trailing commas in JSON arrays and objects.
 * Converts `[1, 2, 3,]` to `[1, 2, 3]` and `{"a": 1,}` to `{"a": 1}`.
 */
export function fixTrailingCommas(json: string): string {
  if (!json || typeof json !== 'string') return json;

  // Match trailing comma followed by optional whitespace and closing bracket/brace
  return json.replace(/,\s*([}\]])/g, '$1');
}

/**
 * Replace single quotes with double quotes in JSON.
 * Handles common LLM output where single quotes are used instead of double quotes.
 * Preserves single quotes inside double-quoted strings.
 */
export function fixSingleQuotes(json: string): string {
  if (!json || typeof json !== 'string') return json;

  let result = '';
  let inDoubleString = false;
  let inSingleString = false;
  let escape = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];

    if (escape) {
      result += ch;
      escape = false;
      continue;
    }

    if (ch === '\\') {
      result += ch;
      escape = true;
      continue;
    }

    // Inside double-quoted string - preserve as is
    if (inDoubleString) {
      result += ch;
      if (ch === '"') inDoubleString = false;
      continue;
    }

    // Inside single-quoted string
    if (inSingleString) {
      if (ch === "'") {
        // End of single-quoted string - convert to double quote
        result += '"';
        inSingleString = false;
      } else if (ch === '"') {
        // Escape double quotes inside single-quoted string
        result += '\\"';
      } else {
        result += ch;
      }
      continue;
    }

    // Start of double-quoted string
    if (ch === '"') {
      result += ch;
      inDoubleString = true;
      continue;
    }

    // Start of single-quoted string - convert to double quote
    if (ch === "'") {
      result += '"';
      inSingleString = true;
      continue;
    }

    result += ch;
  }

  return result;
}

/**
 * Remove single-line comments from JSON.
 * Removes `// ...` comments that are not inside strings.
 * Note: JSON does not support comments, but LLMs sometimes add them.
 */
export function removeJsonComments(json: string): string {
  if (!json || typeof json !== 'string') return json;

  let result = '';
  let inString = false;
  let escape = false;
  let i = 0;

  while (i < json.length) {
    const ch = json[i];

    // Handle string content
    if (inString) {
      result += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    // Start of string
    if (ch === '"') {
      result += ch;
      inString = true;
      i++;
      continue;
    }

    // Check for single-line comment
    if (ch === '/' && i + 1 < json.length && json[i + 1] === '/') {
      // Skip until end of line
      while (i < json.length && json[i] !== '\n') {
        i++;
      }
      continue;
    }

    // Check for multi-line comment
    if (ch === '/' && i + 1 < json.length && json[i + 1] === '*') {
      i += 2; // Skip /*
      while (i < json.length - 1 && !(json[i] === '*' && json[i + 1] === '/')) {
        i++;
      }
      i += 2; // Skip */
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * Replace NaN, Infinity, -Infinity, undefined with null.
 * These are valid JavaScript values but not valid JSON.
 */
export function fixSpecialValues(json: string): string {
  if (!json || typeof json !== 'string') return json;

  // Replace NaN, Infinity, -Infinity, undefined with null
  // Use word boundary to avoid matching inside strings
  let result = '';
  let inString = false;
  let escape = false;
  let i = 0;

  while (i < json.length) {
    const ch = json[i];

    // Handle string content
    if (inString) {
      result += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    // Start of string
    if (ch === '"') {
      result += ch;
      inString = true;
      i++;
      continue;
    }

    // Check for special values
    const remaining = json.slice(i);

    // Match NaN
    if (remaining.startsWith('NaN') && (i + 3 >= json.length || !/[_A-Za-z0-9$]/.test(json[i + 3]))) {
      result += 'null';
      i += 3;
      continue;
    }

    // Match Infinity
    if (remaining.startsWith('Infinity') && (i + 8 >= json.length || !/[_A-Za-z0-9$]/.test(json[i + 8]))) {
      result += 'null';
      i += 8;
      continue;
    }

    // Match -Infinity
    if (remaining.startsWith('-Infinity') && (i + 9 >= json.length || !/[_A-Za-z0-9$]/.test(json[i + 9]))) {
      result += 'null';
      i += 9;
      continue;
    }

    // Match undefined
    if (remaining.startsWith('undefined') && (i + 9 >= json.length || !/[_A-Za-z0-9$]/.test(json[i + 9]))) {
      result += 'null';
      i += 9;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

function trimTrailingComma(out: string): string {
  let i = out.length - 1;
  // skip whitespace
  while (i >= 0 && /\s/.test(out[i])) i--;
  if (i >= 0 && out[i] === ',') {
    return out.slice(0, i) + out.slice(i + 1);
  }
  return out;
}

/**
 * Extracts the first JSON block (object or array) and repairs unclosed parts.
 * Returns the repaired JSON substring. If no JSON-like content found, returns original.
 *
 * This function is designed to be conservative: it only appends missing
 * quotes/brackets/braces and removes a trailing comma if present.
 */
export function repairJsonClosure(input: string): string {
  if (!input || typeof input !== 'string') return input;

  const source = stripCodeFences(input);
  let start = -1;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '{' || c === '[') { start = i; break; }
  }
  if (start === -1) return source; // no obvious JSON start

  let inString = false;
  let escape = false;
  const stack: string[] = [];
  let out = '';
  let insertedObjectAfterArrayStart = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    out += ch;

    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = false; continue; }
      continue;
    }

    if (ch === '"') { inString = true; continue; }
    if (ch === '{') { stack.push('}'); continue; }
    if (ch === '[') {
      stack.push(']');
      // Heuristic: if after '[' we see a property-like token ("key": ...)
      // before a comma or ']', assume missing '{' and insert it.
      if (!insertedObjectAfterArrayStart) {
        const nextIdx = findNextNonWsIndex(source, i + 1);
        if (nextIdx !== -1) {
          if (looksLikeMissingObjectAfterArray(source, nextIdx)) {
            out += '{';
            stack.push('}');
            insertedObjectAfterArrayStart = true;
          }
        }
      }
      continue;
    }
    if (ch === '}' || ch === ']') {
      // Close only if matches top
      if (stack.length && stack[stack.length - 1] === ch) {
        stack.pop();
      }
      // If we've closed the root (stack empty), stop collecting
      if (stack.length === 0) {
        // Cut here to avoid trailing commentary
        break;
      }
    }
  }

  // If still inside a string, close it
  if (inString) {
    out += '"';
    inString = false;
  }

  // Remove a trailing comma before appending closers
  out = trimTrailingComma(out);

  // Append any missing closers
  while (stack.length) out += stack.pop()!;

  // If still not parseable, try robust repair if available
  try {
    JSON.parse(out);
  } catch (_) {
    // 同步尝试已加载的库
    if (jsonRepairLib) {
      try { out = jsonRepairLib(out); } catch (_) { /* ignore */ }
    }
  }

  return out;
}

/**
 * 异步版本的 JSON 修复（会尝试加载 jsonrepair 库）
 * 适用于非关键路径，可以等待异步加载
 */
export async function repairJsonClosureAsync(input: string): Promise<string> {
  const repaired = repairJsonClosure(input);

  // 如果已经能解析，直接返回
  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    // 继续尝试加载 jsonrepair
  }

  // 尝试加载 jsonrepair 库
  const lib = await loadJsonRepair();
  if (lib) {
    try {
      return lib(repaired);
    } catch {
      // ignore
    }
  }

  return repaired;
}

/**
 * Extract the first balanced JSON array substring from mixed text.
 * Handles strings containing ']' characters correctly by tracking bracket depth
 * inside JSON string literals. Tries each '[' occurrence until one yields valid JSON.
 * Returns null if no balanced array is found.
 */
export function extractFirstJsonArray(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const source = stripCodeFences(text);

  let searchFrom = 0;
  while (searchFrom < source.length) {
    const start = source.indexOf('[', searchFrom);
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < source.length; i++) {
      const ch = source[i];

      if (inString) {
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = false; }
        continue;
      }

      if (ch === '"') { inString = true; continue; }
      if (ch === '[') { depth++; continue; }
      if (ch === ']') {
        depth--;
        if (depth === 0) {
          const candidate = source.slice(start, i + 1);
          try { JSON.parse(candidate); return candidate; } catch { break; }
        }
      }
    }
    searchFrom = start + 1;
  }

  return null;
}

/**
 * Extract complete JSON objects from a partial streaming buffer.
 * Scans for `{...}` blocks at array level (depth 0→1→0), attempts JSON.parse,
 * and returns successfully parsed elements plus the consumed character offset.
 *
 * @param buffer - The accumulated raw string (after stripCodeFences)
 * @param startFrom - Character offset to resume scanning from (avoids re-parsing)
 */
export function extractCompleteElements(buffer: string, startFrom = 0): { elements: unknown[]; consumed: number } {
  if (!buffer || typeof buffer !== 'string') return { elements: [], consumed: startFrom };

  const elements: unknown[] = [];
  let i = startFrom;

  // Skip to the opening [ (only on first call)
  if (i === 0) {
    const bracket = buffer.indexOf('[');
    if (bracket === -1) return { elements: [], consumed: 0 };
    i = bracket + 1;
  }

  while (i < buffer.length) {
    // Skip whitespace and commas between elements
    while (i < buffer.length && /[\s,]/.test(buffer[i])) i++;
    if (i >= buffer.length || buffer[i] !== '{') break;

    // Track brace depth to find the matching }
    let depth = 0;
    let inString = false;
    let escape = false;
    const start = i;

    for (; i < buffer.length; i++) {
      const ch = buffer[i];
      if (inString) {
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = false; }
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') { depth++; continue; }
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = buffer.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            elements.push(parsed);
          } catch {
            // Malformed object — skip it
          }
          i++; // move past the closing }
          break;
        }
      }
    }
  }

  return { elements, consumed: i };
}

/**
 * 使用括号平衡匹配从混合文本中提取第一个完整的 JSON 对象。
 * 与 planner.ts / critic.ts 中的简化版不同，此实现追踪字符串状态，
 * 正确处理字符串值中包含的 `{` 或 `}` 字符。
 *
 * @returns 提取到的 JSON 字符串，未找到则返回 null
 */
export function extractFirstJsonObject(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const startIdx = text.indexOf('{');
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = false; }
      continue;
    }

    if (ch === '"') { inString = true; continue; }
    if (ch === '{') { depth++; continue; }
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(startIdx, i + 1);
      }
    }
  }

  return null;
}

// Helpers
function findNextNonWsIndex(str: string, from: number): number {
  for (let i = from; i < str.length; i++) {
    if (!/\s/.test(str[i])) return i;
  }
  return -1;
}

function looksLikeMissingObjectAfterArray(str: string, from: number): boolean {
  // true if we encounter a pattern like "key" : before ',' or ']'
  let inString = false;
  let escape = false;
  for (let i = from; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = false; continue; }
      continue;
    }
    if (/\s/.test(ch)) continue;
    if (ch === ']') return false;
    if (ch === '{') return false;
    if (ch === ',') return false;
    if (ch === '"') {
      return hasColonBeforeCommaOrBracket(str, i + 1);
    }
    // if we see an unquoted identifier, likely an object key (invalid JSON)
    if (/[_A-Za-z]/.test(ch)) return true;
    return false;
  }
  return false;
}

function hasColonBeforeCommaOrBracket(str: string, from: number): boolean {
  let inString = false;
  let escape = false;
  for (let i = from; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = false; continue; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === ':') return true;
    if (ch === ',' || ch === ']') return false;
  }
  return false;
}
