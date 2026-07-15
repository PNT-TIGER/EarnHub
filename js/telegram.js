const TelegramApp = {
  tg: null,
  tgUser: null,
  init() {
    try {
      if (window.Telegram && window.Telegram.WebApp) {
        this.tg = window.Telegram.WebApp;
        this.tg.expand();
        this.tg.enableClosingConfirmation();
        this.tgUser = this.tg.initDataUnsafe?.user || null;
      }
    } catch (e) {
      console.log('Telegram WebApp not available');
    }
  },
  getUser() {
    return this.tgUser;
  },
  getChatId() {
    return this.tgUser?.id || null;
  },
  getUsername() {
    return this.tgUser?.username || this.tgUser?.first_name || null;
  },
  getBotLink(refCode = '') {
    const botUsername = 'EarnHub_Bot';
    return refCode ? `https://t.me/${botUsername}?start=${refCode}` : `https://t.me/${botUsername}`;
  },
  showAlert(msg) {
    if (this.tg) this.tg.showAlert(msg);
    else alert(msg);
  },
  showConfirm(msg, cb) {
    if (this.tg) this.tg.showConfirm(msg, cb);
    else cb(confirm(msg));
  },
  close() {
    if (this.tg) this.tg.close();
  }
};
