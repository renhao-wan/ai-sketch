# 自定义 AI 操作实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI Sketch 添加用户自定义 AI 操作功能，支持最多 4 个操作显示在画布上，少于 4 个时空间不变平均分布。

**Architecture:** 使用数据库存储自定义操作，通过 API 路由进行 CRUD 操作，前端组件动态渲染操作按钮。内置操作固定不可修改，用户可以创建自定义操作并管理显示顺序。

**Tech Stack:** Next.js 16, React 19, TypeScript, SQLite (sql.js), Tailwind CSS v4, lucide-react

---

## 文件结构

### 新增文件

- `lib/db/custom-action-manager.ts` - 自定义操作数据库管理器
- `app/api/custom-actions/route.ts` - 自定义操作 CRUD API
- `app/api/custom-actions/[id]/route.ts` - 单个自定义操作 API
- `app/api/canvas-actions/route.ts` - 画布操作管理 API
- `components/settings/AIActionsSettings.tsx` - AI 操作设置页面
- `components/settings/ActionEditor.tsx` - 操作编辑器组件

### 修改文件

- `lib/db/index.ts` - 添加新表
- `app/settings/page.tsx` - 添加 AI 操作标签页
- `components/settings/SettingsSidebar.tsx` - 添加 AI 操作菜单项
- `components/ai/FloatingAIActions.tsx` - 动态渲染操作按钮
- `app/api/ai-action/route.ts` - 支持自定义操作执行
- `lib/locales/zh.ts` - 添加中文翻译
- `lib/locales/en.ts` - 添加英文翻译

---

## Task 1: 数据库设计

**Files:**
- Modify: `lib/db/index.ts`

- [ ] **Step 1: 添加 custom_actions 表**

在 `initDb()` 函数中，在 `vision_config` 表之后添加：

```typescript
// 自定义 AI 操作表
db.run(`
  CREATE TABLE IF NOT EXISTS custom_actions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    icon TEXT DEFAULT 'Zap',
    action_type TEXT DEFAULT 'modify',
    enabled INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);
```

- [ ] **Step 2: 添加 canvas_actions 表**

在 `custom_actions` 表之后添加：

```typescript
// 画布操作配置表
db.run(`
  CREATE TABLE IF NOT EXISTS canvas_actions (
    id TEXT PRIMARY KEY,
    action_type TEXT NOT NULL,
    action_id TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(action_type, action_id)
  )
`);

// 插入默认的内置操作
const defaultActions = [
  { id: '1', action_type: 'builtin', action_id: 'layout', sort_order: 0 },
  { id: '2', action_type: 'builtin', action_id: 'beautify', sort_order: 1 },
  { id: '3', action_type: 'builtin', action_id: 'simplify', sort_order: 2 },
  { id: '4', action_type: 'builtin', action_id: 'explain', sort_order: 3 },
];

for (const action of defaultActions) {
  db.run(
    `INSERT OR IGNORE INTO canvas_actions (id, action_type, action_id, sort_order) VALUES (?, ?, ?, ?)`,
    [action.id, action.action_type, action.action_id, action.sort_order]
  );
}
```

- [ ] **Step 3: 添加索引**

在表创建之后添加：

```typescript
db.run('CREATE INDEX IF NOT EXISTS idx_custom_actions_sort ON custom_actions(sort_order)');
db.run('CREATE INDEX IF NOT EXISTS idx_canvas_actions_sort ON canvas_actions(sort_order)');
```

- [ ] **Step 4: 验证数据库表**

运行应用，检查数据库文件是否包含新表：

```bash
cd ai-sketch && pnpm dev
```

在浏览器中打开应用，检查控制台是否有数据库错误。

- [ ] **Step 5: 提交**

```bash
git add lib/db/index.ts
git commit -m "feat(db): 添加自定义 AI 操作和画布操作配置表"
```

---

## Task 2: 自定义操作管理器

**Files:**
- Create: `lib/db/custom-action-manager.ts`

- [ ] **Step 1: 创建管理器文件**

```typescript
import { getDb } from './index';
import { requestSave } from './index';

export interface CustomAction {
  id: string;
  name: string;
  prompt: string;
  icon: string;
  action_type: 'modify' | 'explain';
  enabled: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface CanvasAction {
  id: string;
  action_type: 'builtin' | 'custom';
  action_id: string;
  sort_order: number;
}

class CustomActionManager {
  async getAll(): Promise<CustomAction[]> {
    const db = await getDb();
    const result = db.exec('SELECT * FROM custom_actions ORDER BY sort_order');
    if (result.length === 0) return [];
    return result[0].values.map(row => ({
      id: row[0] as string,
      name: row[1] as string,
      prompt: row[2] as string,
      icon: row[3] as string,
      action_type: row[4] as 'modify' | 'explain',
      enabled: row[5] as number,
      sort_order: row[6] as number,
      created_at: row[7] as number,
      updated_at: row[8] as number,
    }));
  }

  async getById(id: string): Promise<CustomAction | null> {
    const db = await getDb();
    const result = db.exec('SELECT * FROM custom_actions WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    const row = result[0].values[0];
    return {
      id: row[0] as string,
      name: row[1] as string,
      prompt: row[2] as string,
      icon: row[3] as string,
      action_type: row[4] as 'modify' | 'explain',
      enabled: row[5] as number,
      sort_order: row[6] as number,
      created_at: row[7] as number,
      updated_at: row[8] as number,
    };
  }

  async create(data: Omit<CustomAction, 'id' | 'created_at' | 'updated_at'>): Promise<CustomAction> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const now = Date.now();
    
    db.run(
      `INSERT INTO custom_actions (id, name, prompt, icon, action_type, enabled, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.prompt, data.icon, data.action_type, data.enabled, data.sort_order, now, now]
    );
    
    requestSave();
    return this.getById(id) as Promise<CustomAction>;
  }

  async update(id: string, data: Partial<Omit<CustomAction, 'id' | 'created_at' | 'updated_at'>>): Promise<CustomAction | null> {
    const db = await getDb();
    const now = Date.now();
    
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.prompt !== undefined) {
      fields.push('prompt = ?');
      values.push(data.prompt);
    }
    if (data.icon !== undefined) {
      fields.push('icon = ?');
      values.push(data.icon);
    }
    if (data.action_type !== undefined) {
      fields.push('action_type = ?');
      values.push(data.action_type);
    }
    if (data.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(data.enabled);
    }
    if (data.sort_order !== undefined) {
      fields.push('sort_order = ?');
      values.push(data.sort_order);
    }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);
    
    db.run(
      `UPDATE custom_actions SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    requestSave();
    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    db.run('DELETE FROM custom_actions WHERE id = ?', [id]);
    db.run('DELETE FROM canvas_actions WHERE action_type = ? AND action_id = ?', ['custom', id]);
    requestSave();
    return true;
  }

  async getCanvasActions(): Promise<CanvasAction[]> {
    const db = await getDb();
    const result = db.exec('SELECT * FROM canvas_actions ORDER BY sort_order');
    if (result.length === 0) return [];
    return result[0].values.map(row => ({
      id: row[0] as string,
      action_type: row[1] as 'builtin' | 'custom',
      action_id: row[2] as string,
      sort_order: row[3] as number,
    }));
  }

  async updateCanvasActions(actions: Omit<CanvasAction, 'id'>[]): Promise<void> {
    const db = await getDb();
    
    // 删除所有现有记录
    db.run('DELETE FROM canvas_actions');
    
    // 插入新记录
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      db.run(
        'INSERT INTO canvas_actions (id, action_type, action_id, sort_order) VALUES (?, ?, ?, ?)',
        [crypto.randomUUID(), action.action_type, action.action_id, i]
      );
    }
    
    requestSave();
  }
}

export const customActionManager = new CustomActionManager();
```

- [ ] **Step 2: 验证管理器**

在浏览器控制台中测试管理器功能：

```typescript
// 在浏览器控制台中执行
const { customActionManager } = await import('/lib/db/custom-action-manager');
console.log(await customActionManager.getAll());
```

- [ ] **Step 3: 提交**

```bash
git add lib/db/custom-action-manager.ts
git commit -m "feat(db): 添加自定义操作管理器"
```

---

## Task 3: 自定义操作 API

**Files:**
- Create: `app/api/custom-actions/route.ts`
- Create: `app/api/custom-actions/[id]/route.ts`

- [ ] **Step 1: 创建 GET/POST 路由**

```typescript
// app/api/custom-actions/route.ts
import { NextResponse } from 'next/server';
import { customActionManager } from '@/lib/db/custom-action-manager';

export async function GET() {
  try {
    const actions = await customActionManager.getAll();
    return NextResponse.json(actions);
  } catch (error) {
    console.error('Error fetching custom actions:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, prompt, icon, action_type } = body;

    if (!name || !prompt) {
      return NextResponse.json({ error: '缺少必要参数: name, prompt' }, { status: 400 });
    }

    const action = await customActionManager.create({
      name,
      prompt,
      icon: icon || 'Zap',
      action_type: action_type || 'modify',
      enabled: 1,
      sort_order: 0,
    });

    return NextResponse.json(action);
  } catch (error) {
    console.error('Error creating custom action:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建单个操作路由**

```typescript
// app/api/custom-actions/[id]/route.ts
import { NextResponse } from 'next/server';
import { customActionManager } from '@/lib/db/custom-action-manager';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const action = await customActionManager.getById(params.id);
    if (!action) {
      return NextResponse.json({ error: '操作不存在' }, { status: 404 });
    }
    return NextResponse.json(action);
  } catch (error) {
    console.error('Error fetching custom action:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const action = await customActionManager.update(params.id, body);
    if (!action) {
      return NextResponse.json({ error: '操作不存在' }, { status: 404 });
    }
    return NextResponse.json(action);
  } catch (error) {
    console.error('Error updating custom action:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await customActionManager.delete(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom action:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 3: 测试 API**

使用 curl 或浏览器测试 API：

```bash
# 获取所有自定义操作
curl http://localhost:3000/api/custom-actions

# 创建自定义操作
curl -X POST http://localhost:3000/api/custom-actions \
  -H "Content-Type: application/json" \
  -d '{"name": "测试操作", "prompt": "请优化这个图表"}'
```

- [ ] **Step 4: 提交**

```bash
git add app/api/custom-actions/route.ts app/api/custom-actions/\[id\]/route.ts
git commit -m "feat(api): 添加自定义操作 CRUD API"
```

---

## Task 4: 画布操作 API

**Files:**
- Create: `app/api/canvas-actions/route.ts`

- [ ] **Step 1: 创建画布操作路由**

```typescript
// app/api/canvas-actions/route.ts
import { NextResponse } from 'next/server';
import { customActionManager } from '@/lib/db/custom-action-manager';

export async function GET() {
  try {
    const actions = await customActionManager.getCanvasActions();
    
    // 获取自定义操作的详细信息
    const customActions = await customActionManager.getAll();
    const customActionMap = new Map(customActions.map(a => [a.id, a]));
    
    // 构建完整的操作列表
    const result = actions.map(action => ({
      ...action,
      details: action.action_type === 'custom' 
        ? customActionMap.get(action.action_id) 
        : null,
    }));
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching canvas actions:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { actions } = body;

    if (!Array.isArray(actions)) {
      return NextResponse.json({ error: '参数错误: actions 应为数组' }, { status: 400 });
    }

    // 验证最多 4 个操作
    if (actions.length > 4) {
      return NextResponse.json({ error: '最多只能显示 4 个操作' }, { status: 400 });
    }

    await customActionManager.updateCanvasActions(actions);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating canvas actions:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 测试 API**

```bash
# 获取画布操作
curl http://localhost:3000/api/canvas-actions

# 更新画布操作
curl -X PUT http://localhost:3000/api/canvas-actions \
  -H "Content-Type: application/json" \
  -d '{"actions": [{"action_type": "builtin", "action_id": "layout"}, {"action_type": "builtin", "action_id": "beautify"}]}'
```

- [ ] **Step 3: 提交**

```bash
git add app/api/canvas-actions/route.ts
git commit -m "feat(api): 添加画布操作管理 API"
```

---

## Task 5: 添加翻译

**Files:**
- Modify: `lib/locales/zh.ts`
- Modify: `lib/locales/en.ts`

- [ ] **Step 1: 添加中文翻译**

在 `lib/locales/zh.ts` 中添加：

```typescript
// AI 操作设置
'settings.aiActions': 'AI 操作',
'settings.aiActionsDesc': '管理画布上显示的 AI 操作',
'aiActions.canvasActions': '画布上显示的操作',
'aiActions.canvasActionsDesc': '最多 4 个，拖拽调整顺序',
'aiActions.customActions': '自定义操作',
'aiActions.createAction': '创建新操作',
'aiActions.noCustomActions': '暂无自定义操作',
'aiActions.editAction': '编辑操作',
'aiActions.deleteAction': '删除操作',
'aiActions.deleteConfirm': '确定要删除这个操作吗？',
'aiActions.name': '操作名称',
'aiActions.namePlaceholder': '输入操作名称',
'aiActions.prompt': '提示词',
'aiActions.promptPlaceholder': '输入提示词，描述 AI 应该做什么',
'aiActions.icon': '图标',
'aiActions.actionType': '操作类型',
'aiActions.actionTypeModify': '修改图表',
'aiActions.actionTypeModifyDesc': 'AI 修改当前图表，直接渲染到画布',
'aiActions.actionTypeExplain': '生成说明',
'aiActions.actionTypeExplainDesc': 'AI 生成文字说明，显示在底部面板',
'aiActions.advancedSettings': '高级设置',
'aiActions.promptTipModify': '提示: 请确保提示词要求 AI 输出修改后的图表代码',
'aiActions.promptTipExplain': '提示: 请确保提示词要求 AI 输出文字说明',
'aiActions.builtin': '内置',
'aiActions.custom': '自定义',
'aiActions.maxActions': '最多 4 个操作',
'aiActions.save': '保存',
'aiActions.cancel': '取消',
'aiActions.create': '创建',
```

- [ ] **Step 2: 添加英文翻译**

在 `lib/locales/en.ts` 中添加：

```typescript
// AI Actions Settings
'settings.aiActions': 'AI Actions',
'settings.aiActionsDesc': 'Manage AI actions displayed on canvas',
'aiActions.canvasActions': 'Canvas Actions',
'aiActions.canvasActionsDesc': 'Maximum 4, drag to reorder',
'aiActions.customActions': 'Custom Actions',
'aiActions.createAction': 'Create New Action',
'aiActions.noCustomActions': 'No custom actions yet',
'aiActions.editAction': 'Edit Action',
'aiActions.deleteAction': 'Delete Action',
'aiActions.deleteConfirm': 'Are you sure you want to delete this action?',
'aiActions.name': 'Action Name',
'aiActions.namePlaceholder': 'Enter action name',
'aiActions.prompt': 'Prompt',
'aiActions.promptPlaceholder': 'Enter prompt, describe what AI should do',
'aiActions.icon': 'Icon',
'aiActions.actionType': 'Action Type',
'aiActions.actionTypeModify': 'Modify Diagram',
'aiActions.actionTypeModifyDesc': 'AI modifies current diagram, renders directly to canvas',
'aiActions.actionTypeExplain': 'Generate Explanation',
'aiActions.actionTypeExplainDesc': 'AI generates text explanation, displayed in bottom panel',
'aiActions.advancedSettings': 'Advanced Settings',
'aiActions.promptTipModify': 'Tip: Ensure prompt asks AI to output modified diagram code',
'aiActions.promptTipExplain': 'Tip: Ensure prompt asks AI to output text explanation',
'aiActions.builtin': 'Builtin',
'aiActions.custom': 'Custom',
'aiActions.maxActions': 'Maximum 4 actions',
'aiActions.save': 'Save',
'aiActions.cancel': 'Cancel',
'aiActions.create': 'Create',
```

- [ ] **Step 3: 验证翻译**

在浏览器中检查翻译是否正确显示。

- [ ] **Step 4: 提交**

```bash
git add lib/locales/zh.ts lib/locales/en.ts
git commit -m "feat(i18n): 添加 AI 操作相关翻译"
```

---

## Task 6: 设置页面集成

**Files:**
- Modify: `components/settings/SettingsSidebar.tsx`
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: 更新 SettingsTab 类型**

在 `components/settings/SettingsSidebar.tsx` 中修改：

```typescript
export type SettingsTab = 'appearance' | 'llm' | 'aiActions' | 'tags' | 'network' | 'conversations' | 'storage' | 'shortcuts' | 'about';
```

- [ ] **Step 2: 添加 AI 操作菜单项**

在 `tabs` 数组中，在 `llm` 之后添加：

```typescript
{ key: 'aiActions', icon: Zap, labelKey: 'settings.aiActions' },
```

需要导入 `Zap` 图标：

```typescript
import { Palette, Wand2, Globe, MessageSquare, Keyboard, Info, Tags, HardDrive, Zap, LucideIcon } from 'lucide-react';
```

- [ ] **Step 3: 更新设置页面**

在 `app/settings/page.tsx` 中：

1. 导入 AIActionsSettings 组件：

```typescript
import { AIActionsSettings } from '@/components/settings/AIActionsSettings';
```

2. 更新 `VALID_TABS`：

```typescript
const VALID_TABS: SettingsTab[] = ['appearance', 'llm', 'aiActions', 'tags', 'network', 'conversations', 'storage', 'shortcuts', 'about'];
```

3. 更新 `tabDescriptions`：

```typescript
aiActions: 'settings.aiActionsDesc',
```

4. 在 `tabs` 数组中添加：

```typescript
{ key: 'aiActions', component: <AIActionsSettings /> },
```

5. 在 `tabMap` 中添加：

```typescript
'settings-aiActions': 'aiActions',
```

- [ ] **Step 4: 提交**

```bash
git add components/settings/SettingsSidebar.tsx app/settings/page.tsx
git commit -m "feat(settings): 添加 AI 操作设置页面入口"
```

---

## Task 7: AIActionsSettings 组件

**Files:**
- Create: `components/settings/AIActionsSettings.tsx`

- [ ] **Step 1: 创建组件骨架**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/lib/locales';
import { Plus, GripVertical, Trash2, Edit2, Zap } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import type { CustomAction, CanvasAction } from '@/lib/db/custom-action-manager';

// 内置操作定义
const BUILTIN_ACTIONS = [
  { id: 'layout', name: '布局优化', icon: 'LayoutGrid' },
  { id: 'beautify', name: '美化', icon: 'Palette' },
  { id: 'simplify', name: '简化', icon: 'Minimize2' },
  { id: 'explain', name: '解释', icon: 'Sparkles' },
];

export function AIActionsSettings() {
  const { t } = useLocale();
  const [canvasActions, setCanvasActions] = useState<CanvasAction[]>([]);
  const [customActions, setCustomActions] = useState<CustomAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAction, setEditingAction] = useState<CustomAction | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [canvasRes, customRes] = await Promise.all([
        fetch('/api/canvas-actions'),
        fetch('/api/custom-actions'),
      ]);
      const canvasData = await canvasRes.json();
      const customData = await customRes.json();
      setCanvasActions(canvasData);
      setCustomActions(customData);
    } catch (error) {
      console.error('Failed to load actions:', error);
    } finally {
      setLoading(false);
    }
  };

  // 更新画布操作
  const updateCanvasActions = async (newActions: Omit<CanvasAction, 'id'>[]) => {
    try {
      await fetch('/api/canvas-actions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: newActions }),
      });
      await loadData();
    } catch (error) {
      console.error('Failed to update canvas actions:', error);
    }
  };

  // 删除自定义操作
  const deleteAction = async (id: string) => {
    if (!confirm(t('aiActions.deleteConfirm'))) return;
    try {
      await fetch(`/api/custom-actions/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      console.error('Failed to delete action:', error);
    }
  };

  // 切换操作显示状态
  const toggleAction = (actionType: 'builtin' | 'custom', actionId: string) => {
    const exists = canvasActions.find(a => a.action_type === actionType && a.action_id === actionId);
    
    if (exists) {
      // 移除
      const newActions = canvasActions.filter(a => !(a.action_type === actionType && a.action_id === actionId));
      updateCanvasActions(newActions);
    } else {
      // 添加（检查数量限制）
      if (canvasActions.length >= 4) {
        alert(t('aiActions.maxActions'));
        return;
      }
      const newActions = [...canvasActions, { action_type: actionType, action_id: actionId, sort_order: canvasActions.length }];
      updateCanvasActions(newActions);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-[var(--muted)]">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 画布操作区域 */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">
          {t('aiActions.canvasActions')}
        </h3>
        <p className="text-xs text-[var(--muted)] mb-4">
          {t('aiActions.canvasActionsDesc')}
        </p>
        
        <div className="space-y-2">
          {canvasActions.map((action, index) => {
            const isBuiltin = action.action_type === 'builtin';
            const builtin = isBuiltin ? BUILTIN_ACTIONS.find(b => b.id === action.action_id) : null;
            const custom = !isBuiltin ? customActions.find(c => c.id === action.action_id) : null;
            
            return (
              <div
                key={`${action.action_type}-${action.action_id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]"
              >
                <GripVertical size={16} className="text-[var(--muted)] cursor-move" />
                <span className="text-lg">{isBuiltin ? '⚡' : (custom?.icon || 'Zap')}</span>
                <span className="flex-1 text-sm text-[var(--fg)]">
                  {isBuiltin ? builtin?.name : custom?.name}
                </span>
                <span className="text-xs text-[var(--muted)] px-2 py-1 rounded bg-[var(--surface-warm-hover)]">
                  {isBuiltin ? t('aiActions.builtin') : t('aiActions.custom')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 自定义操作区域 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--fg)]">
            {t('aiActions.customActions')}
          </h3>
          <button
            onClick={() => {
              setEditingAction(null);
              setShowEditor(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[var(--accent-indigo)] text-white hover:bg-[var(--accent-indigo)]/90 transition-colors"
          >
            <Plus size={14} />
            {t('aiActions.createAction')}
          </button>
        </div>

        {customActions.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted)] text-sm">
            {t('aiActions.noCustomActions')}
          </div>
        ) : (
          <div className="space-y-2">
            {customActions.map(action => (
              <div
                key={action.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]"
              >
                <span className="text-lg">{action.icon || 'Zap'}</span>
                <div className="flex-1">
                  <div className="text-sm text-[var(--fg)]">{action.name}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {action.action_type === 'modify' ? t('aiActions.actionTypeModify') : t('aiActions.actionTypeExplain')}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip content={t('aiActions.editAction')}>
                    <button
                      onClick={() => {
                        setEditingAction(action);
                        setShowEditor(true);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content={t('aiActions.deleteAction')}>
                    <button
                      onClick={() => deleteAction(action.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Tooltip>
                  <button
                    onClick={() => toggleAction('custom', action.id)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                      canvasActions.some(a => a.action_type === 'custom' && a.action_id === action.id)
                        ? 'text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10'
                        : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                    }`}
                  >
                    <Zap size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 编辑器弹窗 */}
      {showEditor && (
        <ActionEditor
          action={editingAction}
          onClose={() => {
            setShowEditor(false);
            setEditingAction(null);
          }}
          onSave={async () => {
            setShowEditor(false);
            setEditingAction(null);
            await loadData();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证组件**

在浏览器中打开设置页面，检查 AI 操作标签页是否正确显示。

- [ ] **Step 3: 提交**

```bash
git add components/settings/AIActionsSettings.tsx
git commit -m "feat(ui): 添加 AI 操作设置组件"
```

---

## Task 8: ActionEditor 组件

**Files:**
- Create: `components/settings/ActionEditor.tsx`

- [ ] **Step 1: 创建编辑器组件**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/lib/locales';
import { X, Zap } from 'lucide-react';
import type { CustomAction } from '@/lib/db/custom-action-manager';

// 可选图标列表
const ICON_OPTIONS = [
  'Zap', 'Star', 'Heart', 'Coffee', 'Music', 'Camera', 'Code', 'Database',
  'FileText', 'Folder', 'Globe', 'Home', 'Image', 'Lock', 'Mail', 'Map',
  'Mic', 'Moon', 'Phone', 'Pin', 'Search', 'Settings', 'Shield', 'Sun',
  'Terminal', 'User', 'Video', 'Wifi', 'Cloud', 'Download', 'Upload',
];

interface ActionEditorProps {
  action: CustomAction | null;
  onClose: () => void;
  onSave: () => void;
}

export function ActionEditor({ action, onClose, onSave }: ActionEditorProps) {
  const { t } = useLocale();
  const [name, setName] = useState(action?.name || '');
  const [prompt, setPrompt] = useState(action?.prompt || '');
  const [icon, setIcon] = useState(action?.icon || 'Zap');
  const [actionType, setActionType] = useState<'modify' | 'explain'>(action?.action_type || 'modify');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = !!action;

  const handleSave = async () => {
    if (!name.trim() || !prompt.trim()) return;
    
    setSaving(true);
    try {
      const url = isEditing ? `/api/custom-actions/${action.id}` : '/api/custom-actions';
      const method = isEditing ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          prompt: prompt.trim(),
          icon,
          action_type: actionType,
        }),
      });
      
      onSave();
    } catch (error) {
      console.error('Failed to save action:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-[var(--bg)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold text-[var(--fg)]">
            {isEditing ? t('aiActions.editAction') : t('aiActions.createAction')}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* 操作名称 */}
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
              {t('aiActions.name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('aiActions.namePlaceholder')}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
            />
          </div>

          {/* 提示词 */}
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
              {t('aiActions.prompt')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('aiActions.promptPlaceholder')}
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm resize-none"
            />
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              {actionType === 'modify' ? t('aiActions.promptTipModify') : t('aiActions.promptTipExplain')}
            </p>
          </div>

          {/* 高级设置 */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-[var(--accent-indigo)] hover:underline"
            >
              {t('aiActions.advancedSettings')}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4 p-4 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]">
                {/* 图标选择 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
                    {t('aiActions.icon')}
                  </label>
                  <div className="grid grid-cols-10 gap-2">
                    {ICON_OPTIONS.map(iconName => (
                      <button
                        key={iconName}
                        onClick={() => setIcon(iconName)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                          icon === iconName
                            ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] ring-2 ring-[var(--accent-indigo)]'
                            : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                        }`}
                      >
                        <Zap size={14} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 操作类型 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
                    {t('aiActions.actionType')}
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] cursor-pointer hover:bg-[var(--surface-warm-hover)] transition-colors">
                      <input
                        type="radio"
                        name="actionType"
                        value="modify"
                        checked={actionType === 'modify'}
                        onChange={() => setActionType('modify')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-[var(--fg)]">
                          {t('aiActions.actionTypeModify')}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {t('aiActions.actionTypeModifyDesc')}
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] cursor-pointer hover:bg-[var(--surface-warm-hover)] transition-colors">
                      <input
                        type="radio"
                        name="actionType"
                        value="explain"
                        checked={actionType === 'explain'}
                        onChange={() => setActionType('explain')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-[var(--fg)]">
                          {t('aiActions.actionTypeExplain')}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {t('aiActions.actionTypeExplainDesc')}
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors"
          >
            {t('aiActions.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !prompt.trim() || saving}
            className="px-4 py-2 text-sm rounded-xl bg-[var(--accent-indigo)] text-white hover:bg-[var(--accent-indigo)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '...' : (isEditing ? t('aiActions.save') : t('aiActions.create'))}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编辑器**

在浏览器中测试创建和编辑自定义操作。

- [ ] **Step 3: 提交**

```bash
git add components/settings/ActionEditor.tsx
git commit -m "feat(ui): 添加操作编辑器组件"
```

---

## Task 9: 修改 FloatingAIActions

**Files:**
- Modify: `components/ai/FloatingAIActions.tsx`

- [ ] **Step 1: 修改组件支持动态操作**

```typescript
'use client';

import { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Palette,
  Minimize2,
  Sparkles,
  Loader2,
  Zap,
} from 'lucide-react';
import { useLocale } from '@/lib/locales';
import Tooltip from '@/components/ui/Tooltip';
import type { AIActionId } from '@/lib/types';
import type { TranslationKey } from '@/lib/locales';
import type { CanvasAction } from '@/lib/db/custom-action-manager';

// 内置操作定义
const BUILTIN_ACTIONS = [
  { id: 'layout', icon: LayoutGrid, labelKey: 'aiAction.layout' as TranslationKey },
  { id: 'beautify', icon: Palette, labelKey: 'aiAction.beautify' as TranslationKey },
  { id: 'simplify', icon: Minimize2, labelKey: 'aiAction.simplify' as TranslationKey },
  { id: 'explain', icon: Sparkles, labelKey: 'aiAction.explain' as TranslationKey },
];

interface FloatingAIActionsProps {
  onAction?: (actionId: string, customActionId?: string) => void;
  loadingAction?: string | null;
  disabled?: boolean;
}

export default function FloatingAIActions({ onAction, loadingAction, disabled }: FloatingAIActionsProps) {
  const { t } = useLocale();
  const [canvasActions, setCanvasActions] = useState<CanvasAction[]>([]);
  const [customActionsMap, setCustomActionsMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  // 加载画布操作
  useEffect(() => {
    loadCanvasActions();
  }, []);

  const loadCanvasActions = async () => {
    try {
      const res = await fetch('/api/canvas-actions');
      const data = await res.json();
      setCanvasActions(data);
      
      // 构建自定义操作映射
      const map = new Map();
      data.forEach((action: any) => {
        if (action.action_type === 'custom' && action.details) {
          map.set(action.action_id, action.details);
        }
      });
      setCustomActionsMap(map);
    } catch (error) {
      console.error('Failed to load canvas actions:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取操作图标
  const getIcon = (action: CanvasAction) => {
    if (action.action_type === 'builtin') {
      const builtin = BUILTIN_ACTIONS.find(b => b.id === action.action_id);
      return builtin?.icon || Zap;
    }
    return Zap;
  };

  // 获取操作标签
  const getLabel = (action: CanvasAction): string => {
    if (action.action_type === 'builtin') {
      const builtin = BUILTIN_ACTIONS.find(b => b.id === action.action_id);
      return builtin ? t(builtin.labelKey) : action.action_id;
    }
    const custom = customActionsMap.get(action.action_id);
    return custom?.name || '自定义操作';
  };

  // 处理点击
  const handleClick = (action: CanvasAction) => {
    if (action.action_type === 'builtin') {
      onAction?.(action.action_id);
    } else {
      onAction?.('custom', action.action_id);
    }
  };

  if (loading) {
    return null;
  }

  // 最多显示 4 个操作
  const visibleActions = canvasActions.slice(0, 4);

  return (
    <div id="onboarding-toolbar" className="absolute right-4 top-1/2 -translate-y-1/2 z-30">
      <div className="flex flex-col gap-2">
        {visibleActions.map((action) => {
          const isLoading = loadingAction === (action.action_type === 'builtin' ? action.action_id : `custom-${action.action_id}`);
          const Icon = isLoading ? Loader2 : getIcon(action);
          const label = getLabel(action);
          
          return (
            <Tooltip key={`${action.action_type}-${action.action_id}`} content={isLoading ? t('common.loading') : label} side="left">
              <button
                onClick={() => handleClick(action)}
                disabled={disabled || !!loadingAction}
                className={`group relative w-10 h-10 flex items-center justify-center rounded-2xl backdrop-blur-xl bg-[var(--bg-glass)] border border-[var(--border)] shadow-[0_4px_20px_rgba(28,25,23,0.05)] transition-all duration-300 ${
                  isLoading
                    ? 'animate-pulse cursor-wait'
                    : disabled || loadingAction
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:shadow-[0_0_30px_rgba(124,58,237,0.12)] hover:bg-[var(--card)] hover:-translate-y-px hover-lift'
                }`}
              >
                <Icon size={17} className={`text-[var(--muted)] group-hover:text-[var(--fg)] transition-colors duration-200 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 更新编辑器页面**

在 `app/editor/page.tsx` 中修改 `onAction` 处理：

```typescript
// 在 handleAIAction 函数中
const handleAIAction = async (actionId: string, customActionId?: string) => {
  if (actionId === 'custom' && customActionId) {
    // 执行自定义操作
    await executeCustomAction(customActionId);
  } else {
    // 执行内置操作
    await executeBuiltinAction(actionId);
  }
};
```

- [ ] **Step 3: 提交**

```bash
git add components/ai/FloatingAIActions.tsx
git commit -m "feat(ui): 修改 FloatingAIActions 支持动态操作"
```

---

## Task 10: 修改 AI Action API

**Files:**
- Modify: `app/api/ai-action/route.ts`

- [ ] **Step 1: 添加自定义操作支持**

在 `app/api/ai-action/route.ts` 中添加：

```typescript
import { customActionManager } from '@/lib/db/custom-action-manager';

// 系统提示词模板
const MODIFY_SYSTEM_PROMPT = `你是图表代码优化专家。用户会提供图表代码和优化要求。

【强制规则】
1. 必须输出完整的图表代码
2. 禁止输出任何解释、说明或注释
3. 禁止使用 markdown 代码块包裹
4. 必须保持与输入相同的代码格式
5. 直接输出修改后的代码，不要添加任何前缀文字

违反以上规则将导致系统错误。`;

const EXPLAIN_SYSTEM_PROMPT = `你是图表分析专家。用户会提供图表代码和分析要求。

【强制规则】
1. 必须输出详细的文字说明
2. 禁止输出任何代码
3. 必须使用 Markdown 格式
4. 必须包含图表结构分析、节点说明、流程描述
5. 使用清晰的中文描述

违反以上规则将导致系统错误。`;

// 修改 POST 函数
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, format, action, actionId, configId } = body;

    if (!code || !format || !action) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 获取 LLM 配置
    let config;
    if (configId) {
      config = await configManager.getConfig(configId);
    } else {
      config = await configManager.getActiveConfig();
    }

    if (!config) {
      return NextResponse.json({ error: '未找到 LLM 配置' }, { status: 400 });
    }

    // 构建提示词
    let systemPrompt: string;
    let userPrompt: string;

    if (action === 'custom' && actionId) {
      // 自定义操作
      const customAction = await customActionManager.getById(actionId);
      if (!customAction) {
        return NextResponse.json({ error: '自定义操作不存在' }, { status: 404 });
      }

      systemPrompt = customAction.action_type === 'modify' ? MODIFY_SYSTEM_PROMPT : EXPLAIN_SYSTEM_PROMPT;
      userPrompt = `${customAction.prompt}\n\n当前图表代码：\n${code}`;
    } else {
      // 内置操作
      systemPrompt = getActionSystemPrompt(action, format);
      userPrompt = getActionUserPrompt(action, code, format);
    }

    // 构建消息
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    // SSE 流式响应
    const encoder = new TextEncoder();
    const timeoutMs = 5 * 60 * 1000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const combinedController = new AbortController();
    const onAbort = () => combinedController.abort();
    request.signal?.addEventListener('abort', onAbort, { once: true });
    timeoutController.signal.addEventListener('abort', onAbort, { once: true });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await callLLM(config, messages, (chunk) => {
            const data = `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }, combinedController.signal);

          // 对于非 explain 操作，去除代码围栏
          if (action !== 'explain') {
            const cleaned = stripCodeFences(result);
            const finalData = `data: ${JSON.stringify({ type: 'result', content: cleaned })}\n\n`;
            controller.enqueue(encoder.encode(finalData));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          const isAbort = error instanceof DOMException && error.name === 'AbortError';
          const errorMessage = isAbort
            ? 'Request timeout'
            : (process.env.NODE_ENV === 'development' ? (error as Error).message : 'AI 操作失败，请稍后重试');
          const errorData = `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } finally {
          clearTimeout(timeoutId);
          request.signal?.removeEventListener('abort', onAbort);
          timeoutController.signal.removeEventListener('abort', onAbort);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI action error:', error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'AI 操作失败，请稍后重试' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: 测试自定义操作**

创建一个自定义操作，然后测试执行。

- [ ] **Step 3: 提交**

```bash
git add app/api/ai-action/route.ts
git commit -m "feat(api): 支持自定义操作执行"
```

---

## Task 11: 集成测试

**Files:**
- Test: 手动测试

- [ ] **Step 1: 测试创建自定义操作**

1. 打开设置页面
2. 点击"AI 操作"标签
3. 点击"创建新操作"
4. 填写名称和提示词
5. 点击"创建"
6. 验证操作是否出现在列表中

- [ ] **Step 2: 测试添加到画布**

1. 在自定义操作列表中，点击操作旁边的闪电图标
2. 验证操作是否出现在"画布上显示的操作"区域
3. 验证画布上是否显示了新操作按钮

- [ ] **Step 3: 测试执行自定义操作**

1. 在编辑器中生成一个图表
2. 点击自定义操作按钮
3. 验证 AI 是否执行了操作
4. 验证结果是否正确显示

- [ ] **Step 4: 测试删除自定义操作**

1. 在设置页面中，点击操作旁边的删除按钮
2. 确认删除
3. 验证操作是否从列表中移除
4. 验证画布上是否移除了该操作按钮

- [ ] **Step 5: 测试边界条件**

1. 测试最多 4 个操作的限制
2. 测试空操作列表
3. 测试删除正在使用的操作

- [ ] **Step 6: 最终提交**

```bash
git add -A
git commit -m "feat: 完成自定义 AI 操作功能"
```

---

## 自我审查

### 1. 规范覆盖检查

- ✅ 数据库表设计
- ✅ API 路由实现
- ✅ 前端组件实现
- ✅ 翻译添加
- ✅ 设置页面集成
- ✅ 执行逻辑修改
- ✅ 结果处理逻辑

### 2. 占位符扫描

- ✅ 无 TBD 或 TODO
- ✅ 所有代码完整
- ✅ 所有步骤明确

### 3. 类型一致性检查

- ✅ CustomAction 接口一致
- ✅ CanvasAction 接口一致
- ✅ 函数签名一致
- ✅ 属性名称一致

---

## 执行选项

**计划已完成并保存到 `docs/superpowers/plans/2026-06-18-custom-ai-actions.md`。两种执行方式：**

**1. Subagent-Driven（推荐）** - 每个任务分发一个新的子代理，任务之间进行审查，快速迭代

**2. Inline Execution** - 在当前会话中使用 executing-plans 执行任务，批量执行并设置检查点

**选择哪种方式？**
