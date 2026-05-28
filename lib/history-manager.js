class HistoryManager {
  constructor() {
    this.STORAGE_KEY = 'smart-excalidraw-history';
    this.histories = [];
    this.loaded = false;
  }

  ensureLoaded() {
    if (typeof window === 'undefined') return;
    if (!this.loaded) {
      this.loadHistories();
      this.loaded = true;
    }
  }

  loadHistories() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      this.histories = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load histories:', error);
      this.histories = [];
    }
  }

  saveHistories() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.histories));
    } catch (error) {
      console.error('Failed to save histories:', error);
    }
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  addHistory(data) {
    this.ensureLoaded();
    const history = {
      id: this.generateId(),
      chartType: data.chartType,
      userInput: data.userInput,
      generatedCode: data.generatedCode,
      config: data.config,
      timestamp: Date.now()
    };
    this.histories.unshift(history);
    this.saveHistories();
    return history;
  }

  getHistories() {
    this.ensureLoaded();
    return [...this.histories];
  }

  deleteHistory(id) {
    this.ensureLoaded();
    this.histories = this.histories.filter(h => h.id !== id);
    this.saveHistories();
  }

  clearAll() {
    this.ensureLoaded();
    this.histories = [];
    this.saveHistories();
  }
}

export const historyManager = new HistoryManager();
