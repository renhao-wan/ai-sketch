import { getDb, requestSave } from './index';
import { configManager } from './config-manager';

/**
 * 新手引导状态管理器
 * 使用 meta 表存储引导完成状态
 */
class OnboardingManager {
  private static readonly STATUS_KEY = 'onboarding_completed';
  private static readonly TIMESTAMP_KEY = 'onboarding_completed_at';

  /**
   * 获取引导状态
   * @returns 'core' | 'full' | 'skipped' | null
   */
  async getStatus(): Promise<string | null> {
    return configManager.getPreference(OnboardingManager.STATUS_KEY);
  }

  /**
   * 设置引导状态
   * @param status - 完成状态：core（快速引导）、full（完整引导）、skipped（跳过）
   */
  async setStatus(status: 'core' | 'full' | 'skipped'): Promise<void> {
    await configManager.setPreference(OnboardingManager.STATUS_KEY, status);
    await configManager.setPreference(
      OnboardingManager.TIMESTAMP_KEY,
      new Date().toISOString()
    );
  }

  /**
   * 检查是否已完成引导
   * @returns true 如果已完成或跳过
   */
  async isCompleted(): Promise<boolean> {
    const status = await this.getStatus();
    return status !== null;
  }

  /**
   * 重置引导状态（用于重新触发）
   */
  async reset(): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM meta WHERE key = ?', [OnboardingManager.STATUS_KEY]);
    db.run('DELETE FROM meta WHERE key = ?', [OnboardingManager.TIMESTAMP_KEY]);
    requestSave();
  }
}

export const onboardingManager = new OnboardingManager();
