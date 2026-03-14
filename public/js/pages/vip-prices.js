// ============ HARGA VIP / SPESIAL ============
let vipProductFilter = '';
let vipLevelFilter = '';
let vipAllPrices = [];
let vipLevels = [];
let vipProducts = [];

async function renderVIPPrices() {
  const main = document.getElementById('mainContent');
  try {
    const [pricesData, levelsData, productsData, statsData] = await Promise.all([
      apiFetch('/api/special-prices'),
      apiFetch('/api/member-levels'),
      apiFetch('/api/products'),
      apiFetch('/api/special-prices/stats')
    ]);
    vipAllPrices = pricesData || [];
    vipLevels = levelsData || [];
    vipProducts = (productsData.products || productsData || []);
    const stats = statsData || {};

    let html = '<div class="page-header"><h1>👑 Harga VIP / Spesial</h1><p>Atur harga khusus per level member atau per pelanggan tertentu</p></div>';

    // Stats cards
    html += '<div class="grid grid-4" style="margin-bottom:20px">';
    html += '<div class="stat-card"><div class="stat-number">' + (stats.products_with_special || 0) + '</div><div class="stat-label">Produk dengan Harga VIP</div></div>';
    html += '<div class="stat-card"><div class="stat-number">' + (stats.total_special_prices || 0) + '</div><div class="stat-label">Total Harga Spesial</div></div>';
    html += '<div class="stat-card"><div class="stat-number">' + (stats.levels_configured || 0) + '</div><div class="stat-label">Level Dikonfigurasi</div></div>';
    html += '<div class="stat-card"><div class="stat-number">' + (stats.customers_with_vip || 0) + '</div><div class="stat-label">Customer VIP Personal</div></div>';
    html += '</div>';

    // Quick setup button
    html += '<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button class="btn btn-primary" onclick="showBatchVIPModal()">📝 Batch Set Harga per Produk</button>';
    html += '<button class="btn btn-success" onclick="showVIPByLevelModal()">👑 Set Harga per Level</button>';
    html += '<button class="btn" onclick="showVIPCustomerModal()">🧑 Harga Customer Spesifik</button>';
    html += '</div>';

    // Filter
    html += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">';
    html += '<select id="vipLevelSel" onchange="vipLevelFilter=this.value;renderVIPTable()" style="padding:8px;border-radius:6px;border:1px solid #ddd">';
    html += '<option value="">Semua Level</option>';
    for (const l of vipLevels) {
      html += '<option value="' + l.id + '"' + (vipLevelFilter == l.id ? ' selected' : '') + '>' + l.icon + ' ' + l.name + '</option>';
    }
    html += '<option value="customer"' + (vipLevelFilter === 'customer' ? ' selected' : '') + '>🧑 Customer Spesifik</option>';
    html += '</select>';
    html += '<input type="text" id="vipSearchProd" placeholder="🔍 Cari produk..." value="' + escHtml(vipProductFilter) + '" oninput="vipProductFilter=this.value;renderVIPTable()" style="padding:8px;border-radius:6px;border:1px solid #ddd;flex:1;min-width:150px">';
    html += '</div>';

    html += '<div id="vipTableContainer"></div>';
    main.innerHTML = html;
    renderVIPTable();
  } catch(err) {
    main.innerHTML = '<div class="alert alert-error">Gagal memuat harga VIP: ' + escHtml(err.message) + '</div>';
  }
}

function renderVIPTable() {
  let filtered = vipAllPrices;
  if (vipLevelFilter === 'customer') {
    filtered = filtered.filter(p => p.customer_id !== null);
  } else if (vipLevelFilter) {
    filtered = filtered.filter(p => p.level_id == vipLevelFilter && !p.customer_id);
  }
  if (vipProductFilter) {
    const q = vipProductFilter.toLowerCase();
    filtered = filtered.filter(p => (p.product_name || '').toLowerCase().includes(q));
  }

  let html = '<div class="card"><div class="card-body" style="overflow-x:auto">';
  if (filtered.length === 0) {
    html += '<div style="text-align:center;padding:40px;color:#94a3b8"><p style="font-size:48px">👑</p><p>Belum ada harga VIP. Klik tombol di atas untuk mulai mengatur harga spesial!</p></div>';
  } else {
    html += '<table class="table"><thead><tr><th>Produk</th><th>Harga Normal</th><th>Untuk</th><th>Harga VIP</th><th>Selisih</th><th>Periode</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    for (const p of filtered) {
      const normal = Number(p.normal_price || 0);
      const special = Number(p.special_price || 0);
      const diff = normal - special;
      const diffPct = normal > 0 ? ((diff / normal) * 100).toFixed(1) : 0;
      const target = p.customer_name ? ('🧑 ' + escHtml(p.customer_name)) : ((p.level_icon || '') + ' ' + (p.level_name || 'N/A'));
      const period = (p.start_date && p.end_date) ? (p.start_date + ' ~ ' + p.end_date) : (p.start_date ? 'Mulai ' + p.start_date : (p.end_date ? 'Sampai ' + p.end_date : '♾️ Permanen'));
      const statusBadge = p.is_active ? '<span class="badge" style="background:#dcfce7;color:#16a34a">Aktif</span>' : '<span class="badge" style="background:#fee2e2;color:#dc2626">Nonaktif</span>';

      html += '<tr>';
      html += '<td><strong>' + escHtml(p.product_name || 'N/A') + '</strong></td>';
      html += '<td>' + formatRp(normal) + '</td>';
      html += '<td>' + target + '</td>';
      html += '<td style="color:#7c3aed;font-weight:600">' + formatRp(special) + '</td>';
      html += '<td style="color:#16a34a">-' + formatRp(diff) + ' (' + diffPct + '%)</td>';
      html += '<td style="font-size:12px">' + period + '</td>';
      html += '<td>' + statusBadge + '</td>';
      html += '<td><button class="btn btn-sm btn-primary" onclick="editVIPPrice(' + p.id + ')" title="Edit">✏️</button> ';
      html += '<button class="btn btn-sm" style="background:#fee2e2;color:#dc2626" onclick="deleteVIPPrice(' + p.id + ')" title="Hapus">🗑️</button></td>';
      html += '</tr>';
    }
    html += '</tbody></table>';
  }
  html += '</div></div>';
  document.getElementById('vipTableContainer').innerHTML = html;
}

async function showBatchVIPModal() {
  // Select a product, then set prices for all levels
  let html = '<div class="modal-header"><h3>📝 Set Harga VIP per Produk</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body">';
  html += '<div class="form-group"><label>Pilih Produk</label>';
  html += '<select id="batchVipProduct" onchange="loadBatchVIPPrices()" style="width:100%;padding:10px;border-radius:6px;border:1px solid #ddd">';
  html += '<option value="">-- Pilih Produk --</option>';
  for (const p of vipProducts) {
    html += '<option value="' + p.id + '" data-price="' + p.price + '">' + escHtml(p.name) + ' (' + formatRp(p.price) + ')</option>';
  }
  html += '</select></div>';
  html += '<div id="batchVipLevels" style="margin-top:12px"></div>';
  html += '</div>';
  html += '<div class="modal-footer"><button class="btn btn-primary" onclick="saveBatchVIP()">💾 Simpan</button></div>';
  showModal(html);
}

async function loadBatchVIPPrices() {
  const sel = document.getElementById('batchVipProduct');
  const productId = sel.value;
  const container = document.getElementById('batchVipLevels');
  if (!productId) { container.innerHTML = ''; return; }
  const normalPrice = Number(sel.options[sel.selectedIndex].dataset.price || 0);
  try {
    const existing = await apiFetch('/api/special-prices/product/' + productId);
    let html = '<div style="background:#f8fafc;border-radius:8px;padding:12px">';
    html += '<p style="margin-bottom:8px;font-weight:600">Harga Normal: ' + formatRp(normalPrice) + '</p>';
    html += '<table class="table" style="margin:0"><thead><tr><th>Level</th><th>Harga VIP</th><th>Selisih</th></tr></thead><tbody>';
    for (const l of vipLevels) {
      const ex = existing.find(e => e.level_id === l.id && !e.customer_id);
      const val = ex ? ex.special_price : '';
      html += '<tr>';
      html += '<td>' + l.icon + ' ' + l.name + ' <small style="color:#94a3b8">(disc default: ' + l.discount_percent + '%)</small></td>';
      html += '<td><input type="number" id="batchVipLvl' + l.id + '" value="' + val + '" placeholder="Kosongkan = harga normal" style="width:140px;padding:6px;border-radius:4px;border:1px solid #ddd" oninput="updateBatchDiff(this,' + normalPrice + ')"></td>';
      html += '<td class="batch-diff-' + l.id + '" style="color:#16a34a">' + (val ? '-' + formatRp(normalPrice - val) : '-') + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    container.innerHTML = html;
  } catch(err) { container.innerHTML = '<div class="alert alert-error">' + err.message + '</div>'; }
}

function updateBatchDiff(input, normalPrice) {
  const val = Number(input.value);
  const levelId = input.id.replace('batchVipLvl', '');
  const diffEl = document.querySelector('.batch-diff-' + levelId);
  if (diffEl) {
    if (val > 0) {
      const diff = normalPrice - val;
      const pct = normalPrice > 0 ? ((diff / normalPrice) * 100).toFixed(1) : 0;
      diffEl.innerHTML = '<span style="color:' + (diff >= 0 ? '#16a34a' : '#dc2626') + '">' + (diff >= 0 ? '-' : '+') + formatRp(Math.abs(diff)) + ' (' + pct + '%)</span>';
    } else { diffEl.innerHTML = '-'; }
  }
}

async function saveBatchVIP() {
  const productId = document.getElementById('batchVipProduct').value;
  if (!productId) { showToast('Pilih produk dulu', 'warning'); return; }
  const prices = [];
  for (const l of vipLevels) {
    const val = document.getElementById('batchVipLvl' + l.id).value;
    if (val && Number(val) > 0) {
      prices.push({ level_id: l.id, special_price: Number(val) });
    }
  }
  if (prices.length === 0) { showToast('Isi minimal 1 harga VIP', 'warning'); return; }
  try {
    await apiFetch('/api/special-prices/batch/' + productId, { method: 'POST', body: JSON.stringify({ prices }) });
    showToast('Harga VIP berhasil disimpan! 👑', 'success');
    closeModal();
    renderVIPPrices();
  } catch(err) { showToast('Gagal: ' + err.message, 'error'); }
}

async function showVIPByLevelModal() {
  let html = '<div class="modal-header"><h3>👑 Set Harga VIP per Level</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body">';
  html += '<p style="color:#64748b;margin-bottom:12px">Pilih level, lalu set harga spesial untuk beberapa produk sekaligus.</p>';
  html += '<div class="form-group"><label>Pilih Level</label>';
  html += '<select id="levelVipSel" onchange="loadLevelVIPProducts()" style="width:100%;padding:10px;border-radius:6px;border:1px solid #ddd">';
  html += '<option value="">-- Pilih Level --</option>';
  for (const l of vipLevels) {
    html += '<option value="' + l.id + '">' + l.icon + ' ' + l.name + ' (default disc: ' + l.discount_percent + '%)</option>';
  }
  html += '</select></div>';
  html += '<div id="levelVipProducts" style="margin-top:12px;max-height:400px;overflow-y:auto"></div>';
  html += '</div>';
  html += '<div class="modal-footer"><button class="btn btn-primary" onclick="saveLevelVIP()">💾 Simpan</button></div>';
  showModal(html);
}

async function loadLevelVIPProducts() {
  const levelId = document.getElementById('levelVipSel').value;
  const container = document.getElementById('levelVipProducts');
  if (!levelId) { container.innerHTML = ''; return; }
  try {
    const existing = await apiFetch('/api/special-prices?level_id=' + levelId);
    let html = '<input type="text" id="levelVipSearch" placeholder="🔍 Cari produk..." oninput="filterLevelVIP()" style="width:100%;padding:8px;border-radius:6px;border:1px solid #ddd;margin-bottom:8px">';
    html += '<table class="table" id="levelVipTable"><thead><tr><th>Produk</th><th>Harga Normal</th><th>Harga VIP</th></tr></thead><tbody>';
    for (const p of vipProducts) {
      const ex = existing.find(e => e.product_id === p.id);
      const val = ex ? ex.special_price : '';
      html += '<tr class="lvl-vip-row" data-name="' + escHtml(p.name).toLowerCase() + '">';
      html += '<td>' + escHtml(p.name) + '</td>';
      html += '<td>' + formatRp(p.price) + '</td>';
      html += '<td><input type="number" class="lvl-vip-input" data-pid="' + p.id + '" value="' + val + '" placeholder="Harga VIP" style="width:120px;padding:4px;border-radius:4px;border:1px solid #ddd"></td>';
      html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch(err) { container.innerHTML = '<div class="alert alert-error">' + err.message + '</div>'; }
}

function filterLevelVIP() {
  const q = (document.getElementById('levelVipSearch').value || '').toLowerCase();
  document.querySelectorAll('.lvl-vip-row').forEach(row => {
    row.style.display = row.dataset.name.includes(q) ? '' : 'none';
  });
}

async function saveLevelVIP() {
  const levelId = document.getElementById('levelVipSel').value;
  if (!levelId) { showToast('Pilih level dulu', 'warning'); return; }
  const inputs = document.querySelectorAll('.lvl-vip-input');
  let saved = 0;
  for (const inp of inputs) {
    const val = Number(inp.value);
    const productId = inp.dataset.pid;
    if (val > 0) {
      try {
        await apiFetch('/api/special-prices', { method: 'POST', body: JSON.stringify({ product_id: Number(productId), level_id: Number(levelId), special_price: val }) });
        saved++;
      } catch(err) { console.error(err); }
    }
  }
  showToast(saved + ' harga VIP berhasil disimpan! 👑', 'success');
  closeModal();
  renderVIPPrices();
}

async function showVIPCustomerModal() {
  let html = '<div class="modal-header"><h3>🧑 Harga Spesial Customer</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body">';
  html += '<p style="color:#64748b;margin-bottom:12px">Set harga khusus untuk pelanggan tertentu (override harga level)</p>';
  html += '<div class="form-group"><label>Cari Customer</label>';
  html += '<input type="text" id="vipCustSearch" placeholder="Ketik nama/kode member..." oninput="searchVIPCustomer()" style="width:100%;padding:10px;border-radius:6px;border:1px solid #ddd">';
  html += '<div id="vipCustResults" style="margin-top:4px"></div></div>';
  html += '<div id="vipCustForm" style="display:none"></div>';
  html += '</div>';
  showModal(html);
}

async function searchVIPCustomer() {
  const q = document.getElementById('vipCustSearch').value;
  if (q.length < 2) { document.getElementById('vipCustResults').innerHTML = ''; return; }
  try {
    const results = await apiFetch('/api/members/search/quick?q=' + encodeURIComponent(q));
    let html = '';
    for (const m of (results || [])) {
      html += '<div style="padding:8px;cursor:pointer;border-bottom:1px solid #eee;display:flex;justify-content:space-between" onclick="selectVIPCustomer(' + m.id + ',\'' + escHtml(m.name).replace(/'/g, "\\'") + '\')">';
      html += '<span>' + (m.level_icon || '') + ' <strong>' + escHtml(m.name) + '</strong> <small>' + (m.member_code || '') + '</small></span>';
      html += '<span style="color:#7c3aed">🪙 ' + (m.points || 0) + ' poin</span>';
      html += '</div>';
    }
    if (!html) html = '<div style="padding:8px;color:#94a3b8">Tidak ditemukan</div>';
    document.getElementById('vipCustResults').innerHTML = html;
  } catch(err) {}
}

async function selectVIPCustomer(customerId, name) {
  document.getElementById('vipCustResults').innerHTML = '<div style="padding:8px;color:#16a34a">✅ ' + name + ' dipilih</div>';
  try {
    const existing = await apiFetch('/api/special-prices?customer_id=' + customerId);
    let html = '<div style="background:#f8fafc;border-radius:8px;padding:12px;margin-top:12px">';
    html += '<h4 style="margin-bottom:8px">Harga Spesial untuk ' + name + '</h4>';
    html += '<input type="hidden" id="vipCustId" value="' + customerId + '">';
    html += '<div style="max-height:300px;overflow-y:auto"><table class="table"><thead><tr><th>Produk</th><th>Normal</th><th>Harga VIP</th></tr></thead><tbody>';
    for (const p of vipProducts) {
      const ex = existing.find(e => e.product_id === p.id);
      html += '<tr><td>' + escHtml(p.name) + '</td><td>' + formatRp(p.price) + '</td>';
      html += '<td><input type="number" class="cust-vip-input" data-pid="' + p.id + '" value="' + (ex ? ex.special_price : '') + '" placeholder="-" style="width:120px;padding:4px;border-radius:4px;border:1px solid #ddd"></td></tr>';
    }
    html += '</tbody></table></div>';
    html += '<button class="btn btn-primary" onclick="saveCustomerVIP()" style="margin-top:8px">💾 Simpan</button>';
    html += '</div>';
    document.getElementById('vipCustForm').innerHTML = html;
    document.getElementById('vipCustForm').style.display = 'block';
  } catch(err) { showToast('Error: ' + err.message, 'error'); }
}

async function saveCustomerVIP() {
  const customerId = Number(document.getElementById('vipCustId').value);
  const inputs = document.querySelectorAll('.cust-vip-input');
  let saved = 0;
  for (const inp of inputs) {
    const val = Number(inp.value);
    const productId = Number(inp.dataset.pid);
    if (val > 0) {
      try {
        await apiFetch('/api/special-prices', { method: 'POST', body: JSON.stringify({ product_id: productId, customer_id: customerId, special_price: val }) });
        saved++;
      } catch(err) { console.error(err); }
    }
  }
  showToast(saved + ' harga VIP customer berhasil disimpan! 🧑', 'success');
  closeModal();
  renderVIPPrices();
}

async function editVIPPrice(id) {
  const price = vipAllPrices.find(p => p.id === id);
  if (!price) return;
  let html = '<div class="modal-header"><h3>✏️ Edit Harga VIP</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body">';
  html += '<div class="form-group"><label>Produk</label><input type="text" value="' + escHtml(price.product_name || '') + '" disabled class="form-control"></div>';
  html += '<div class="form-group"><label>Untuk</label><input type="text" value="' + (price.customer_name ? 'Customer: ' + price.customer_name : (price.level_icon || '') + ' ' + (price.level_name || '')) + '" disabled class="form-control"></div>';
  html += '<div class="form-group"><label>Harga Normal</label><input type="text" value="' + formatRp(price.normal_price) + '" disabled class="form-control"></div>';
  html += '<div class="form-group"><label>Harga VIP</label><input type="number" id="editVipPrice" value="' + price.special_price + '" class="form-control"></div>';
  html += '<div class="form-group"><label>Keterangan</label><input type="text" id="editVipDesc" value="' + escHtml(price.description || '') + '" class="form-control" placeholder="Opsional"></div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
  html += '<div class="form-group"><label>Mulai</label><input type="date" id="editVipStart" value="' + (price.start_date || '') + '" class="form-control"></div>';
  html += '<div class="form-group"><label>Berakhir</label><input type="date" id="editVipEnd" value="' + (price.end_date || '') + '" class="form-control"></div>';
  html += '</div>';
  html += '<div class="form-group"><label><input type="checkbox" id="editVipActive"' + (price.is_active ? ' checked' : '') + '> Aktif</label></div>';
  html += '</div>';
  html += '<div class="modal-footer"><button class="btn btn-primary" onclick="saveEditVIP(' + id + ')">💾 Simpan</button></div>';
  showModal(html);
}

async function saveEditVIP(id) {
  const price = vipAllPrices.find(p => p.id === id);
  try {
    await apiFetch('/api/special-prices', { method: 'POST', body: JSON.stringify({
      product_id: price.product_id,
      level_id: price.level_id,
      customer_id: price.customer_id,
      special_price: Number(document.getElementById('editVipPrice').value),
      description: document.getElementById('editVipDesc').value || null,
      start_date: document.getElementById('editVipStart').value || null,
      end_date: document.getElementById('editVipEnd').value || null,
      is_active: document.getElementById('editVipActive').checked ? 1 : 0
    })});
    showToast('Harga VIP diperbarui! ✅', 'success');
    closeModal();
    renderVIPPrices();
  } catch(err) { showToast('Gagal: ' + err.message, 'error'); }
}

async function deleteVIPPrice(id) {
  if (!confirm('Hapus harga VIP ini?')) return;
  try {
    await apiFetch('/api/special-prices/' + id, { method: 'DELETE' });
    showToast('Harga VIP dihapus', 'success');
    renderVIPPrices();
  } catch(err) { showToast('Gagal: ' + err.message, 'error'); }
}


