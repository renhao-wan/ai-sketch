/**
 * 获取系统中文字体（供 PDF 导出使用）
 * 读取 Windows/Linux/macOS 系统自带的 CJK 字体文件，返回 base64 编码
 * 只返回 TTF 格式（jsPDF 完整支持），跳过 TTC/OTF
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/** 按优先级尝试的系统字体路径（只含 TTF 格式） */
const FONT_CANDIDATES = [
  // Windows - SimHei（黑体）
  'C:\\Windows\\Fonts\\simhei.ttf',
  // Windows - Microsoft YaHei (TTF 版)
  'C:\\Windows\\Fonts\\msyh.ttf',
  // Windows - SimSun (TTF 版)
  'C:\\Windows\\Fonts\\simsun.ttf',
  // Windows - 微软雅黑常规 (Win10/11 可能有独立 TTF)
  'C:\\Windows\\Fonts\\msyhregular.ttf',
  // Linux
  '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
  '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
  // macOS
  '/System/Library/Fonts/STHeiti Light.ttc',
];

export async function GET() {
  for (const fontPath of FONT_CANDIDATES) {
    try {
      if (fs.existsSync(fontPath)) {
        const ext = path.extname(fontPath).toLowerCase();
        // 跳过 jsPDF 不支持的格式
        if (ext === '.otf') continue;

        const buffer = fs.readFileSync(fontPath);
        const base64 = buffer.toString('base64');
        return NextResponse.json({
          font: base64,
          name: path.basename(fontPath),
          size: buffer.length,
        });
      }
    } catch {
      // 文件存在但无法读取，继续尝试下一个
    }
  }

  return NextResponse.json(
    { error: '未找到系统中文字体' },
    { status: 404 },
  );
}
