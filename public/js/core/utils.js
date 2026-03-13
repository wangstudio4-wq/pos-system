// ============ UTILITIES ============
function escHtml(str) {
  if (str === null || str === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function formatRp(n) {
  if (n === null || n === undefined) n = 0;
  n = Number(n);
  return 'Rp ' + n.toLocaleString('id-ID');
}

function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatTime(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span>' + (icons[type]||'') + '</span><span>' + escHtml(message) + '</span>';
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  try {
    const res = await fetch(API + url, { ...options, headers: { ...headers, ...options.headers } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error || data.message || 'Terjadi kesalahan';
      throw new Error(msg);
    }
    return data;
  } catch (err) {
    if (!navigator.onLine && (!options.method || options.method === 'GET')) {
      return await offlineFallback(url);
    }
    throw err;
  }
}

async function offlineFallback(url) {
  try {
    if (url.includes('/api/products')) {
      var prods = await idbGetAll('products');
      return { products: prods };
    }
    if (url.includes('/api/categories')) {
      var cats = await idbGetAll('categories');
      return { categories: cats };
    }
    if (url.includes('/api/settings')) {
      var all = await idbGetAll('settings');
      return all[0] || {};
    }
    if (url.includes('/api/price-tiers')) {
      return await idbGetAll('priceTiers');
    }
    if (url.includes('/api/product-discounts/active')) {
      return await idbGetAll('discounts');
    }
  } catch (e) {}
  throw new Error('Tidak tersedia dalam mode offline');
}

function loadingHtml() {
  return '<div class="loading"><div class="spinner"></div><p style="margin-top:12px">Memuat data...</p></div>';
}

function emptyHtml(icon, text) {
  return '<div class="empty-state"><div class="empty-icon">' + icon + '</div><p>' + escHtml(text) + '</p></div>';
}

function closeModal() {
  const m = document.querySelector('.modal-overlay');
  if (m) m.remove();
}

function openModal(html, cls = '') {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal ' + cls + '">' + html + '</div>';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function payMethodBadge(m) {
  const map = {
    'Cash': 'badge-green', 'cash': 'badge-green',
    'QRIS': 'badge-purple', 'qris': 'badge-purple',
    'Transfer': 'badge-blue', 'transfer': 'badge-blue',
    'Kartu': 'badge-orange', 'kartu': 'badge-orange'
  };
  const cls = map[m] || 'badge-gray';
  return '<span class="badge ' + cls + '">' + escHtml(m || 'Cash') + '</span>';
}

