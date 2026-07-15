const TelegramApp = {
  tg: null,
  init() {
    try {
      if (window.Telegram && window.Telegram.WebApp) {
        this.tg = window.Telegram.WebApp;
        this.tg.expand();
        this.tg.enableClosingConfirmation();
      }
    } catch (e) {
      console.log('Telegram WebApp not available');
    }
  },
  getUser() {
    if (this.tg && this.tg.initDataUnsafe && this.tg.initDataUnsafe.user) {
      return this.tg.initDataUnsafe.user;
    }
    return null;
  },
  showAlert(msg) {
    if (this.tg) {
      this.tg.showAlert(msg);
    } else {
      alert(msg);
    }
  },
  showConfirm(msg, cb) {
    if (this.tg) {
      this.tg.showConfirm(msg, cb);
    } else {
      cb(confirm(msg));
    }
  },
  close() {
    if (this.tg) {
      this.tg.close();
    }
  }
};
