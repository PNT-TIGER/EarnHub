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
  const newUser = {
    id: uid(),
    username,
    password,
    email,
    phone,
    balance: 0,
    completedTasks: [],
    claimedTasks: [],
    totalWithdrawn: 0,
    usdtAddress: '',
    referredBy: '',
    referralCode: username + Math.random().toString(36).substr(2, 4).toUpperCase(),
    referrals: [],
    referralEarnings: 0,
    createdAt: new Date().toISOString(),
    giftCodesRedeemed: []
  };
  if (refCode) {
    const referrer = users.find(u => u.referralCode === refCode);
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
  $('homeRefLink').textContent = currentUser.referralCode;
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
        }, '🔗 Open Task'),
        el('button', {
          className: 'task-btn btn-claim',
          disabled: !isCompleted || isClaimed,
          onclick: () => claimTask(t.id)
        }, isClaimed ? '✓ Claimed' : isCompleted ? '💰 Claim Reward' : '⏳ Open First')
      ),
      el('div', { className: `task-status ${isClaimed ? 'status-claimed' : isCompleted ? 'status-completed' : 'status-pending'}` },
        isClaimed ? '✓ Reward Claimed' : isCompleted ? '✅ Completed - Claim Now' : '⏳ Click "Open Task" to start'
      )
    );
    container.appendChild(card);
  });
}

function markTaskCompleted(taskId) {
  if (!currentUser.completedTasks.includes(taskId)) {
    currentUser.completedTasks.push(taskId);
    saveCurrentUser();
    showToast('Task opened! Now click Claim to get reward', 'success');
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
  if (ads.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📢</div><p>No ads available. Check back later!</p></div>';
    return;
  }
  container.innerHTML = '';
  ads.forEach((ad, i) => {
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
          onclick: () => {
            if (ad.link) {
              window.open(ad.link, '_blank');
              setTimeout(() => {
                currentUser.balance += ad.payout;
                saveCurrentUser();
                updateHeader();
                showToast(`+${ad.payout} USDT from ad! 🎉`, 'success');
                showConfetti();
              }, 2000);
            } else {
              showToast('Ad link not available', 'error');
            }
          }
        }, '👀 View Ad - Earn ' + ad.payout + ' USDT')
      )
    );
    container.appendChild(card);
  });
}

// ===== PROFILE =====
function renderProfile() {
  if (!currentUser) return;
  $('profileName').textContent = currentUser.username;
  $('profileBadge').textContent = currentUser.username.charAt(0).toUpperCase();
  $('profileBalance').textContent = '$' + currentUser.balance.toFixed(2);
  $('profileTasks').textContent = currentUser.completedTasks.length;
  $('profileWithdrawn').textContent = '$' + currentUser.totalWithdrawn.toFixed(2);
  $('profileReferrals').textContent = currentUser.referrals.length;
  $('profileRefEarnings').textContent = '$' + currentUser.referralEarnings.toFixed(2);
  $('profileRefLink').value = currentUser.referralCode;
  $('profileUsdtAddress').value = currentUser.usdtAddress || '';
  renderMessageBox();
  renderWithdrawHistory();
}

function copyRefLink() {
  const input = $('profileRefLink');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    showToast('Referral code copied! Share it with friends', 'success');
  }).catch(() => {
    document.execCommand('copy');
    showToast('Referral code copied!', 'success');
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

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  TelegramApp.init();
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
  $('appContainer').style.display = 'none';
});
