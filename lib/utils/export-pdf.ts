/**
 * 使用 jsPDF 将 markdown 导出为 PDF
 * 通过系统字体支持中文等 CJK 字符，文本可选中
 */

import { jsPDF } from 'jspdf';

/** 从服务端 API 获取系统中文字体的 base64 */
async function loadCJKFontBase64(): Promise<{ base64: string; name: string }> {
  const resp = await fetch('/api/system-font');
  if (!resp.ok) throw new Error('未找到系统中文字体，无法导出 PDF');
  const data = await resp.json();
  if (!data.font) throw new Error('未找到系统中文字体，无法导出 PDF');
  return { base64: data.font, name: data.name };
}

// ── Markdown 解析 ──

interface Token {
  type: 'heading' | 'paragraph' | 'code_start' | 'code_line' | 'code_end' | 'list_item' | 'task_item' | 'blockquote' | 'hr' | 'table' | 'image' | 'empty';
  text: string;
  level?: number;
  rows?: string[][];
  aligns?: ('left' | 'center' | 'right')[];
  checked?: boolean;
}

function parseMarkdown(md: string): Token[] {
  const lines = md.split('\n');
  const tokens: Token[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      tokens.push({ type: inCodeBlock ? 'code_end' : 'code_start', text: '' });
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) { tokens.push({ type: 'code_line', text: line }); continue; }

    const trimmed = line.trim();
    if (!trimmed) { tokens.push({ type: 'empty', text: '' }); continue; }

    // 表格检测：当前行以 | 开头且含 |，下一行是分隔行（如 |---|---|）
    if (trimmed.startsWith('|') && trimmed.includes('|', 1) && i + 1 < lines.length) {
      const nextTrimmed = lines[i + 1]?.trim();
      if (nextTrimmed && /^\|[\s\-:]+(\|[\s\-:]+)+\|?$/.test(nextTrimmed)) {
        // 解析表头
        const headerCells = parseTableRow(trimmed);
        // 解析对齐方式
        const aligns = parseTableAligns(nextTrimmed);
        // 解析数据行
        const rows: string[][] = [headerCells];
        i += 2; // 跳过表头和分隔行
        while (i < lines.length) {
          const rowLine = lines[i].trim();
          if (!rowLine || !rowLine.includes('|')) break;
          rows.push(parseTableRow(rowLine));
          i++;
        }
        i--; // for 循环会 +1
        tokens.push({ type: 'table', text: '', rows, aligns });
        continue;
      }
    }

    const hm = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (hm) { tokens.push({ type: 'heading', text: stripInline(hm[2]), level: hm[1].length }); continue; }
    if (/^[-*_]{3,}\s*$/.test(trimmed)) { tokens.push({ type: 'hr', text: '' }); continue; }
    if (trimmed.startsWith('>')) { tokens.push({ type: 'blockquote', text: stripInline(trimmed.replace(/^>\s*/, '')) }); continue; }

    // 独立图片行
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imgMatch) { tokens.push({ type: 'image', text: imgMatch[1] || '图片' }); continue; }

    // 任务列表（在普通列表之前检测）
    const taskMatch = trimmed.match(/^[-*+]\s+\[([ xX])\]\s+(.+)/);
    if (taskMatch) {
      tokens.push({ type: 'task_item', text: stripInline(taskMatch[2]), checked: taskMatch[1] !== ' ' });
      continue;
    }

    // 普通列表
    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      tokens.push({ type: 'list_item', text: stripInline(trimmed.replace(/^[-*+\d.]\s+/, '')) });
      continue;
    }
    tokens.push({ type: 'paragraph', text: stripInline(trimmed) });
  }
  return tokens;
}

/** 解析表格行为单元格数组 */
function parseTableRow(line: string): string[] {
  return line
    .replace(/^\|/, '').replace(/\|$/, '')
    .split('|')
    .map(cell => stripInline(cell.trim()));
}

/** 解析表格分隔行的对齐方式 */
function parseTableAligns(line: string): ('left' | 'center' | 'right')[] {
  return line
    .replace(/^\|/, '').replace(/\|$/, '')
    .split('|')
    .map(cell => {
      const trimmed = cell.trim();
      if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
      if (trimmed.endsWith(':')) return 'right';
      return 'left';
    });
}

function stripInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) => `[图片: ${alt || '图片'}]`) // 图片转占位符
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接保留文字
    .replace(/~~(.+?)~~/g, '$1');
}

// ── PDF 生成 ──

const CJK_FONT_NAME = 'CJKFont';

export async function exportMarkdownToPdf(markdown: string, filename = 'explanation.pdf'): Promise<void> {
  const { base64 } = await loadCJKFontBase64();

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const fontFileName = `${CJK_FONT_NAME}.ttf`;
  doc.addFileToVFS(fontFileName, base64);
  doc.addFont(fontFileName, CJK_FONT_NAME, 'normal');

  const PAGE_W = 210;
  const PAGE_H = 297;
  const margin = { top: 20, bottom: 20, left: 18, right: 18 };
  const contentW = PAGE_W - margin.left - margin.right;
  let y = margin.top;

  const tokens = parseMarkdown(markdown);

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - margin.bottom) {
      doc.addPage();
      y = margin.top;
    }
  };

  const writeCJK = (text: string, fontSize: number, color: [number, number, number] = [28, 25, 23]) => {
    doc.setFont(CJK_FONT_NAME, 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    for (const line of lines) {
      ensureSpace(fontSize * 0.45);
      doc.text(line, margin.left, y);
      y += fontSize * 0.5;
    }
  };

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const sizes = [0, 20, 17, 14, 12, 11, 10];
        ensureSpace(12);
        y += 3;
        writeCJK(token.text, sizes[token.level || 1], [28, 25, 23]);
        y += 2;
        break;
      }
      case 'paragraph':
        writeCJK(token.text, 10.5);
        y += 1.5;
        break;
      case 'code_start':
        y += 2;
        break;
      case 'code_line': {
        const codeSize = 9;
        doc.setFont(CJK_FONT_NAME, 'normal');
        doc.setFontSize(codeSize);
        doc.setTextColor(55, 65, 81);
        const codeLines = doc.splitTextToSize(token.text || ' ', contentW - 6) as string[];
        for (const cl of codeLines) {
          ensureSpace(5);
          doc.setFillColor(243, 244, 246);
          doc.rect(margin.left - 1, y - 3.5, contentW + 2, 5, 'F');
          doc.text(cl, margin.left + 2, y);
          y += 4.5;
        }
        break;
      }
      case 'code_end':
        y += 2;
        break;
      case 'list_item': {
        ensureSpace(6);
        doc.setFont(CJK_FONT_NAME, 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(28, 25, 23);
        doc.text('•', margin.left + 2, y);
        const listLines = doc.splitTextToSize(token.text, contentW - 10) as string[];
        for (const ll of listLines) {
          ensureSpace(5);
          doc.text(ll, margin.left + 7, y);
          y += 5;
        }
        y += 0.5;
        break;
      }
      case 'task_item': {
        ensureSpace(6);
        doc.setFont(CJK_FONT_NAME, 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(28, 25, 23);
        const checkbox = token.checked ? '☑' : '☐';
        doc.text(checkbox, margin.left + 2, y);
        if (token.checked) doc.setTextColor(150, 150, 150);
        const taskLines = doc.splitTextToSize(token.text, contentW - 12) as string[];
        for (const tl of taskLines) {
          ensureSpace(5);
          doc.text(tl, margin.left + 9, y);
          y += 5;
        }
        doc.setTextColor(28, 25, 23);
        y += 0.5;
        break;
      }
      case 'image': {
        ensureSpace(6);
        doc.setFont(CJK_FONT_NAME, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`[图片: ${token.text}]`, margin.left + 2, y);
        y += 5;
        break;
      }
      case 'blockquote': {
        ensureSpace(6);
        doc.setDrawColor(124, 58, 237);
        doc.setLineWidth(0.8);
        doc.line(margin.left, y - 4, margin.left, y + 2);
        writeCJK(token.text, 10, [120, 113, 108]);
        y += 1;
        break;
      }
      case 'hr':
        ensureSpace(4);
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.line(margin.left, y, PAGE_W - margin.right, y);
        y += 4;
        break;
      case 'table': {
        if (!token.rows || token.rows.length === 0) break;
        const rows = token.rows;
        const colCount = Math.max(...rows.map(r => r.length));
        const aligns = token.aligns || [];

        // 计算列宽：按内容最大宽度分配
        doc.setFont(CJK_FONT_NAME, 'normal');
        doc.setFontSize(9.5);
        const colWidths: number[] = new Array(colCount).fill(0);
        for (const row of rows) {
          for (let c = 0; c < colCount; c++) {
            const cellText = row[c] || '';
            const w = doc.getTextWidth(cellText) + 6; // 6mm padding
            colWidths[c] = Math.max(colWidths[c], w);
          }
        }
        // 按比例缩放到可用宽度
        const totalWidth = colWidths.reduce((a, b) => a + b, 0);
        const scale = totalWidth > contentW ? contentW / totalWidth : 1;
        for (let c = 0; c < colCount; c++) colWidths[c] *= scale;

        const cellPad = 2;
        const lineH = 5;

        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          const isHeader = r === 0;

          // 计算本行需要的最大行数（用于换行）
          let maxLines = 1;
          for (let c = 0; c < colCount; c++) {
            const cellText = row[c] || '';
            const wrapped = doc.splitTextToSize(cellText, colWidths[c] - cellPad * 2) as string[];
            maxLines = Math.max(maxLines, wrapped.length);
          }
          const rowH = maxLines * lineH + cellPad * 2;

          ensureSpace(rowH);

          // 表头背景
          if (isHeader) {
            doc.setFillColor(243, 244, 246);
            doc.rect(margin.left, y - cellPad, contentW, rowH, 'F');
          }

          // 绘制单元格
          let x = margin.left;
          for (let c = 0; c < colCount; c++) {
            const cellText = row[c] || '';
            const cellW = colWidths[c];

            // 单元格边框
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.2);
            doc.rect(x, y - cellPad, cellW, rowH, 'S');

            // 单元格文本
            doc.setFont(CJK_FONT_NAME, 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(28, 25, 23);
            const wrapped = doc.splitTextToSize(cellText, cellW - cellPad * 2) as string[];
            const align = aligns[c] || 'left';
            for (let l = 0; l < wrapped.length; l++) {
              const textW = doc.getTextWidth(wrapped[l]);
              let textX = x + cellPad;
              if (align === 'center') textX = x + (cellW - textW) / 2;
              else if (align === 'right') textX = x + cellW - cellPad - textW;
              doc.text(wrapped[l], textX, y + cellPad + l * lineH + 3);
            }

            x += cellW;
          }

          y += rowH;
        }
        y += 3;
        break;
      }
      case 'empty':
        y += 2;
        break;
    }
  }

  doc.save(filename);
}
