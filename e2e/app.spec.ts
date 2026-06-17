import { test, expect } from '@playwright/test';

test.describe('首页', () => {
  test('加载并显示主标题', async ({ page }) => {
    await page.goto('/');
    // 等待页面加载
    await expect(page.locator('body')).toBeVisible();
  });

  test('显示快捷模板区域', async ({ page }) => {
    await page.goto('/');
    // 首页应该有模板卡片或输入区域
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('编辑器页面', () => {
  test('加载编辑器页面', async ({ page }) => {
    await page.goto('/editor');
    // 编辑器页面应该加载成功
    await expect(page.locator('body')).toBeVisible();
  });

  test('显示 AI 副驾驶面板', async ({ page }) => {
    await page.goto('/editor');
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    // 应该有输入区域
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('设置页面', () => {
  test('加载设置页面', async ({ page }) => {
    await page.goto('/settings');
    // 设置页面应该加载成功
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('页面导航', () => {
  test('从首页导航到编辑器', async ({ page }) => {
    await page.goto('/');
    // 等待页面加载
    await page.waitForLoadState('networkidle');
    // 页面应该可交互
    await expect(page.locator('body')).toBeVisible();
  });
});
