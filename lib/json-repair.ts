/**
 * Simple and effective JSON closure repair utilities.
 *
 * Handles common LLM output issues:
 * - Strips Markdown code fences
 * - Extracts the first JSON object/array from mixed text
 * - Closes unbalanced quotes/brackets/braces at the end
 * - Inserts missing '{' for array-of-object cases: ["k":1] -> [{"k":1}]
 * - Trims trailing comma before auto-appended closers
 * - Falls back to jsonrepair (npm) if parsing still fails
 */

// Optional robust repair library (loaded lazily to avoid bundler resolution)
let jsonRepairLib: ((input: string) => string) | null = null;
try {
  // Use eval to avoid static resolution by bundlers
  const req = (0, eval)('require');
  const mod = req?.('jsonrepair');
  jsonRepairLib = mod?.jsonrepair || mod?.default || null;
} catch (_) {
  // not installed; proceed without it
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
    if (jsonRepairLib) {
      try { out = jsonRepairLib(out); } catch (_) { /* ignore */ }
    }
  }

  return out;
}

/**
 * Extract the first balanced JSON array substring from mixed text.
 * Handles strings containing ']' characters correctly by tracking bracket depth
 * inside JSON string literals. Returns null if no balanced array is found.
 */
export function extractFirstJsonArray(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const source = stripCodeFences(text);

  const start = source.indexOf('[');
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
        return source.slice(start, i + 1);
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
