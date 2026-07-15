let currentUser = null;

function $(id) { return document.getElementById(id); }

function showToast(msg, type = 'info') {
  const container = $('toastContainer') || (() => {
    const c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.remove(); }, 3000);
}

function showConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  const colors = ['#ffd700', '#ff6b6b', '#00ff88', '#00d4ff', '#ff8c00', '#ff00ff'];
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[i % colors.length];
    piece.style.width = (Math.random() * 8 + 4) + 'px';
    piece.style.height = (Math.random() * 8 + 4) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    container.appendChild(piece);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 2500);
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e[k] = v;
    else if (k === 'className') e.className = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

// ===== NAVIGATION =====
function navigateTo(page) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const section = $(page + 'Page');
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (section) section.classList.add('active');
  if (navItem) navItem.classList.add('active');
  if (page === 'home') renderHome();
  if (page === 'tasks') renderTasks();
  if (page === 'ads') renderAds();
  if (page === 'profile') renderProfile();
}

// ===== AUTH =====
function showAuthForm(form) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.querySelector(`.auth-tab[data-form="${form}"]`)?.classList.add('active');
  $(form + 'Form')?.classList.add('active');
  $('authError').textContent = '';
}

function handleLogin() {
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value.trim();
  if (!username || !password) {
    $('authError').textContent = 'Please fill in all fields';
    return;
  }
  const users = DB.get('users', []);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    $('authError').textContent = 'Invalid username or password';
    return;
  }
  const tgUser = TelegramApp.getUser();
  if (tgUser && !user.telegramId) {
    user.telegramId = tgUser.id;
    user.telegramUsername = tgUser.username || null;
    user.telegramName = tgUser.first_name || null;
    user.telegramChatId = tgUser.id || null;
    let allUsers = DB.get('users', []);
    const idx = allUsers.findIndex(u => u.id === user.id);
    if (idx !== -1) { allUsers[idx] = user; DB.set('users', allUsers); }
  }
  currentUser = user;
  localStorage.setItem('earnhub_session', JSON.stringify({ userId: user.id }));
  enterApp();
}

function handleRegister() {
  const username = $('regUsername').value.trim();
  const password = $('regPassword').value.trim();
  const email = $('regEmail').value.trim();
  const phone = $('regPhone').value.trim();
  const refCode = $('regRef').value.trim();
  if (!username || !password || !email || !phone) {
    $('authError').textContent = 'Please fill in all fields';
    return;
  }
  if (username.length < 3) {
    $('authError').textContent = 'Username must be at least 3 characters';
    return;
  }
  if (password.length < 4) {
    $('authError').textContent = 'Password must be at least 4 characters';
    return;
  }
  if (!email.includes('@') || !email.includes('.')) {
    $('authError').textContent = 'Enter a valid email address';
    return;
  }
  if (phone.length < 8) {
    $('authError').textContent = 'Enter a valid phone number';
    return;
  }
  let users = DB.get('users', []);
  if (users.find(u => u.username === username)) {
    $('authError').textContent = 'Username already exists';
    return;
  }
  const tgUser = TelegramApp.getUser();
  const newUser = {
    id: uid(),
    username,
    password,
    email,
    phone,
    telegramId: tgUser?.id || null,
    telegramUsername: tgUser?.username || null,
    telegramName: tgUser?.first_name || null,
    telegramChatId: tgUser?.id || null,
    balance: 0,
    completedTasks: [],
    claimedTasks: [],
    taskScreenshots: {},
    totalWithdrawn: 0,
    usdtAddress: '',
    referredBy: '',
    referralCode: String(tgUser?.id || uid()),
    referrals: [],
    referralEarnings: 0,
    createdAt: new Date().toISOString(),
    giftCodesRedeemed: []
  };
  if (refCode) {
    const referrer = users.find(u => u.referralCode === refCode || u.telegramId == refCode || u.telegramChatId == refCode);
    if (referrer) {
      newUser.referredBy = referrer.id;
    }
  }
  users.push(newUser);
  DB.set('users', users);
  currentUser = newUser;
  localStorage.setItem('earnhub_session', JSON.stringify({ userId: newUser.id }));
  notifyNewUser(newUser);
  if (newUser.referredBy) {
    const referrer = users.find(u => u.id === newUser.referredBy);
    if (referrer) {
      showToast(`You were referred by ${referrer.username}!`, 'success');
    }
  }
  enterApp();
}

function enterApp() {
  $('authContainer').style.display = 'none';
  $('appContainer').style.display = 'block';
  updateHeader();
  navigateTo('home');
}

function logout() {
  localStorage.removeItem('earnhub_session');
  currentUser = null;
  $('authContainer').style.display = 'flex';
  $('appContainer').style.display = 'none';
  $('loginUsername').value = '';
  $('loginPassword').value = '';
}

function updateHeader() {
  if (!currentUser) return;
  $('headerBalance').textContent = '$' + currentUser.balance.toFixed(2);
  $('welcomeName').textContent = currentUser.username;
  $('welcomeBalance').textContent = '$' + currentUser.balance.toFixed(2);
}

function saveCurrentUser() {
  if (!currentUser) return;
  let users = DB.get('users', []);
  const idx = users.findIndex(u => u.id === currentUser.id);
  if (idx !== -1) {
    users[idx] = currentUser;
    DB.set('users', users);
  }
}

// ===== HOME =====
function renderHome() {
  if (!currentUser) return;
  updateHeader();
  $('statTasks').textContent = currentUser.completedTasks.length;
  $('statEarnings').textContent = '$' + currentUser.balance.toFixed(2);
  $('statReferrals').textContent = currentUser.referrals.length;
  $('statWithdrawn').textContent = '$' + currentUser.totalWithdrawn.toFixed(2);
  $('homeRefLink').value = getRefUrl();
  renderQuickTasks();
}

function renderQuickTasks() {
  const container = $('quickTasks');
  const tasks = DB.get('tasks', []).filter(t => t.active !== false);
  const recent = tasks.slice(0, 3);
  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No tasks available yet</p></div>';
    return;
  }
  container.innerHTML = '';
  recent.forEach(t => {
    const isCompleted = currentUser.completedTasks.includes(t.id);
    const isClaimed = currentUser.claimedTasks.includes(t.id);
    const card = el('div', { className: 'task-card animate-fade-in' },
      el('div', { className: 'task-card-header' },
        el('div', { className: 'task-title' }, t.title),
        el('div', { className: 'task-reward' }, '+' + t.reward + ' USDT')
      ),
      el('div', { className: 'task-description' }, t.description?.substring(0, 80) + '...'),
      el('div', { className: 'task-actions' },
        el('button', {
          className: 'task-btn btn-open-task',
          onclick: () => {
            if (t.link) window.open(t.link, '_blank');
            else showToast('No link provided', 'error');
          }
        }, '🔗 Open'),
        el('button', {
          className: 'task-btn btn-claim',
          disabled: isCompleted && isClaimed,
          onclick: () => claimTask(t.id)
        }, isClaimed ? '✓ Claimed' : isCompleted ? '💰 Claim' : '⏳ Complete First')
      ),
      el('div', { className: 'task-status ' + (isClaimed ? 'status-claimed' : isCompleted ? 'status-completed' : 'status-pending') },
        isClaimed ? '✓ Claimed' : isCompleted ? 'Completed - Click Claim' : 'Pending'
      )
    );
    container.appendChild(card);
  });
}

// ===== TASKS =====
function renderTasks(filter = 'all') {
  const container = $('tasksContainer');
  const tasks = DB.get('tasks', []).filter(t => t.active !== false);
  if (tasks.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No tasks available. Check back later!</p></div>';
    return;
  }
  let filtered = tasks;
  if (filter === 'available') {
    filtered = tasks.filter(t => !currentUser.claimedTasks.includes(t.id));
  } else if (filter === 'completed') {
    filtered = tasks.filter(t => currentUser.claimedTasks.includes(t.id));
  }
  container.innerHTML = '';
  filtered.forEach((t, i) => {
  const isCompleted = currentUser.completedTasks.includes(t.id);
  const isClaimed = currentUser.claimedTasks.includes(t.id);
  const ss = currentUser.taskScreenshots?.[t.id];
  const ssStatus = ss ? (typeof ss === 'string' ? 'pending' : (ss.status || 'pending')) : null;
  const card = el('div', {
    className: 'task-card',
    style: `animation-delay: ${i * 0.05}s`
  },
    el('div', { className: 'task-card-header' },
      el('div', { className: 'task-title' }, t.title),
      el('div', { className: 'task-reward' }, '+' + t.reward + ' USDT')
    ),
    el('div', { className: 'task-description' }, t.description || 'No description'),
    el('div', { className: 'task-actions' },
      el('button', {
        className: 'task-btn btn-open-task',
        onclick: () => {
          if (t.link) {
            window.open(t.link, '_blank');
            markTaskCompleted(t.id);
          } else showToast('No link provided', 'error');
        }
      }, isCompleted && !isClaimed ? '✅ Re-Open' : isClaimed ? '✅ Done' : '🔗 Open Task'),
      isCompleted && !isClaimed ? el('button', {
        className: 'task-btn',
        style: ssStatus === 'pending' ? 'background:var(--accent-gold);color:var(--bg-primary);border:none' : 'background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color)',
        onclick: () => uploadScreenshot(t.id)
      }, ssStatus === 'pending' ? '⏳ Pending' : ssStatus === 'approved' ? '✅ Approved' : '📸 Screenshot') : null
    ),
    el('div', { className: `task-status ${isClaimed ? 'status-claimed' : ssStatus === 'pending' ? 'status-pending' : ssStatus === 'approved' ? 'status-completed' : 'status-pending'}` },
      isClaimed ? '✓ Reward Received' : ssStatus === 'pending' ? '⏳ Pending Admin Approval' : ssStatus === 'approved' ? '✅ Approved - Check Balance' : isCompleted ? '📸 Upload Screenshot' : '⏳ Click "Open Task" to start'
    )
  );
    container.appendChild(card);
  });
}

function uploadScreenshot(taskId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('File too large! Max 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (!currentUser.taskScreenshots) currentUser.taskScreenshots = {};
      currentUser.taskScreenshots[taskId] = { data: ev.target.result, status: 'pending' };
      saveCurrentUser();
      renderTasks();
      renderHome();
      sendTelegramMessage(`<b>📸 Screenshot Uploaded</b>\n\n<b>User:</b> ${currentUser.username}\n<b>Task ID:</b> ${taskId}\n<b>Status:</b> Pending Approval\n\nCheck admin panel to review.`);
      showToast('Screenshot uploaded! Waiting for admin approval ⏳', 'info');
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function markTaskCompleted(taskId) {
  if (!currentUser.completedTasks.includes(taskId)) {
    currentUser.completedTasks.push(taskId);
    saveCurrentUser();
    showToast('Task opened! Upload screenshot as proof then claim', 'info');
    renderTasks();
  }
}

function claimTask(taskId) {
  if (currentUser.claimedTasks.includes(taskId)) {
    showToast('Already claimed this task!', 'info');
    return;
  }
  if (!currentUser.completedTasks.includes(taskId)) {
    showToast('Open the task first!', 'error');
    return;
  }
  const tasks = DB.get('tasks', []);
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    showToast('Task not found!', 'error');
    return;
  }
  currentUser.claimedTasks.push(taskId);
  currentUser.balance += task.reward;
  saveCurrentUser();
  updateHeader();
  showConfetti();
  showToast(`+${task.reward} USDT Earned! 🎉`, 'success');
  notifyTaskClaimed(currentUser, task.title, task.reward);
  renderTasks();
  renderHome();
}

// ===== ADS =====
function renderAds() {
  const container = $('adsContainer');
  const ads = DB.get('ads', []).filter(a => a.active !== false);
  const settings = DB.get('settings', {});
  const maxAds = settings.maxAdsPerUser || 10;
  const adTimer = settings.adTimer || 6;
  if (!currentUser.watchedAds) currentUser.watchedAds = {};
  const today = new Date().toDateString();
  if (!currentUser.watchedAds[today]) currentUser.watchedAds[today] = [];
  const todayCount = currentUser.watchedAds[today].length;

  if (ads.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📢</div><p>No ads available. Check back later!</p></div>';
    return;
  }
  container.innerHTML = '';

  if (todayCount >= maxAds) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>You've watched all ${maxAds} ads for today! Come back tomorrow.</p></div>`;
    return;
  }

  const remaining = maxAds - todayCount;
  container.innerHTML = `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">📊 Today: ${todayCount}/${maxAds} ads watched</div>`;

  ads.forEach((ad, i) => {
    const alreadyWatched = currentUser.watchedAds[today].includes(ad.id);
    if (alreadyWatched) return;

    const card = el('div', {
      className: 'ad-card',
      style: `animation-delay: ${i * 0.1}s`
    },
      el('div', { className: 'ad-image' },
        ad.image ? el('img', { src: ad.image, alt: ad.title }) : document.createTextNode('📢')
      ),
      el('div', { className: 'ad-content' },
        el('div', { className: 'ad-title' }, ad.title),
        el('div', { className: 'ad-payout' }, '💰 Earn: ' + ad.payout + ' USDT'),
        ad.description ? el('div', { style: 'font-size:13px;color:var(--text-secondary);margin-bottom:12px' }, ad.description) : null,
        el('button', {
          className: 'ad-btn',
          onclick: () => startAdTimer(ad)
        }, '👀 Watch Ad - ' + adTimer + 's')
      )
    );
    container.appendChild(card);
  });
}

let activeAdTimer = null;

function startAdTimer(ad) {
  if (activeAdTimer) {
    showToast('Already watching an ad!', 'error');
    return;
  }
  const settings = DB.get('settings', {});
  const adTimer = settings.adTimer || 6;

  if (!ad.link) { showToast('Ad link not available', 'error'); return; }

  const modal = $('withdrawModal');
  $('withdrawModalTitle').textContent = '👀 Watch Ad';
  $('withdrawModalBody').innerHTML = `
    <div style="text-align:center;padding:20px">
      <div style="font-size:48px;margin-bottom:12px">📢</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:8px">${ad.title}</div>
      <div style="font-size:14px;color:var(--text-secondary);margin-bottom:16px">💰 +${ad.payout} USDT</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Please wait... Do not close!</div>
      <div style="font-size:14px;color:var(--accent-gold);font-weight:700;margin-bottom:8px">
        <span id="adTimerDisplay">${adTimer}</span>s remaining
      </div>
      <div style="width:100%;height:6px;background:var(--bg-secondary);border-radius:3px;overflow:hidden">
        <div id="adTimerBar" style="height:100%;width:100%;background:var(--gradient-gold);border-radius:3px;transition:width 1s linear"></div>
      </div>
    </div>
  `;
  $('withdrawModalFooter').innerHTML = `<button class="btn btn-outline btn-small" onclick="cancelAdTimer()">✕ Close</button>`;
  modal.classList.add('active');

  window.open(ad.link, '_blank');

  let remaining = adTimer;
  const display = $('adTimerDisplay');
  const bar = $('adTimerBar');
  let cancelled = false;

  activeAdTimer = setInterval(() => {
    remaining--;
    if (display) display.textContent = remaining;
    if (bar) bar.style.width = (remaining / adTimer * 100) + '%';
    if (remaining <= 0) {
      clearInterval(activeAdTimer);
      activeAdTimer = null;
      if (!cancelled) {
        if (!currentUser.watchedAds) currentUser.watchedAds = {};
        const today = new Date().toDateString();
        if (!currentUser.watchedAds[today]) currentUser.watchedAds[today] = [];
        currentUser.watchedAds[today].push(ad.id);
        currentUser.balance += ad.payout;
        saveCurrentUser();
        updateHeader();
        closeModal('withdrawModal');
        showToast(`+${ad.payout} USDT from ad! 🎉`, 'success');
        sendTelegramMessage(`<b>📢 Ad Watched</b>\n\n<b>User:</b> ${currentUser.username}\n<b>Ad:</b> ${ad.title}\n<b>Earned:</b> +${ad.payout} USDT`);
        renderAds();
      }
    }
  }, 1000);
}

function cancelAdTimer() {
  if (activeAdTimer) {
    clearInterval(activeAdTimer);
    activeAdTimer = null;
  }
  closeModal('withdrawModal');
  showToast('❌ Ad cancelled! No reward added.', 'error');
}

// ===== PROFILE =====
function loadTelegramProfilePic() {
  const tgId = currentUser.telegramId || currentUser.telegramChatId;
  if (!tgId) return;
  const { token } = getBotSettings();
  if (!token) return;
  fetch(`https://api.telegram.org/bot${token}/getUserProfilePhotos?user_id=${tgId}&limit=1`)
    .then(r => r.json())
    .then(d => {
      if (d.ok && d.result?.photos?.length > 0) {
        const fileId = d.result.photos[0][0].file_id;
        fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)
          .then(r2 => r2.json())
          .then(d2 => {
            if (d2.ok && d2.result?.file_path) {
              const url = `https://api.telegram.org/file/bot${token}/${d2.result.file_path}`;
              const img = $('profileAvatarImg');
              const letter = $('profileAvatarLetter');
              if (img) { img.src = url; img.style.display = 'inline'; if (letter) letter.style.display = 'none'; }
            }
          }).catch(() => {});
      }
    }).catch(() => {});
}

function renderProfile() {
  if (!currentUser) return;
  const tgName = currentUser.telegramName || currentUser.telegramUsername || currentUser.username;
  $('profileName').textContent = tgName;
  $('profileAvatarLetter').textContent = tgName.charAt(0).toUpperCase();
  $('profileAvatarImg').style.display = 'none';
  $('profileAvatarLetter').style.display = 'inline';
  loadTelegramProfilePic();
  if (currentUser.telegramUsername) {
    $('profileTgUsername').textContent = '@' + currentUser.telegramUsername;
  } else {
    $('profileTgUsername').textContent = currentUser.email ? '✉️ ' + currentUser.email : 'EarnHub Member';
  }
  $('profileBalance').textContent = '$' + currentUser.balance.toFixed(2);
  $('profileTasks').textContent = currentUser.completedTasks.length;
  $('profileWithdrawn').textContent = '$' + currentUser.totalWithdrawn.toFixed(2);
  $('profileReferrals').textContent = currentUser.referrals.length;
  $('profileRefEarnings').textContent = '$' + currentUser.referralEarnings.toFixed(2);
  $('profileRefLink').value = getRefUrl();
  $('profileUsdtAddress').value = currentUser.usdtAddress || '';
  renderMessageBox();
  renderWithdrawHistory();
  showAdminNav();
  if (isAdmin()) {
    $('profileAdminLogin').style.display = 'none';
  } else {
    $('profileAdminLogin').style.display = 'block';
  }
}

function getRefUrl() {
  const chatId = currentUser.telegramId || currentUser.telegramChatId || currentUser.referralCode;
  return `https://t.me/earn_hub_task_bot?start=${chatId}`;
}

function copyRefLink() {
  const input = $('profileRefLink');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    showToast('Referral link copied! Share it with friends', 'success');
  }).catch(() => {
    document.execCommand('copy');
    showToast('Referral link copied!', 'success');
  });
}

function saveUsdtAddress() {
  const addr = $('profileUsdtAddress').value.trim();
  if (!addr) {
    showToast('Please enter a USDT BEP20 address', 'error');
    return;
  }
  currentUser.usdtAddress = addr;
  saveCurrentUser();
  showToast('Address saved successfully!', 'success');
}

function renderMessageBox() {
  const settings = DB.get('settings', {});
  const msg = settings.adminMessage || 'Welcome to EarnHub! Complete tasks and earn USDT. Invite friends to earn 10% commission.';
  $('profileMessage').textContent = msg;
}

function renderWithdrawHistory() {
  const container = $('withdrawHistory');
  const withdrawals = DB.get('withdrawals', []).filter(w => w.userId === currentUser.id);
  if (withdrawals.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">No withdrawal history</div>';
    return;
  }
  container.innerHTML = '';
  withdrawals.slice().reverse().forEach(w => {
    const item = el('div', { className: 'withdraw-item' },
      el('div', {},
        el('div', { className: 'withdraw-amount' }, '-' + w.amount + ' USDT'),
        el('div', { style: 'font-size:12px;color:var(--text-muted)' }, formatDate(w.createdAt))
      ),
      el('span', { className: 'withdraw-status status-' + w.status },
        w.status.charAt(0).toUpperCase() + w.status.slice(1)
      )
    );
    container.appendChild(item);
  });
}

function requestWithdraw() {
  if (!currentUser.usdtAddress) {
    showToast('Please save your USDT BEP20 address first!', 'error');
    return;
  }
  const settings = DB.get('settings', {});
  const minWithdraw = settings.minWithdraw || 1;
  const modal = $('withdrawModal');
  $('withdrawModalTitle').textContent = 'Withdraw USDT';
  $('withdrawModalBody').innerHTML = `
    <div style="margin-bottom:12px">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px">Available Balance</div>
      <div style="font-size:24px;font-weight:900;color:var(--accent-gold)">$${currentUser.balance.toFixed(2)}</div>
    </div>
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px">Minimum Withdraw: $${minWithdraw}</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Address: ${currentUser.usdtAddress}</div>
    <div class="form-group">
      <label>Amount (USDT)</label>
      <input type="number" id="withdrawAmount" class="form-input" placeholder="Enter amount" min="${minWithdraw}" step="0.01">
    </div>
  `;
  $('withdrawModalFooter').innerHTML = `
    <button class="btn btn-outline btn-small" onclick="closeModal('withdrawModal')">Cancel</button>
    <button class="btn btn-gold btn-small" onclick="submitWithdraw()">Withdraw</button>
  `;
  modal.classList.add('active');
}

function submitWithdraw() {
  const amount = parseFloat($('withdrawAmount')?.value);
  const settings = DB.get('settings', {});
  const minWithdraw = settings.minWithdraw || 1;
  if (!amount || amount < minWithdraw) {
    showToast(`Minimum withdrawal is $${minWithdraw}`, 'error');
    return;
  }
  if (amount > currentUser.balance) {
    showToast('Insufficient balance!', 'error');
    return;
  }
  const withdrawal = {
    id: uid(),
    userId: currentUser.id,
    amount: amount,
    address: currentUser.usdtAddress,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  let withdrawals = DB.get('withdrawals', []);
  withdrawals.push(withdrawal);
  DB.set('withdrawals', withdrawals);
  currentUser.balance -= amount;
  currentUser.totalWithdrawn += amount;
  saveCurrentUser();
  closeModal('withdrawModal');
  updateHeader();
  showConfetti();
  showToast(`Withdrawal request for $${amount} submitted!`, 'success');
  notifyWithdrawRequest(currentUser, amount, currentUser.usdtAddress);
  renderProfile();
}

function claimGiftCode() {
  const code = $('giftCodeInput').value.trim().toUpperCase();
  if (!code) {
    showToast('Enter a gift code!', 'error');
    return;
  }
  let giftCodes = DB.get('giftCodes', []);
  const gc = giftCodes.find(g => g.code === code);
  if (!gc) {
    showToast('Invalid gift code!', 'error');
    return;
  }
  if (gc.redeemed) {
    showToast('This code has already been used!', 'error');
    return;
  }
  if (currentUser.giftCodesRedeemed?.includes(gc.id)) {
    showToast('You already redeemed this code!', 'error');
    return;
  }
  gc.redeemed = true;
  gc.redeemedBy = currentUser.id;
  gc.redeemedAt = new Date().toISOString();
  if (!currentUser.giftCodesRedeemed) currentUser.giftCodesRedeemed = [];
  currentUser.giftCodesRedeemed.push(gc.id);
  currentUser.balance += gc.amount;
  saveCurrentUser();
  DB.set('giftCodes', giftCodes);
  updateHeader();
  $('giftCodeInput').value = '';
  showConfetti();
  showToast(`Gift Code Redeemed! +${gc.amount} USDT 🎉`, 'success');
  notifyGiftCodeRedeemed(currentUser, gc.code, gc.amount);
  renderProfile();
}

function isAdmin() {
  if (!currentUser) return false;
  const settings = DB.get('settings', {});
  const adminChatId = settings.adminChatId || ADMIN_CHAT_ID;
  return currentUser.telegramId == adminChatId || currentUser.username === 'admin' || localStorage.getItem('earnhub_admin_unlocked') === 'true';
}

function unlockAdmin() {
  const pass = $('profileAdminPass').value.trim();
  const admin = DB.get('admin', {});
  if (pass === admin.password) {
    localStorage.setItem('earnhub_admin_unlocked', 'true');
    showToast('Admin unlocked! ✅', 'success');
    $('profileAdminLogin').style.display = 'none';
    showAdminNav();
  } else {
    showToast('Wrong password!', 'error');
  }
}

function showAdminNav() {
  const btn = $('adminNavBtn');
  if (btn && isAdmin()) btn.style.display = 'flex';
}

function navigateTo(page) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const section = $(page + 'Page');
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (section) section.classList.add('active');
  if (navItem) navItem.classList.add('active');
  if (page === 'home') renderHome();
  if (page === 'tasks') renderTasks();
  if (page === 'ads') renderAds();
  if (page === 'profile') renderProfile();
  if (page === 'admin') renderMiniAdmin();
}

function renderMiniAdmin() {
  if (!isAdmin()) { showToast('Admin access required', 'error'); navigateTo('home'); return; }
  loadMiniDashboard();
  loadMiniTasks();
  loadMiniAds();
  loadMiniUsers();
  loadMiniWithdrawals();
  loadMiniGifts();
  loadMiniSettings();
}

function adminNav(tab) {
  document.querySelectorAll('#adminPage .admin-nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#adminPage .admin-tab').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`#adminPage .admin-nav-btn[data-tab="${tab}"]`);
  const tabEl = $('admin' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab');
  if (btn) btn.classList.add('active');
  if (tabEl) tabEl.classList.add('active');
  if (tab === 'dashboard') loadMiniDashboard();
}

function loadMiniDashboard() {
  const users = DB.get('users', []);
  const tasks = DB.get('tasks', []);
  const withdrawals = DB.get('withdrawals', []);
  $('miniTotalUsers').textContent = users.length;
  $('miniTotalTasks').textContent = tasks.length;
  $('miniPendingWithdrawals').textContent = withdrawals.filter(w => w.status === 'pending').length;
  $('miniTotalBalance').textContent = '$' + users.reduce((s, u) => s + u.balance, 0).toFixed(2);
  const ssCount = users.filter(u => u.taskScreenshots && Object.values(u.taskScreenshots).some(s => (typeof s === 'string' ? 'pending' : (s.status || 'pending')) === 'pending')).length;
  $('miniPendingScreens').textContent = ssCount + ' pending';
}

// ---- MINI TASKS ----
function loadMiniTasks() {
  const container = $('miniTasksList');
  const tasks = DB.get('tasks', []);
  if (!tasks.length) { container.innerHTML = '<div class="empty-state"><p>No tasks</p></div>'; return; }
  container.innerHTML = '';
  tasks.slice().reverse().forEach(t => {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-color)';
    d.innerHTML = `<div><div style="font-weight:600;font-size:13px">${t.title}</div><div style="font-size:11px;color:var(--text-muted)">${t.reward} USDT</div></div>
      <div style="display:flex;gap:4px"><button class="btn btn-sm btn-outline" onclick="miniEditTask('${t.id}')">✏️</button><button class="btn btn-sm btn-danger" onclick="miniDeleteTask('${t.id}')">🗑️</button></div>`;
    container.appendChild(d);
  });
}

function miniShowAddTask() {
  $('miniTaskId').value = '';
  $('miniTaskTitle').value = '';
  $('miniTaskLink').value = '';
  $('miniTaskDesc').value = '';
  $('miniTaskReward').value = '';
  $('miniTaskForm').style.display = 'block';
}

function miniHideTaskForm() { $('miniTaskForm').style.display = 'none'; }

function miniSaveTask() {
  const id = $('miniTaskId').value;
  const title = $('miniTaskTitle').value.trim();
  const link = $('miniTaskLink').value.trim();
  const desc = $('miniTaskDesc').value.trim();
  const reward = parseFloat($('miniTaskReward').value);
  if (!title || !reward) { showToast('Title & reward required', 'error'); return; }
  let tasks = DB.get('tasks', []);
  if (id) { const t = tasks.find(t => t.id === id); if (t) { t.title = title; t.link = link; t.description = desc; t.reward = reward; } }
  else tasks.push({ id: uid(), title, link, description: desc, reward, active: true, createdAt: new Date().toISOString() });
  DB.set('tasks', tasks); broadcastData(); miniHideTaskForm(); loadMiniTasks(); showToast('Task saved!', 'success');
}

function miniEditTask(id) {
  const tasks = DB.get('tasks', []);
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  $('miniTaskId').value = t.id;
  $('miniTaskTitle').value = t.title;
  $('miniTaskLink').value = t.link || '';
  $('miniTaskDesc').value = t.description || '';
  $('miniTaskReward').value = t.reward;
  $('miniTaskForm').style.display = 'block';
}

function miniDeleteTask(id) {
  if (!confirm('Delete task?')) return;
  let tasks = DB.get('tasks', []);
  tasks = tasks.filter(t => t.id !== id);
  DB.set('tasks', tasks); broadcastData(); loadMiniTasks();
}

// ---- MINI ADS ----
function loadMiniAds() {
  const container = $('miniAdsList');
  const ads = DB.get('ads', []);
  if (!ads.length) { container.innerHTML = '<div class="empty-state"><p>No ads</p></div>'; return; }
  container.innerHTML = '';
  ads.slice().reverse().forEach(a => {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-color)';
    d.innerHTML = `<div><div style="font-weight:600;font-size:13px">${a.title}</div><div style="font-size:11px;color:var(--text-muted)">${a.payout} USDT</div></div>
      <div style="display:flex;gap:4px"><button class="btn btn-sm btn-outline" onclick="miniEditAd('${a.id}')">✏️</button><button class="btn btn-sm btn-danger" onclick="miniDeleteAd('${a.id}')">🗑️</button></div>`;
    container.appendChild(d);
  });
}

function miniShowAddAd() {
  $('miniAdId').value = ''; $('miniAdTitle').value = ''; $('miniAdLink').value = '';
  $('miniAdDesc').value = ''; $('miniAdImage').value = ''; $('miniAdPayout').value = '';
  $('miniAdForm').style.display = 'block';
}

function miniHideAdForm() { $('miniAdForm').style.display = 'none'; }

function miniSaveAd() {
  const id = $('miniAdId').value;
  const title = $('miniAdTitle').value.trim();
  const link = $('miniAdLink').value.trim();
  const desc = $('miniAdDesc').value.trim();
  const image = $('miniAdImage').value.trim();
  const payout = parseFloat($('miniAdPayout').value);
  if (!title || !payout) { showToast('Title & payout required', 'error'); return; }
  let ads = DB.get('ads', []);
  if (id) { const a = ads.find(a => a.id === id); if (a) { a.title = title; a.link = link; a.description = desc; a.image = image; a.payout = payout; } }
  else ads.push({ id: uid(), title, link, description: desc, image, payout, active: true, createdAt: new Date().toISOString() });
  DB.set('ads', ads); broadcastData(); miniHideAdForm(); loadMiniAds(); showToast('Ad saved!', 'success');
}

function miniEditAd(id) {
  const ads = DB.get('ads', []); const a = ads.find(a => a.id === id);
  if (!a) return;
  $('miniAdId').value = a.id; $('miniAdTitle').value = a.title; $('miniAdLink').value = a.link || '';
  $('miniAdDesc').value = a.description || ''; $('miniAdImage').value = a.image || ''; $('miniAdPayout').value = a.payout;
  $('miniAdForm').style.display = 'block';
}

function miniDeleteAd(id) {
  if (!confirm('Delete ad?')) return;
  let ads = DB.get('ads', []); ads = ads.filter(a => a.id !== id);
  DB.set('ads', ads); broadcastData(); loadMiniAds();
}

// ---- MINI USERS ----
function loadMiniUsers() {
  const container = $('miniUsersList');
  const users = DB.get('users', []);
  if (!users.length) { container.innerHTML = '<div class="empty-state"><p>No users</p></div>'; return; }
  container.innerHTML = '';
  users.slice().reverse().forEach(u => {
    const hasSS = u.taskScreenshots && Object.keys(u.taskScreenshots).length > 0;
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-color)';
    d.innerHTML = `<div><div style="font-weight:600;font-size:13px">${u.username}${u.telegramUsername ? ' (@' + u.telegramUsername + ')' : ''}</div>
      <div style="font-size:11px;color:var(--text-muted)">$${u.balance.toFixed(2)} | Tasks:${u.completedTasks.length}${hasSS ? ' | 📸' + Object.keys(u.taskScreenshots).filter(k => {const s=u.taskScreenshots[k];return (typeof s === 'string' ? 'pending' : (s.status||'pending')) === 'pending';}).length : ''}</div></div>
      <div style="display:flex;gap:4px">${hasSS ? '<button class="btn btn-sm btn-outline" onclick="miniViewSS(\'' + u.id + '\')">📸</button>' : ''}<button class="btn btn-sm btn-success" onclick="miniAddBalance(\'' + u.id + '\')">💰</button></div>`;
    container.appendChild(d);
  });
}

function miniViewSS(userId) {
  const users = DB.get('users', []); const user = users.find(u => u.id === userId);
  if (!user || !user.taskScreenshots) return;
  const tasks = DB.get('tasks', []);
  let html = '';
  for (const [taskId, ss] of Object.entries(user.taskScreenshots)) {
    const task = tasks.find(t => t.id === taskId);
    const ssData = typeof ss === 'string' ? ss : ss.data;
    const ssStatus = typeof ss === 'string' ? 'pending' : (ss.status || 'pending');
    const claimed = user.claimedTasks && user.claimedTasks.includes(taskId);
    html += `<div style="margin-bottom:12px;padding:10px;background:var(--bg-secondary);border-radius:var(--radius-sm)">
      <div style="font-size:12px;font-weight:600">${task ? task.title : 'Unknown'} - ${task ? task.reward : '?'} USDT</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${claimed ? '✅ Paid' : ssStatus === 'approved' ? '✅ Approved' : ssStatus === 'rejected' ? '❌ Rejected' : '⏳ Pending'}</div>
      <img src="${ssData}" style="width:100%;max-height:200px;object-fit:contain;border-radius:6px;cursor:pointer;margin-bottom:6px" onclick="window.open(this.src)">
      ${!claimed && ssStatus === 'pending' ? `<div style="display:flex;gap:6px"><button class="btn btn-sm btn-success" onclick="miniApproveSS('${userId}','${taskId}',${task ? task.reward : 0})" style="flex:1">✅ Approve</button><button class="btn btn-sm btn-danger" onclick="miniRejectSS('${userId}','${taskId}')" style="flex:1">❌</button></div>` : ''}
    </div>`;
  }
  const m = $('withdrawModal');
  $('withdrawModalTitle').textContent = '📸 ' + user.username;
  $('withdrawModalBody').innerHTML = html;
  $('withdrawModalFooter').innerHTML = '<button class="btn btn-outline btn-small" onclick="closeModal(\'withdrawModal\')">Close</button>';
  m.classList.add('active');
}

function miniApproveSS(userId, taskId, reward) {
  let users = DB.get('users', []); const user = users.find(u => u.id === userId);
  if (!user || !user.taskScreenshots || !user.taskScreenshots[taskId]) return;
  const ss = user.taskScreenshots[taskId];
  if (typeof ss === 'string') user.taskScreenshots[taskId] = { data: ss, status: 'approved' };
  else ss.status = 'approved';
  if (!user.claimedTasks) user.claimedTasks = [];
  if (!user.claimedTasks.includes(taskId)) { user.claimedTasks.push(taskId); user.balance += reward; }
  DB.set('users', users);
  closeModal('withdrawModal');
  showToast(`✅ Approved! +${reward} USDT to ${user.username}`, 'success');
  sendTelegramMessage(`<b>✅ Screenshot Approved</b>\n\n<b>User:</b> ${user.username}\n<b>Reward:</b> +${reward} USDT`);
  loadMiniUsers(); loadMiniDashboard();
}

function miniRejectSS(userId, taskId) {
  let users = DB.get('users', []); const user = users.find(u => u.id === userId);
  if (!user || !user.taskScreenshots || !user.taskScreenshots[taskId]) return;
  const ss = user.taskScreenshots[taskId];
  if (typeof ss === 'string') user.taskScreenshots[taskId] = { data: ss, status: 'rejected' };
  else ss.status = 'rejected';
  DB.set('users', users);
  closeModal('withdrawModal');
  showToast('❌ Rejected', 'info');
  loadMiniUsers();
}

function miniAddBalance(userId) {
  const users = DB.get('users', []); const user = users.find(u => u.id === userId);
  if (!user) return;
  const m = $('withdrawModal');
  $('withdrawModalTitle').textContent = '💰 Edit Balance - ' + user.username;
  $('withdrawModalBody').innerHTML = `
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Current Balance: <span style="color:var(--accent-gold);font-weight:700">$${user.balance.toFixed(2)}</span></div>
    <div class="admin-form-group"><label>Set Balance (USDT)</label><input type="number" id="miniAddBalAmt" class="form-input" step="0.01" value="${user.balance}"></div>
    <div style="font-size:12px;color:var(--text-muted)">Enter new balance amount. Can be higher or lower than current.</div>`;
  $('withdrawModalFooter').innerHTML = `<button class="btn btn-outline btn-small" onclick="closeModal('withdrawModal')">Cancel</button>
    <button class="btn btn-success btn-small" onclick="miniConfirmAddBal('${userId}')">💾 Set</button>`;
  m.classList.add('active');
}

function miniConfirmAddBal(userId) {
  const amt = parseFloat($('miniAddBalAmt').value);
  if (amt === undefined || amt < 0 || isNaN(amt)) { showToast('Enter valid amount', 'error'); return; }
  let users = DB.get('users', []); const user = users.find(u => u.id === userId);
  if (user) {
    const diff = amt - user.balance;
    user.balance = amt;
    DB.set('users', users); closeModal('withdrawModal');
    showToast(`✅ Balance set to $${amt} for ${user.username}`, 'success');
    sendTelegramMessage(`<b>💰 Balance Updated</b>\n\n<b>User:</b> ${user.username}\n<b>New Balance:</b> $${amt}\n<b>Change:</b> ${diff >= 0 ? '+' : ''}${diff.toFixed(2)} USDT`);
    loadMiniUsers(); loadMiniDashboard(); }
}

// ---- MINI WITHDRAWALS ----
function loadMiniWithdrawals() {
  const container = $('miniWithdrawalsList');
  let withdrawals = DB.get('withdrawals', []); const users = DB.get('users', []);
  if (!withdrawals.length) { container.innerHTML = '<div class="empty-state"><p>No withdrawals</p></div>'; return; }
  container.innerHTML = '';
  withdrawals.slice().reverse().forEach(w => {
    const u = users.find(u => u.id === w.userId);
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-color)';
    d.innerHTML = `<div><div style="font-size:13px;font-weight:600">${u ? u.username : '?'}</div>
      <div style="font-size:11px;color:var(--text-muted)">-$${w.amount} | ${w.address?.substring(0,8)}...</div></div>
      <div>${w.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="miniApproveWD('${w.id}')">✓</button><button class="btn btn-sm btn-danger" onclick="miniRejectWD('${w.id}')">✗</button>` : `<span class="withdraw-status status-${w.status}">${w.status}</span>`}</div>`;
    container.appendChild(d);
  });
}

function miniApproveWD(id) {
  let wds = DB.get('withdrawals', []); const w = wds.find(w => w.id === id);
  if (w) { w.status = 'completed'; DB.set('withdrawals', wds); showToast('✅ Approved', 'success'); loadMiniWithdrawals(); loadMiniDashboard(); }
}

function miniRejectWD(id) {
  let wds = DB.get('withdrawals', []); const w = wds.find(w => w.id === id);
  if (w && w.status === 'pending') {
    w.status = 'rejected';
    let users = DB.get('users', []); const u = users.find(u => u.id === w.userId);
    if (u) { u.balance += w.amount; u.totalWithdrawn -= w.amount; DB.set('users', users); }
    DB.set('withdrawals', wds); showToast('❌ Rejected, refunded', 'info');
    loadMiniWithdrawals(); loadMiniDashboard();
  }
}

// ---- MINI GIFT CODES ----
function loadMiniGifts() {
  const container = $('miniGiftList');
  let codes = DB.get('giftCodes', []);
  if (!codes.length) { container.innerHTML = '<div class="empty-state"><p>No gift codes</p></div>'; return; }
  container.innerHTML = '';
  codes.slice().reverse().forEach(g => {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-color)';
    d.innerHTML = `<div><div style="font-family:monospace;font-weight:600;font-size:13px">${g.code}</div><div style="font-size:11px;color:var(--text-muted)">${g.amount} USDT | ${g.redeemed ? 'Redeemed' : 'Active'}</div></div>
      <button class="btn btn-sm btn-danger" onclick="miniDeleteGift('${g.id}')">🗑️</button>`;
    container.appendChild(d);
  });
}

function miniShowAddGift() {
  const m = $('withdrawModal');
  $('withdrawModalTitle').textContent = '🎁 Create Gift Code';
  $('withdrawModalBody').innerHTML = `<div class="admin-form-group"><label>Code</label><input type="text" id="miniGiftCode" class="form-input" placeholder="EARN2024"></div>
    <div class="admin-form-group"><label>Amount (USDT)</label><input type="number" id="miniGiftAmt" class="form-input" step="0.01"></div>`;
  $('withdrawModalFooter').innerHTML = `<button class="btn btn-outline btn-small" onclick="closeModal('withdrawModal')">Cancel</button>
    <button class="btn btn-gold btn-small" onclick="miniConfirmGift()">Create</button>`;
  m.classList.add('active');
}

function miniConfirmGift() {
  let code = $('miniGiftCode').value.trim().toUpperCase();
  const amt = parseFloat($('miniGiftAmt').value);
  if (!amt || amt <= 0) { showToast('Valid amount required', 'error'); return; }
  if (!code) code = 'GIFT' + Math.random().toString(36).substr(2, 6).toUpperCase();
  let codes = DB.get('giftCodes', []);
  if (codes.find(g => g.code === code)) { showToast('Code exists!', 'error'); return; }
  codes.push({ id: uid(), code, amount: amt, redeemed: false, redeemedBy: null, redeemedAt: null, createdAt: new Date().toISOString() });
  DB.set('giftCodes', codes); closeModal('withdrawModal');
  showToast(`🎁 ${code} = ${amt} USDT`, 'success'); loadMiniGifts();
}

function miniDeleteGift(id) {
  if (!confirm('Delete code?')) return;
  let codes = DB.get('giftCodes', []); codes = codes.filter(g => g.id !== id);
  DB.set('giftCodes', codes); loadMiniGifts();
}

// ---- MINI SETTINGS ----
function loadMiniSettings() {
  const s = DB.get('settings', {});
  $('miniSetMinWD').value = s.minWithdraw || 1;
  $('miniSetRef').value = s.refPercent || 10;
  $('miniSetMsg').value = s.adminMessage || '';
  if ($('miniSetAdCount')) $('miniSetAdCount').value = s.maxAdsPerUser || 10;
  if ($('miniSetAdTimer')) $('miniSetAdTimer').value = s.adTimer || 6;
}

function miniSaveSettings() {
  const s = {
    minWithdraw: parseFloat($('miniSetMinWD').value) || 1,
    refPercent: parseFloat($('miniSetRef').value) || 10,
    siteName: 'EarnHub',
    adminMessage: $('miniSetMsg').value.trim(),
    maxAdsPerUser: parseInt($('miniSetAdCount')?.value) || 10,
    adTimer: parseInt($('miniSetAdTimer')?.value) || 6,
    botToken: BOT_TOKEN, adminChatId: ADMIN_CHAT_ID
  };
  DB.set('settings', s); showToast('Settings saved!', 'success');
}

function refreshData() {
  showToast('Syncing latest data...', 'info');
  fetchDataFromTelegram(() => {
    showToast('Data synced successfully! ✅', 'success');
    if ($('homePage')?.classList.contains('active')) renderHome();
    if ($('tasksPage')?.classList.contains('active')) renderTasks();
    if ($('adsPage')?.classList.contains('active')) renderAds();
    if ($('adminPage')?.classList.contains('active')) renderMiniAdmin();
  });
}

function closeModal(id) {
  $(id)?.classList.remove('active');
}

// ===== TASK FILTERS =====
document.addEventListener('click', (e) => {
  const filterBtn = e.target.closest('.task-filter-btn');
  if (filterBtn) {
    document.querySelectorAll('.task-filter-btn').forEach(b => b.classList.remove('active'));
    filterBtn.classList.add('active');
    renderTasks(filterBtn.dataset.filter);
  }
});

// ===== AUTO-REGISTER FROM TELEGRAM =====
function autoRegisterFromTelegram() {
  const tgUser = TelegramApp.getUser();
  if (!tgUser) return false;

  let users = DB.get('users', []);
  let user = users.find(u => u.telegramId == tgUser.id || u.telegramChatId == tgUser.id);

  if (user) {
    user.telegramUsername = tgUser.username || user.telegramUsername;
    user.telegramName = tgUser.first_name || user.telegramName;
    currentUser = user;
    localStorage.setItem('earnhub_session', JSON.stringify({ userId: user.id }));
    DB.set('users', users);
    return true;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const refParam = urlParams.get('ref') || urlParams.get('start');
  let referredBy = '';
  if (refParam) {
    const referrer = users.find(u => u.telegramId == refParam || u.telegramChatId == refParam || u.referralCode == refParam);
    if (referrer) referredBy = referrer.id;
  }

  const newUser = {
    id: uid(),
    username: tgUser.username || 'tg_' + tgUser.id,
    password: 'tg_' + tgUser.id + '_pass',
    email: '',
    phone: '',
    telegramId: tgUser.id,
    telegramUsername: tgUser.username || null,
    telegramName: tgUser.first_name || null,
    telegramChatId: tgUser.id,
    balance: 0,
    completedTasks: [],
    claimedTasks: [],
    taskScreenshots: {},
    totalWithdrawn: 0,
    usdtAddress: '',
    referredBy: referredBy,
    referralCode: String(tgUser.id),
    referrals: [],
    referralEarnings: 0,
    createdAt: new Date().toISOString(),
    giftCodesRedeemed: []
  };

  if (referredBy) {
    const referrer = users.find(u => u.id === referredBy);
    if (referrer) {
      if (!referrer.referrals) referrer.referrals = [];
      if (!referrer.referrals.includes(newUser.id)) referrer.referrals.push(newUser.id);
    }
  }

  users.push(newUser);
  DB.set('users', users);
  currentUser = newUser;
  localStorage.setItem('earnhub_session', JSON.stringify({ userId: newUser.id }));
  notifyNewUser(newUser);
  return true;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  TelegramApp.init();

  fetchDataFromTelegram(() => {
    if (autoRegisterFromTelegram()) {
      $('authContainer').style.display = 'none';
      $('appContainer').style.display = 'block';
      updateHeader();
      navigateTo('home');
      return;
    }

    const session = JSON.parse(localStorage.getItem('earnhub_session') || 'null');
    if (session) {
      const users = DB.get('users', []);
      const user = users.find(u => u.id === session.userId);
      if (user) {
        currentUser = user;
        $('authContainer').style.display = 'none';
        $('appContainer').style.display = 'block';
        updateHeader();
        navigateTo('home');
        return;
      }
    }
    $('authContainer').style.display = 'flex';
    $('appContainer').style.display = 'block';
  });
});
