// ============ AUTH & SETUP ============
function hideAllPages() {
  ['setupPage','registerPage','loginPage','appContainer'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}

async function checkAuth() {
  hideAllPages();
  document.getElementById('setupPage').style.display = 'flex';

  try {
    // Step 1: Check setup status
    const status = await apiFetch('/api/setup/status');

    if (!status.tablesReady) {
      // Auto-init database
      document.getElementById('setupStatus').textContent = 'Membuat database...';
      await apiFetch('/api/setup/init', { method: 'POST' });
      // Re-check
      const s2 = await apiFetch('/api/setup/status');
      if (!s2.hasUsers) { showRegister(); return; }
    }

    if (!status.hasUsers) {
      showRegister();
      return;
    }

    // Step 2: Check if already logged in
    if (!token) { showLogin(); return; }
    try {
      const data = await apiFetch('/api/auth/me');
      currentUser = data.user;
      showApp();
    } catch {
      token = null;
      localStorage.removeItem('pos_token');
      showLogin();
    }
  } catch (err) {
    // If setup check fails, try normal login flow
    if (!token) { showLogin(); return; }
    try {
      const data = await apiFetch('/api/auth/me');
      currentUser = data.user;
      showApp();
    } catch {
      token = null;
      localStorage.removeItem('pos_token');
      showLogin();
    }
  }
}

function showRegister() {
  hideAllPages();
  document.getElementById('registerPage').style.display = 'flex';
}

// ============ PIN LOGIN ============
let pinValue = '';
let selectedCashierId = null;
let selectedCashierName = '';

function switchLoginTab(mode) {
  const tabPin = document.getElementById('tabPin');
  const tabPwd = document.getElementById('tabPassword');
  const pinSection = document.getElementById('pinLoginSection');
  const pwdSection = document.getElementById('passwordLoginSection');
  if (mode === 'pin') {
    tabPin.classList.add('active'); tabPin.style.background = ''; tabPin.style.color = '';
    tabPwd.classList.remove('active'); tabPwd.style.background = 'transparent'; tabPwd.style.color = '#64748b';
    pinSection.style.display = 'block'; pwdSection.style.display = 'none';
    loadCashiers();
  } else {
    tabPwd.classList.add('active'); tabPwd.style.background = ''; tabPwd.style.color = '';
    tabPin.classList.remove('active'); tabPin.style.background = 'transparent'; tabPin.style.color = '#64748b';
    pwdSection.style.display = 'block'; pinSection.style.display = 'none';
  }
}

async function loadCashiers() {
  const listEl = document.getElementById('pinCashierList');
  const noEl = document.getElementById('pinNoCashiers');
  const inputEl = document.getElementById('pinInputSection');
  try {
    const data = await apiFetch('/api/auth/cashiers');
    const cashiers = data.cashiers || [];
    inputEl.style.display = 'none';
    if (cashiers.length === 0) {
      listEl.style.display = 'none';
      noEl.style.display = 'block';
      return;
    }
    noEl.style.display = 'none';
    listEl.style.display = 'block';
    let html = '<p style="font-size:13px;color:#64748b;margin-bottom:10px;text-align:center;">Pilih kasir:</p>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;">';
    cashiers.forEach(c => {
      html += '<div class="cashier-card" onclick="selectCashier(' + c.id + ',\'' + escHtml(c.name).replace(/'/g, "\\'") + '\')">';
      html += '<div class="avatar">' + escHtml(c.name.charAt(0).toUpperCase()) + '</div>';
      html += '<div class="cname">' + escHtml(c.name) + '</div>';
      html += '</div>';
    });
    html += '</div>';
    listEl.innerHTML = html;
  } catch (err) {
    listEl.innerHTML = '<p style="text-align:center;color:#ef4444;font-size:14px;">Gagal memuat kasir</p>';
  }
}

function selectCashier(id, name) {
  selectedCashierId = id;
  selectedCashierName = name;
  pinValue = '';
  document.getElementById('pinCashierList').style.display = 'none';
  document.getElementById('pinNoCashiers').style.display = 'none';
  document.getElementById('pinInputSection').style.display = 'block';
  document.getElementById('pinSelectedUser').innerHTML = '<strong style="color:#415D43;">' + escHtml(name) + '</strong>';
  document.getElementById('pinError').textContent = '';
  updatePinDots();
}

function pinBackToCashierList() {
  selectedCashierId = null;
  pinValue = '';
  document.getElementById('pinInputSection').style.display = 'none';
  loadCashiers();
}

function updatePinDots() {
  const dots = document.querySelectorAll('#pinDots .pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('filled', 'error');
    if (i < pinValue.length) dot.classList.add('filled');
  });
}

async function pinKeyPress(key) {
  if (key === 'clear') {
    pinValue = '';
    document.getElementById('pinError').textContent = '';
    updatePinDots();
    return;
  }
  if (key === 'back') {
    pinValue = pinValue.slice(0, -1);
    document.getElementById('pinError').textContent = '';
    updatePinDots();
    return;
  }
  if (pinValue.length >= 6) return;
  pinValue += key;
  updatePinDots();
  // Auto-submit when 6 digits entered
  if (pinValue.length === 6) {
    try {
      const data = await apiFetch('/api/auth/login-pin', {
        method: 'POST',
        body: JSON.stringify({ user_id: selectedCashierId, pin: pinValue })
      });
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('pos_token', token);
      showToast('Login berhasil! Selamat datang, ' + currentUser.name);
      showApp();
    } catch (err) {
      // Show error and shake dots
      document.getElementById('pinError').textContent = err.message || 'PIN salah';
      const dots = document.querySelectorAll('#pinDots .pin-dot');
      dots.forEach(d => { d.classList.remove('filled'); d.classList.add('error'); });
      setTimeout(() => { pinValue = ''; updatePinDots(); }, 600);
    }
  }
}

function showLogin() {
  hideAllPages();
  document.getElementById('loginPage').style.display = 'flex';
  // Default to PIN tab and load cashiers
  switchLoginTab('pin');
}

async function showApp() {
  hideAllPages();
  document.getElementById('appContainer').style.display = 'block';
  renderSidebar();
  // Auto-migrate database (owner only, silent)
  if (currentUser.role === 'owner') {
    apiFetch('/api/auto-migrate').catch(() => {});
  }
  // Check active shift for kasir
  try {
    const shiftData = await apiFetch('/api/shifts/current').catch(() => ({ shift: null }));
    activeShift = shiftData.shift || null;
  } catch { activeShift = null; }
  if (currentUser.role === 'kasir') {
    navigateTo(activeShift ? 'pos' : 'shifts');
  } else {
    navigateTo('dashboard');
  }
}

// ============ LOW STOCK NOTIFICATIONS ============
let lowStockData = [];

function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  panel.classList.toggle('show');
}

// Close panel when clicking outside
document.addEventListener('click', function(e) {
  const wrapper = document.getElementById('notifWrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    document.getElementById('notifPanel')?.classList.remove('show');
  }
});

let expiringData = [];

async function loadLowStockNotifications() {
  try {
    // Fetch expiring products
    try {
      const expRes = await fetch(API + '/api/products/expiring?days=30', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (expRes.ok) { expiringData = await expRes.json(); }
    } catch(e) { expiringData = []; }
    // Fetch low stock
    const res = await fetch(API + '/api/products/low-stock', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return;
    lowStockData = await res.json();
    updateNotifBadge();
  } catch (e) { console.log('Low stock check failed:', e); }
}

function updateNotifBadge() {
  const badge = document.getElementById('notifBadge');
  const body = document.getElementById('notifBody');
  const header = document.getElementById('notifPanelHeader');
  if (!badge || !body) return;

  const stockCount = (lowStockData || []).length;
  const expCount = (expiringData || []).filter(p => p.urgency === 'expired' || p.urgency === 'kritis').length;
  const totalCount = stockCount + expCount;

  if (totalCount === 0) {
    badge.style.display = 'none';
    body.innerHTML = '<div class="notif-empty">Semua stok & produk aman \u2705</div>';
    if (header) header.textContent = '\u26A0\uFE0F Peringatan';
    return;
  }

  badge.style.display = 'flex';
  badge.textContent = totalCount > 99 ? '99+' : totalCount;
  if (header) header.textContent = '\u26A0\uFE0F Peringatan (' + totalCount + ')';

  let html = '';

  // Expiring products (expired + kritis only in bell)
  const criticalExpiring = (expiringData || []).filter(p => p.urgency === 'expired' || p.urgency === 'kritis');
  if (criticalExpiring.length > 0) {
    html += '<div style="padding:6px 12px 2px;font-size:11px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.5px">\uD83D\uDCC5 Kadaluarsa</div>';
    criticalExpiring.forEach(p => {
      const isExp = p.urgency === 'expired';
      const daysLabel = isExp ? 'Sudah expired ' + Math.abs(p.days_until_expire) + ' hari lalu' : 'Habis ' + p.days_until_expire + ' hari lagi';
      html += '<div class="notif-item">' +
        '<div class="notif-item-icon danger">' + (isExp ? '\u2620\uFE0F' : '\uD83D\uDCC5') + '</div>' +
        '<div class="notif-item-info">' +
          '<div class="notif-item-name">' + escHtml(p.name) + '</div>' +
          '<div class="notif-item-detail">' + daysLabel + '</div>' +
        '</div></div>';
    });
  }

  // Low stock products
  if (stockCount > 0) {
    html += '<div style="padding:6px 12px 2px;font-size:11px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:.5px">\uD83D\uDCE6 Stok Menipis</div>';
    (lowStockData || []).forEach(p => {
      const isOut = p.stock === 0;
      const iconClass = isOut ? 'danger' : 'warning';
      const icon = isOut ? '\uD83D\uDEAB' : '\u26A0\uFE0F';
      const status = isOut ? 'HABIS' : 'Sisa ' + p.stock;
      html += '<div class="notif-item">' +
        '<div class="notif-item-icon ' + iconClass + '">' + icon + '</div>' +
        '<div class="notif-item-info">' +
          '<div class="notif-item-name">' + escHtml(p.name) + '</div>' +
          '<div class="notif-item-detail">' + status + ' \u2014 min: ' + (p.min_stock || 0) + '</div>' +
        '</div></div>';
    });
  }

  if (criticalExpiring.length > 0 || stockCount > 0) {
    html += '<div style="padding:8px 12px;border-top:1px solid var(--border);display:flex;gap:8px">';
    if (criticalExpiring.length > 0) html += '<button class="btn btn-sm" style="flex:1;font-size:11px;background:#ef4444;color:#fff" onclick="showPage(\'expiredtracking\');toggleNotifPanel()">\uD83D\uDCC5 Lihat Expired</button>';
    if (stockCount > 0) html += '<button class="btn btn-sm" style="flex:1;font-size:11px" onclick="showPage(\'restock\');toggleNotifPanel()">\uD83D\uDD14 Restock Alert</button>';
    html += '</div>';
  }

  body.innerHTML = html;
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('pos_token');
  showLogin();
}

// Register owner form
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('registerBtn');
  const pw = document.getElementById('regPassword').value;
  const pw2 = document.getElementById('regPassword2').value;

  if (pw !== pw2) { showToast('Password tidak cocok!', 'error'); return; }

  btn.disabled = true; btn.textContent = 'Mendaftar...';
  try {
    const data = await apiFetch('/api/auth/register-owner', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('regName').value,
        username: document.getElementById('regUsername').value,
        password: pw,
        store_name: document.getElementById('regStoreName').value
      })
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('pos_token', token);
    showToast('🎉 Selamat datang di KasirPro, ' + currentUser.name + '!');
    showApp();
  } catch (err) {
    showToast(err.message, 'error');
  }
  btn.disabled = false; btn.textContent = '🚀 Mulai Sekarang';
});

// Login form
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Memproses...';
  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('loginUsername').value,
        password: document.getElementById('loginPassword').value
      })
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('pos_token', token);
    showToast('Login berhasil! Selamat datang, ' + currentUser.name);
    showApp();
  } catch (err) {
    showToast(err.message, 'error');
  }
  btn.disabled = false; btn.textContent = '🔐 Masuk';
});

