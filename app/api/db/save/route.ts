import { NextResponse } from 'next/server';
import { saveToDisk, hasUnsavedChanges } from '@/lib/db/index';

/**
 * POST /api/db/save
 * 触发数据库持久化到磁盘
 * 用于页面卸载前确保数据已保存
 */
export async function POST() {
  try {
    if (hasUnsavedChanges()) {
      await saveToDisk();
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] 保存数据库失败:', error);
    return NextResponse.json(
      { error: '保存失败' },
      { status: 500 },
    );
  }
}
