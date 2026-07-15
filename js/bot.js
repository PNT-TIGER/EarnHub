const BOT_TOKEN = '8932261850:AAG4791Hk4YxFtvISzoot_cKvcfok49snRI';
const ADMIN_CHAT_ID = '7797816241';

function getBotSettings() {
  const settings = DB.get('settings', {});
  return {
    token: settings.botToken || BOT_TOKEN,
    chatId: settings.adminChatId || ADMIN_CHAT_ID
  };
}

function sendTelegramMessage(message) {
  const { token, chatId } = getBotSettings();
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    })
  }).catch(() => {});
}

function broadcastData() {
  const tasks = DB.get('tasks', []);
  const ads = DB.get('ads', []);
  const data = JSON.stringify({ type: 'earnhub_sync', tasks, ads, time: Date.now() });
  const { token, chatId } = getBotSettings();
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: '📦 SYNC:' + data })
  }).catch(() => {});
}

function fetchDataFromTelegram(callback) {
  const { token, chatId } = getBotSettings();
  if (!token || !chatId) { if (callback) callback(); return; }
  const url = `https://api.telegram.org/bot${token}/getUpdates?offset=-1&limit=10`;
  fetch(url)
    .then(r => r.json())
    .then(data => {
      if (!data.ok || !data.result) { if (callback) callback(); return; }
      let found = false;
      for (let i = data.result.length - 1; i >= 0; i--) {
        const msg = data.result[i]?.message?.text || data.result[i]?.channel_post?.text || '';
        if (msg.startsWith('📦 SYNC:')) {
          try {
            const parsed = JSON.parse(msg.replace('📦 SYNC:', ''));
            if (parsed.type === 'earnhub_sync' && parsed.tasks) {
              DB.set('tasks', parsed.tasks);
              if (parsed.ads) DB.set('ads', parsed.ads);
              found = true;
            }
          } catch(e) {}
          break;
        }
      }
      if (!found && data.result.length > 0) {
        for (let i = data.result.length - 1; i >= 0; i--) {
          const msg = data.result[i]?.message?.text || '';
          if (msg.startsWith('📦 SYNC:')) {
            try {
              const parsed = JSON.parse(msg.replace('📦 SYNC:', ''));
              if (parsed.type === 'earnhub_sync' && parsed.tasks) {
                DB.set('tasks', parsed.tasks);
                if (parsed.ads) DB.set('ads', parsed.ads);
              }
            } catch(e) {}
            break;
          }
        }
      }
      if (callback) callback();
    })
    .catch(() => { if (callback) callback(); });
}

function notifyNewUser(user) {
  sendTelegramMessage(
    `<b>🆕 New User Registered</b>\n\n` +
    `<b>Username:</b> ${user.username}\n` +
    `<b>Email:</b> ${user.email || 'N/A'}\n` +
    `<b>Phone:</b> ${user.phone || 'N/A'}\n` +
    (user.telegramUsername ? `<b>Telegram:</b> @${user.telegramUsername}\n` : '') +
    (user.telegramId ? `<b>TG Chat ID:</b> <code>${user.telegramId}</code>\n` : '') +
    `<b>Referral Code:</b> ${user.referralCode}\n` +
    `<b>Ref Link:</b> ${TelegramApp.getBotLink(user.referralCode)}\n` +
    `<b>Date:</b> ${new Date(user.createdAt).toLocaleString()}\n` +
    (user.referredBy ? `<b>Referred By ID:</b> ${user.referredBy}\n` : '')
  );
}

function notifyWithdrawRequest(user, amount, address) {
  sendTelegramMessage(
    `<b>💸 New Withdrawal Request</b>\n\n` +
    `<b>User:</b> ${user.username}\n` +
    `<b>Amount:</b> ${amount} USDT\n` +
    `<b>Address:</b> <code>${address}</code>\n` +
    `<b>Date:</b> ${new Date().toLocaleString()}\n\n` +
    `Check admin panel to approve/reject.`
  );
}

function notifyTaskClaimed(user, task, reward) {
  sendTelegramMessage(
    `<b>💰 Task Claimed</b>\n\n` +
    `<b>User:</b> ${user.username}\n` +
    `<b>Task:</b> ${task}\n` +
    `<b>Reward:</b> ${reward} USDT\n` +
    `<b>Date:</b> ${new Date().toLocaleString()}`
  );
}

function notifyGiftCodeRedeemed(user, code, amount) {
  sendTelegramMessage(
    `<b>🎁 Gift Code Redeemed</b>\n\n` +
    `<b>User:</b> ${user.username}\n` +
    `<b>Code:</b> ${code}\n` +
    `<b>Amount:</b> ${amount} USDT\n` +
    `<b>Date:</b> ${new Date().toLocaleString()}`
  );
}

function notifyWithdrawApproved(user, amount) {
  sendTelegramMessage(
    `<b>✅ Withdrawal Approved</b>\n\n` +
    `<b>User:</b> ${user.username}\n` +
    `<b>Amount:</b> ${amount} USDT\n` +
    `<b>Date:</b> ${new Date().toLocaleString()}`
  );
}

function notifyWithdrawRejected(user, amount) {
  sendTelegramMessage(
    `<b>❌ Withdrawal Rejected</b>\n\n` +
    `<b>User:</b> ${user.username}\n` +
    `<b>Amount:</b> ${amount} USDT (Refunded)\n` +
    `<b>Date:</b> ${new Date().toLocaleString()}`
  );
}

function notifyBalanceAdded(user, amount, addedBy) {
  sendTelegramMessage(
    `<b>💰 Balance Added by Admin</b>\n\n` +
    `<b>User:</b> ${user.username}\n` +
    `<b>Amount:</b> +${amount} USDT\n` +
    `<b>Added By:</b> ${addedBy}\n` +
    `<b>Date:</b> ${new Date().toLocaleString()}`
  );
}
