const BOT_TOKEN = '8932261850:AAFDn7uS5yNkSVTWQ6b4_B-1y3lK-37y3ME';
const ADMIN_CHAT_ID = '7797816241';

function sendTelegramMessage(message) {
  const settings = DB.get('settings', {});
  const token = settings.botToken || BOT_TOKEN;
  const chatId = settings.adminChatId || ADMIN_CHAT_ID;
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

function notifyNewUser(user) {
  sendTelegramMessage(
    `<b>🆕 New User Registered</b>\n\n` +
    `<b>Username:</b> ${user.username}\n` +
    `<b>Email:</b> ${user.email || 'N/A'}\n` +
    `<b>Phone:</b> ${user.phone || 'N/A'}\n` +
    `<b>Referral Code:</b> ${user.referralCode}\n` +
    `<b>Date:</b> ${new Date(user.createdAt).toLocaleString()}\n` +
    (user.referredBy ? `<b>Referred By:</b> ${user.referredBy}\n` : '')
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
