// ============ OFFLINE MODE ============
var OFFLINE_DB_NAME = 'KasirProOffline';
var OFFLINE_DB_VERSION = 1;
var offlineDb = null;

function openOfflineDb() {
  return new Promise(function(resolve, reject) {
    if (offlineDb) { resolve(offlineDb); return; }
    var req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('categories')) db.createObjectStore('categories', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('priceTiers')) db.createObjectStore('priceTiers', { autoIncrement: true });
      if (!db.objectStoreNames.contains('discounts')) db.createObjectStore('discounts', { autoIncrement: true });
      if (!db.objectStoreNames.contains('pendingTx')) db.createObjectStore('pendingTx', { keyPath: 'offline_id' });
    };
    req.onsuccess = function(e) { offlineDb = e.target.result; resolve(offlineDb); };
    req.onerror = function() { reject(new Error('IndexedDB not available')); };
  });
}

function idbPut(storeName, data) {
  return openOfflineDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      var store = tx.objectStore(storeName);
      if (Array.isArray(data)) { data.forEach(function(d) { store.put(d); }); }
      else { store.put(data); }
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(tx.error); };
    });
  });
}

function idbGetAll(storeName) {
  return openOfflineDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName, 'readonly');
      var store = tx.objectStore(storeName);
      var req = store.getAll();
      req.onsuccess = function() { resolve(req.result || []); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

function idbClear(storeName) {
  return openOfflineDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(tx.error); };
    });
  });
}

function idbDelete(storeName, key) {
  return openOfflineDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(tx.error); };
    });
  });
}

async function cachePOSData() {
  try {
    var prodData = await apiFetch('/api/products').catch(function() { return null; });
    if (prodData) {
      var prods = prodData.products || prodData || [];
      await idbClear('products');
      await idbPut('products', prods);
    }
    var catData = await apiFetch('/api/categories').catch(function() { return null; });
    if (catData) {
      var cats = catData.categories || catData || [];
      await idbClear('categories');
      await idbPut('categories', cats);
    }
    var settData = await apiFetch('/api/settings').catch(function() { return null; });
    if (settData) await idbPut('settings', Object.assign({}, settData, { id: 1 }));
    var tiersData = await apiFetch('/api/price-tiers').catch(function() { return null; });
    if (tiersData) { await idbClear('priceTiers'); await idbPut('priceTiers', tiersData); }
    var discData = await apiFetch('/api/product-discounts/active').catch(function() { return null; });
    if (discData) { await idbClear('discounts'); await idbPut('discounts', discData); }
  } catch (e) { console.warn('Cache POS data failed:', e); }
}

async function getPendingTxCount() {
  try {
    var txs = await idbGetAll('pendingTx');
    return txs.length;
  } catch (e) { return 0; }
}

async function addOfflineTx(payload) {
  payload.offline_id = 'otx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  payload.created_at = new Date().toISOString();
  await idbPut('pendingTx', [payload]);
  updatePendingBadge();
  return { transaction: { id: payload.offline_id }, offline: true };
}

async function syncPendingTransactions() {
  if (!navigator.onLine) return;
  try {
    var pending = await idbGetAll('pendingTx');
    if (pending.length === 0) return;
    var result = await apiFetch('/api/sync/transactions', {
      method: 'POST',
      body: JSON.stringify({ transactions: pending })
    });
    if (result.results) {
      for (var ri = 0; ri < result.results.length; ri++) {
        var r = result.results[ri];
        if (r.status === 'ok') { await idbDelete('pendingTx', r.offline_id); }
      }
    }
    updatePendingBadge();
    if (result.synced > 0) showToast('\u2705 ' + result.synced + ' transaksi offline berhasil disync!', 'success');
  } catch (e) { console.warn('Sync failed:', e); }
}

function updatePendingBadge() {
  getPendingTxCount().then(function(count) {
    var badge = document.getElementById('pendingSyncBadge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline' : 'none';
    }
  });
}

var _isOnline = navigator.onLine;



// POS Member search helpers
let _posMemberResults = [];
async function searchPOSMember(q) {
  const results = document.getElementById('posMemberResults');
  if (!results) return;
  if (q.length < 2) { results.innerHTML = ''; _posMemberResults = []; return; }
  try {
    const members = await apiFetch('/api/members/search/quick?q=' + encodeURIComponent(q));
    _posMemberResults = members;
    let html = '';
    members.forEach((m, idx) => {
      html += '<div style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;margin-top:4px;cursor:pointer;font-size:12px;display:flex;justify-content:space-between;align-items:center" onclick="selectPOSMember(' + idx + ')">';
      html += '<div>' + (m.level_icon || '🥉') + ' <strong>' + escHtml(m.name) + '</strong> <span style="color:#64748b">' + escHtml(m.member_code || '') + '</span></div>';
      html += '<span style="color:#8b5cf6;font-weight:600">🪙' + m.points + '</span></div>';
    });
    results.innerHTML = html || '<div style="font-size:12px;color:#94a3b8;padding:4px">Tidak ditemukan</div>';
  } catch(e) { /* ignore */ }
}

async function selectPOSMember(idx) {
  const m = typeof idx === 'number' ? _posMemberResults[idx] : idx;
  if (!m) return;
  selectedPOSMember = m;
  // Load VIP prices for this member
  memberVIPPrices = {};
  try {
    const vipData = await apiFetch('/api/special-prices/for-member/' + m.id);
    for (const sp of (vipData || [])) {
      memberVIPPrices[sp.product_id] = sp;
    }
  } catch(e) { console.error('VIP prices load error:', e); }
  // Apply VIP prices to existing cart items
  applyVIPPricesToCart();
  updateCartUI();
  // Refresh product grid to show VIP badges
  const grid = document.getElementById('posProductGrid');
  if (grid) grid.innerHTML = renderProductGrid();
  const vipCount = Object.keys(memberVIPPrices).length;
  showToast('👥 Member ' + m.name + ' dipilih! ' + (vipCount > 0 ? '👑 ' + vipCount + ' harga VIP aktif' : 'Disc ' + (m.discount_percent || 0) + '%'), 'success');
}

function clearPOSMember() {
  selectedPOSMember = null;
  memberVIPPrices = {};
  // Revert cart items to normal prices
  cart.forEach((c, i) => {
    const p = posProducts.find(x => x.id === c.id);
    if (p) { c.price = Number(p.price); c.isVIPPrice = false; }
    applyTieredPrice(i);
    applyProductDiscount(i);
  });
  updateCartUI();
  const grid = document.getElementById('posProductGrid');
  if (grid) grid.innerHTML = renderProductGrid();
}

