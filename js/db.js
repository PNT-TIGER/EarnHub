const DB = {
  get(key, defaultVal = null) {
    try {
      const data = localStorage.getItem('earnhub_' + key);
      return data ? JSON.parse(data) : defaultVal;
    } catch { return defaultVal; }
  },
  set(key, val) {
    localStorage.setItem('earnhub_' + key, JSON.stringify(val));
  },
  init() {
    if (!this.get('initialized')) {
      this.set('users', []);
      this.set('tasks', []);
      this.set('ads', []);
      this.set('withdrawals', []);
      this.set('giftCodes', []);
      this.set('admin', { username: 'admin', password: 'admin123' });
      this.set('settings', { minWithdraw: 1, refPercent: 10, siteName: 'EarnHub', botToken: '', adminChatId: '' });
      this.set('initialized', true);
    }
  },
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
};

DB.init();

const uid = () => DB.generateId();
