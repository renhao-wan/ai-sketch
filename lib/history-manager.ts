import type { HistoryItem, LLMConfig } from '@/types';

interface AddHistoryData {
  chartType: string;
  userInput: string;
  generatedCode: string;
  config: Partial<LLMConfig>;
}

class HistoryManager {
  private STORAGE_KEY = 'smart-excalidraw-history';
  private histories: HistoryItem[] = [];
  private loaded = false;

  ensureLoaded(): void {
    if (typeof window === 'undefined') return;
    if (!this.loaded) {
      this.loadHistories();
      this.loaded = true;
    }
  }

  private loadHistories(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      this.histories = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load histories:', error);
      this.histories = [];
    }
  }

  private saveHistories(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.histories));
    } catch (error) {
      console.error('Failed to save histories:', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  addHistory(data: AddHistoryData): HistoryItem {
    this.ensureLoaded();
    const history: HistoryItem = {
      id: this.generateId(),
      chartType: data.chartType,
      userInput: data.userInput,
      generatedCode: data.generatedCode,
      config: data.config,
      timestamp: Date.now(),
    };
    this.histories.unshift(history);
    this.saveHistories();
    return history;
  }

  getHistories(): HistoryItem[] {
    this.ensureLoaded();
    return [...this.histories];
  }

  deleteHistory(id: string): void {
    this.ensureLoaded();
    this.histories = this.histories.filter(h => h.id !== id);
    this.saveHistories();
  }

  clearAll(): void {
    this.ensureLoaded();
    this.histories = [];
    this.saveHistories();
  }
}

export const historyManager = new HistoryManager();
