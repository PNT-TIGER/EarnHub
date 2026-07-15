let adminUser = null;

function adminLogin() {
  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value.trim();
  const admin = DB.get('admin', {});
  const error = document.getElementById('adminError');
  if (username === admin.username && password === admin.password) {
    adminUser = admin;
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('adminUser').textContent = admin.username;
    loadAdminDashboard();
  } else {
    error.textContent = 'Invalid admin credentials!';
  }
}

function adminLogout() {
  adminUser = null;
  document.getElementById('adminLogin').style.display = 'block';
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('adminUsername').value = '';
  document.getElementById('adminPassword').value = '';
}

function adminNavigate(tab) {
  document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.admin-nav-btn[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById(tab + 'Tab')?.classList.add('active');
  if (tab === 'dashboard') loadAdminDashboard();
  if (tab === 'tasks') loadAdminTasks();
  if (tab === 'ads') loadAdminAds();
  if (tab === 'users') loadAdminUsers();
  if (tab === 'withdrawals') loadAdminWithdrawals();
  if (tab === 'giftcodes') loadAdminGiftCodes();
  if (tab === 'settings') loadAdminSettings();
}

function loadAdminDashboard() {
  const users = DB.get('users', []);
  const tasks = DB.get('tasks', []);
  const ads = DB.get('ads', []);
  const withdrawals = DB.get('withdrawals', []);
  document.getElementById('adminTotalUsers').textContent = users.length;
  document.getElementById('adminTotalTasks').textContent = tasks.length;
  document.getElementById('adminTotalAds').textContent = ads.length;
  document.getElementById('adminPendingWithdrawals').textContent = withdrawals.filter(w => w.status === 'pending').length;
  document.getElementById('adminTotalWithdrawn').textContent = '$' + withdrawals.reduce((s, w) => s + (w.status === 'completed' ? w.amount : 0), 0).toFixed(2);
  document.getElementById('adminTotalBalance').textContent = '$' + users.reduce((s, u) => s + u.balance, 0).toFixed(2);
}

// ===== TASKS =====
function loadAdminTasks() {
  const container = document.getElementById('adminTasksList');
  const tasks = DB.get('tasks', []);
  if (tasks.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No tasks yet</p></div>';
    return;
  }
  container.innerHTML = '';
  tasks.slice().reverse().forEach(t => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-color)';
    row.innerHTML = `
      <div>
        <div style="font-weight:600;font-size:14px">${t.title}</div>
        <div style="font-size:12px;color:var(--text-muted)">Reward: ${t.reward} USDT | ${t.active !== false ? 'Active' : 'Inactive'}</div>
      </div>
      <div class="admin-actions">
        <button class="btn btn-sm btn-outline" onclick="editTask('${t.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTask('${t.id}')">🗑️</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function showAddTaskForm() {
  document.getElementById('taskFormTitle').textContent = 'Add New Task';
  document.getElementById('taskId').value = '';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskLink').value = '';
  document.getElementById('taskDescription').value = '';
  document.getElementById('taskReward').value = '';
  document.getElementById('taskActive').checked = true;
  document.getElementById('taskForm').style.display = 'block';
}

function hideTaskForm() {
  document.getElementById('taskForm').style.display = 'none';
}

function saveTask() {
  const id = document.getElementById('taskId').value;
  const title = document.getElementById('taskTitle').value.trim();
  const link = document.getElementById('taskLink').value.trim();
  const description = document.getElementById('taskDescription').value.trim();
  const reward = parseFloat(document.getElementById('taskReward').value);
  const active = document.getElementById('taskActive').checked;
  if (!title || !reward) {
    showToast('Title and reward are required!', 'error');
    return;
  }
  let tasks = DB.get('tasks', []);
  if (id) {
    const t = tasks.find(t => t.id === id);
    if (t) {
      t.title = title;
      t.link = link;
      t.description = description;
      t.reward = reward;
      t.active = active;
    }
    showToast('Task updated!', 'success');
  } else {
    tasks.push({ id: uid(), title, link, description, reward, active, createdAt: new Date().toISOString() });
    showToast('Task added!', 'success');
  }
  DB.set('tasks', tasks);
  broadcastData();
  hideTaskForm();
  loadAdminTasks();
}

function editTask(id) {
  const tasks = DB.get('tasks', []);
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  document.getElementById('taskFormTitle').textContent = 'Edit Task';
  document.getElementById('taskId').value = t.id;
  document.getElementById('taskTitle').value = t.title;
  document.getElementById('taskLink').value = t.link || '';
  document.getElementById('taskDescription').value = t.description || '';
  document.getElementById('taskReward').value = t.reward;
  document.getElementById('taskActive').checked = t.active !== false;
  document.getElementById('taskForm').style.display = 'block';
}

function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  let tasks = DB.get('tasks', []);
  tasks = tasks.filter(t => t.id !== id);
  DB.set('tasks', tasks);
  showToast('Task deleted', 'info');
  loadAdminTasks();
}

// ===== ADS =====
function loadAdminAds() {
  const container = document.getElementById('adminAdsList');
  const ads = DB.get('ads', []);
  if (ads.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📢</div><p>No ads yet</p></div>';
    return;
  }
  container.innerHTML = '';
  ads.slice().reverse().forEach(a => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-color)';
    row.innerHTML = `
      <div>
        <div style="font-weight:600;font-size:14px">${a.title}</div>
        <div style="font-size:12px;color:var(--text-muted)">Payout: ${a.payout} USDT | ${a.active !== false ? 'Active' : 'Inactive'}</div>
      </div>
      <div class="admin-actions">
        <button class="btn btn-sm btn-outline" onclick="editAd('${a.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteAd('${a.id}')">🗑️</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function showAddAdForm() {
  document.getElementById('adFormTitle').textContent = 'Add New Ad';
  document.getElementById('adId').value = '';
  document.getElementById('adTitle').value = '';
  document.getElementById('adLink').value = '';
  document.getElementById('adDescription').value = '';
  document.getElementById('adImage').value = '';
  document.getElementById('adPayout').value = '';
  document.getElementById('adActive').checked = true;
  document.getElementById('adForm').style.display = 'block';
}

function hideAdForm() {
  document.getElementById('adForm').style.display = 'none';
}

function saveAd() {
  const id = document.getElementById('adId').value;
  const title = document.getElementById('adTitle').value.trim();
  const link = document.getElementById('adLink').value.trim();
  const description = document.getElementById('adDescription').value.trim();
  const image = document.getElementById('adImage').value.trim();
  const payout = parseFloat(document.getElementById('adPayout').value);
  const active = document.getElementById('adActive').checked;
  if (!title || !payout) {
    showToast('Title and payout are required!', 'error');
    return;
  }
  let ads = DB.get('ads', []);
  if (id) {
    const a = ads.find(a => a.id === id);
    if (a) {
      a.title = title;
      a.link = link;
      a.description = description;
      a.image = image;
      a.payout = payout;
      a.active = active;
    }
    showToast('Ad updated!', 'success');
  } else {
    ads.push({ id: uid(), title, link, description, image, payout, active, createdAt: new Date().toISOString() });
    showToast('Ad added!', 'success');
  }
  DB.set('ads', ads);
  broadcastData();
  hideAdForm();
  loadAdminAds();
}

function editAd(id) {
  const ads = DB.get('ads', []);
  const a = ads.find(a => a.id === id);
  if (!a) return;
  document.getElementById('adFormTitle').textContent = 'Edit Ad';
  document.getElementById('adId').value = a.id;
  document.getElementById('adTitle').value = a.title;
  document.getElementById('adLink').value = a.link || '';
  document.getElementById('adDescription').value = a.description || '';
  document.getElementById('adImage').value = a.image || '';
  document.getElementById('adPayout').value = a.payout;
  document.getElementById('adActive').checked = a.active !== false;
  document.getElementById('adForm').style.display = 'block';
}

function deleteAd(id) {
  if (!confirm('Delete this ad?')) return;
  let ads = DB.get('ads', []);
  ads = ads.filter(a => a.id !== id);
  DB.set('ads', ads);
  showToast('Ad deleted', 'info');
  loadAdminAds();
}

// ===== USERS =====
function loadAdminUsers() {
  const container = document.getElementById('adminUsersList');
  const users = DB.get('users', []);
  if (users.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div><p>No users yet</p></div>';
    return;
  }
  container.innerHTML = '';
  users.slice().reverse().forEach(u => {
    const hasScreenshots = u.taskScreenshots && Object.keys(u.taskScreenshots).length > 0;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-color)';
    row.innerHTML = `
      <div>
        <div style="font-weight:600;font-size:14px">${u.username}</div>
        <div style="font-size:12px;color:var(--text-muted)">Balance: $${u.balance.toFixed(2)} | Tasks: ${u.completedTasks.length} | Ref: ${u.referrals.length}${hasScreenshots ? ' | 📸 Screenshots: ' + Object.keys(u.taskScreenshots).length : ''}</div>
      </div>
      <div class="admin-actions">
        ${hasScreenshots ? `<button class="btn btn-sm btn-outline" onclick="viewUserScreenshots('${u.id}')">📸</button>` : ''}
        <button class="btn btn-sm btn-success" onclick="addUserBalance('${u.id}')">💰</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function addUserBalance(userId) {
  const users = DB.get('users', []);
  const user = users.find(u => u.id === userId);
  if (!user) return;
  const modal = document.getElementById('adminModal');
  document.getElementById('adminModalTitle').textContent = 'Add Balance to ' + user.username;
  document.getElementById('adminModalBody').innerHTML = `
    <div class="admin-form-group">
      <label>Amount (USDT)</label>
      <input type="number" id="addBalanceAmount" class="form-input" placeholder="Enter amount" step="0.01" min="0">
    </div>
  `;
  document.getElementById('adminModalFooter').innerHTML = `
    <button class="btn btn-outline btn-small" onclick="closeAdminModal()">Cancel</button>
    <button class="btn btn-success btn-small" onclick="confirmAddBalance('${userId}')">Add</button>
  `;
  modal.classList.add('active');
}

function confirmAddBalance(userId) {
  const amount = parseFloat(document.getElementById('addBalanceAmount').value);
  if (!amount || amount <= 0) {
    showToast('Enter a valid amount', 'error');
    return;
  }
  let users = DB.get('users', []);
  const user = users.find(u => u.id === userId);
  if (user) {
    user.balance += amount;
    DB.set('users', users);
    closeAdminModal();
    showToast(`Added $${amount.toFixed(2)} to ${user.username}`, 'success');
    notifyBalanceAdded(user, amount, adminUser?.username || 'admin');
    loadAdminUsers();
  }
}

function viewUserScreenshots(userId) {
  const users = DB.get('users', []);
  const user = users.find(u => u.id === userId);
  if (!user || !user.taskScreenshots) return;
  const tasks = DB.get('tasks', []);
  let html = '';
  for (const [taskId, ss] of Object.entries(user.taskScreenshots)) {
    const task = tasks.find(t => t.id === taskId);
    html += `
      <div style="margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-sm)">
        <div style="font-size:13px;font-weight:600;margin-bottom:4px">${task ? task.title : 'Unknown Task'}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Reward: ${task ? task.reward : '?'} USDT | ${user.claimedTasks.includes(taskId) ? '✅ Claimed' : '⏳ Pending'}</div>
        <img src="${ss}" style="width:100%;max-height:300px;object-fit:contain;border-radius:8px;background:var(--bg-primary)" onclick="window.open(this.src)">
      </div>
    `;
  }
  const modal = document.getElementById('adminModal');
  document.getElementById('adminModalTitle').textContent = '📸 Screenshots - ' + user.username;
  document.getElementById('adminModalBody').innerHTML = html || '<div class="empty-state"><p>No screenshots</p></div>';
  document.getElementById('adminModalFooter').innerHTML = '<button class="btn btn-outline btn-small" onclick="closeAdminModal()">Close</button>';
  modal.classList.add('active');
}

// ===== WITHDRAWALS =====
function loadAdminWithdrawals() {
  const container = document.getElementById('adminWithdrawalsList');
  let withdrawals = DB.get('withdrawals', []);
  if (withdrawals.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">💸</div><p>No withdrawals yet</p></div>';
    return;
  }
  const users = DB.get('users', []);
  container.innerHTML = '';
  withdrawals.slice().reverse().forEach(w => {
    const user = users.find(u => u.id === w.userId);
    const statusBtn = w.status === 'pending'
      ? `<button class="btn btn-sm btn-success" onclick="approveWithdraw('${w.id}')">✓ Approve</button>
         <button class="btn btn-sm btn-danger" onclick="rejectWithdraw('${w.id}')">✗ Reject</button>`
      : `<span class="withdraw-status status-${w.status}">${w.status}</span>`;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-color)';
    row.innerHTML = `
      <div>
        <div style="font-weight:600;font-size:14px">${user ? user.username : 'Unknown'}</div>
        <div style="font-size:12px;color:var(--text-muted)">-$${w.amount.toFixed(2)} | ${w.address?.substring(0, 10)}... | ${formatDate(w.createdAt)}</div>
      </div>
      <div class="admin-actions">${statusBtn}</div>
    `;
    container.appendChild(row);
  });
}

function approveWithdraw(id) {
  let withdrawals = DB.get('withdrawals', []);
  const w = withdrawals.find(w => w.id === id);
  if (w) {
    w.status = 'completed';
    DB.set('withdrawals', withdrawals);
    let users = DB.get('users', []);
    const user = users.find(u => u.id === w.userId);
    if (user) notifyWithdrawApproved(user, w.amount);
    showToast('Withdrawal approved!', 'success');
    loadAdminWithdrawals();
  }
}

function rejectWithdraw(id) {
  let withdrawals = DB.get('withdrawals', []);
  const w = withdrawals.find(w => w.id === id);
  if (w && w.status === 'pending') {
    w.status = 'rejected';
    let users = DB.get('users', []);
    const user = users.find(u => u.id === w.userId);
    if (user) {
      user.balance += w.amount;
      user.totalWithdrawn -= w.amount;
      DB.set('users', users);
    }
    DB.set('withdrawals', withdrawals);
    if (user) notifyWithdrawRejected(user, w.amount);
    showToast('Withdrawal rejected, balance refunded', 'info');
    loadAdminWithdrawals();
  }
}

// ===== GIFT CODES =====
function loadAdminGiftCodes() {
  const container = document.getElementById('adminGiftCodesList');
  let giftCodes = DB.get('giftCodes', []);
  if (giftCodes.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎁</div><p>No gift codes yet</p></div>';
    return;
  }
  container.innerHTML = '';
  giftCodes.slice().reverse().forEach(g => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-color)';
    row.innerHTML = `
      <div>
        <div style="font-weight:600;font-size:14px;font-family:monospace">${g.code}</div>
        <div style="font-size:12px;color:var(--text-muted)">${g.amount} USDT | ${g.redeemed ? 'Redeemed' : 'Available'}</div>
      </div>
      <button class="btn btn-sm btn-danger" onclick="deleteGiftCode('${g.id}')">🗑️</button>
    `;
    container.appendChild(row);
  });
}

function showAddGiftCodeForm() {
  const modal = document.getElementById('adminModal');
  document.getElementById('adminModalTitle').textContent = 'Create Gift Code';
  document.getElementById('adminModalBody').innerHTML = `
    <div class="admin-form-group">
      <label>Code (leave empty for random)</label>
      <input type="text" id="gcCode" class="form-input" placeholder="EARN2024" style="text-transform:uppercase">
    </div>
    <div class="admin-form-group">
      <label>Amount (USDT)</label>
      <input type="number" id="gcAmount" class="form-input" placeholder="Enter amount" step="0.01" min="0.01">
    </div>
  `;
  document.getElementById('adminModalFooter').innerHTML = `
    <button class="btn btn-outline btn-small" onclick="closeAdminModal()">Cancel</button>
    <button class="btn btn-gold btn-small" onclick="confirmCreateGiftCode()">Create</button>
  `;
  modal.classList.add('active');
}

function confirmCreateGiftCode() {
  let code = document.getElementById('gcCode').value.trim().toUpperCase();
  const amount = parseFloat(document.getElementById('gcAmount').value);
  if (!amount || amount <= 0) {
    showToast('Enter a valid amount', 'error');
    return;
  }
  if (!code) {
    code = 'GIFT' + Math.random().toString(36).substr(2, 6).toUpperCase();
  }
  let giftCodes = DB.get('giftCodes', []);
  if (giftCodes.find(g => g.code === code)) {
    showToast('Code already exists!', 'error');
    return;
  }
  giftCodes.push({
    id: uid(),
    code,
    amount,
    redeemed: false,
    redeemedBy: null,
    redeemedAt: null,
    createdAt: new Date().toISOString()
  });
  DB.set('giftCodes', giftCodes);
  closeAdminModal();
  showToast(`Gift code ${code} created for ${amount} USDT!`, 'success');
  loadAdminGiftCodes();
}

function deleteGiftCode(id) {
  if (!confirm('Delete this gift code?')) return;
  let giftCodes = DB.get('giftCodes', []);
  giftCodes = giftCodes.filter(g => g.id !== id);
  DB.set('giftCodes', giftCodes);
  showToast('Gift code deleted', 'info');
  loadAdminGiftCodes();
}

// ===== SETTINGS =====
function loadAdminSettings() {
  const settings = DB.get('settings', {});
  document.getElementById('setMinWithdraw').value = settings.minWithdraw || 1;
  document.getElementById('setRefPercent').value = settings.refPercent || 10;
  document.getElementById('setSiteName').value = settings.siteName || 'EarnHub';
  document.getElementById('setAdminMessage').value = settings.adminMessage || '';
  document.getElementById('setBotToken').value = settings.botToken || '';
  document.getElementById('setAdminChatId').value = settings.adminChatId || '';
}

function saveAdminSettings() {
  const settings = {
    minWithdraw: parseFloat(document.getElementById('setMinWithdraw').value) || 1,
    refPercent: parseFloat(document.getElementById('setRefPercent').value) || 10,
    siteName: document.getElementById('setSiteName').value.trim() || 'EarnHub',
    adminMessage: document.getElementById('setAdminMessage').value.trim(),
    botToken: document.getElementById('setBotToken').value.trim(),
    adminChatId: document.getElementById('setAdminChatId').value.trim()
  };
  DB.set('settings', settings);
  sendTelegramMessage('⚙️ <b>EarnHub Bot Settings Updated</b>\nBot is now active!');
  showToast('Settings saved!', 'success');
}

// ===== MODAL =====
function closeAdminModal() {
  document.getElementById('adminModal').classList.remove('active');
}

// ===== BULK ACTIONS =====
function deleteAllUsers() {
  if (!confirm('⚠️ Delete ALL users? This cannot be undone!')) return;
  if (!confirm('Are you sure?')) return;
  DB.set('users', []);
  showToast('All users deleted', 'info');
  loadAdminDashboard();
  loadAdminUsers();
}

function deleteAllTasks() {
  if (!confirm('Delete ALL tasks?')) return;
  DB.set('tasks', []);
  showToast('All tasks deleted', 'info');
  loadAdminDashboard();
  loadAdminTasks();
}
