// ============ KASBON (HUTANG) ============
async function renderKasbon() {
  const main = document.getElementById('mainContent');
  try {
    const { debts, summary } = await apiFetch('/api/debts');
    
    let html = '<div class="page-header"><h1>📝 Kasbon / Hutang</h1><p>Kelola hutang pelanggan</p></div>';
    
    // Summary cards
    html += '<div class="stats-grid">';
    html += '<div class="stat-card"><div class="stat-icon" style="background:#fef3c7;color:#d97706">📋</div><div class="stat-info"><div class="stat-value">' + (summary.unpaid_count + summary.partial_count) + '</div><div class="stat-label">Kasbon Aktif</div></div></div>';
    html += '<div class="stat-card"><div class="stat-icon" style="background:#fee2e2;color:#dc2626">💰</div><div class="stat-info"><div class="stat-value">' + formatRp(summary.total_remaining) + '</div><div class="stat-label">Total Hutang</div></div></div>';
    html += '<div class="stat-card"><div class="stat-icon" style="background:#dcfce7;color:#16a34a">✅</div><div class="stat-info"><div class="stat-value">' + formatRp(summary.total_paid) + '</div><div class="stat-label">Total Dibayar</div></div></div>';
    html += '<div class="stat-card"><div class="stat-icon" style="background:#e0e7ff;color:#4f46e5">📊</div><div class="stat-info"><div class="stat-value">' + summary.paid_count + '</div><div class="stat-label">Lunas</div></div></div>';
    html += '</div>';
    
    // Filter
    html += '<div class="toolbar">';
    html += '<input class="search-input" placeholder="🔍 Cari nama pelanggan..." oninput="filterKasbonTable(this.value)">';
    html += '<div class="spacer"></div>';
    html += '<select onchange="filterKasbonStatus(this.value)" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)"><option value="all">Semua Status</option><option value="unpaid">Belum Bayar</option><option value="partial">Bayar Sebagian</option><option value="paid">Lunas</option></select>';
    html += '</div>';
    
    // Table
    html += '<div class="card"><div class="overflow-x"><table id="kasbonTable"><thead><tr><th>Tanggal</th><th>Pelanggan</th><th>No HP</th><th>Total Hutang</th><th>Dibayar</th><th>Sisa</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    if (debts.length === 0) {
      html += '<tr><td colspan="8">' + emptyHtml('📝', 'Belum ada kasbon') + '</td></tr>';
    } else {
      debts.forEach(d => {
        const statusBadge = d.status === 'paid' ? '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:12px;font-size:11px">✅ Lunas</span>' :
          d.status === 'partial' ? '<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:12px;font-size:11px">⏳ Sebagian</span>' :
          '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:11px">❌ Belum</span>';
        html += '<tr data-search="' + escHtml((d.customer_name||'').toLowerCase()) + '" data-status="' + d.status + '">' +
          '<td>' + formatDate(d.created_at) + '</td>' +
          '<td><strong>' + escHtml(d.customer_name) + '</strong></td>' +
          '<td>' + escHtml(d.customer_phone || '-') + '</td>' +
          '<td>' + formatRp(d.amount) + '</td>' +
          '<td>' + formatRp(d.paid) + '</td>' +
          '<td><strong style="color:#dc2626">' + formatRp(d.remaining) + '</strong></td>' +
          '<td>' + statusBadge + '</td>' +
          '<td>' + (d.status !== 'paid' ? '<button class="btn btn-sm btn-success" onclick="showPayDebtModal(' + d.id + ',\'' + escHtml(d.customer_name).replace(/'/g, "\\'") + '\',' + d.remaining + ')">💵 Bayar</button> ' : '') +
          '<button class="btn btn-sm btn-primary" onclick="showDebtDetail(' + d.id + ')">📋</button></td></tr>';
      });
    }
    html += '</tbody></table></div></div>';
    
    main.innerHTML = html;
  } catch (err) {
    main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat kasbon: ' + escHtml(err.message) + '</div>';
  }
}

function filterKasbonTable(val) {
  const rows = document.querySelectorAll('#kasbonTable tbody tr');
  const s = val.toLowerCase();
  rows.forEach(r => { r.style.display = (r.dataset.search || '').includes(s) ? '' : 'none'; });
}

function filterKasbonStatus(status) {
  const rows = document.querySelectorAll('#kasbonTable tbody tr');
  rows.forEach(r => {
    if (status === 'all') r.style.display = '';
    else r.style.display = r.dataset.status === status ? '' : 'none';
  });
}

function showPayDebtModal(debtId, customerName, remaining) {
  let html = '<div class="modal-header"><h3>💵 Bayar Kasbon</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body">';
  html += '<div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:12px">';
  html += '<div style="font-weight:600">👤 ' + escHtml(customerName) + '</div>';
  html += '<div style="color:#dc2626;font-size:18px;font-weight:700;margin-top:4px">Sisa: ' + formatRp(remaining) + '</div>';
  html += '</div>';
  html += '<div class="form-group"><label>Jumlah Bayar *</label><input type="text" inputmode="numeric" id="debtPayAmount" oninput="formatMoneyInput(this)" placeholder="Masukkan jumlah..."></div>';
  html += '<div class="form-group"><label>Metode Bayar</label><select id="debtPayMethod"><option>Cash</option><option>QRIS</option><option>Transfer</option><option>Kartu</option></select></div>';
  html += '<div class="form-group"><label>Catatan</label><input id="debtPayNotes" placeholder="Opsional..."></div>';
  html += '<button class="btn btn-primary" style="width:100%" onclick="payDebtQuick(' + debtId + ')">Bayar Penuh ' + formatRp(remaining) + '</button>';
  html += '</div>';
  html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-success" onclick="payDebt(' + debtId + ')">💵 Bayar</button></div>';
  openModal(html);
  // Pre-fill full amount
  setTimeout(() => {
    const inp = document.getElementById('debtPayAmount');
    if (inp) { inp.value = formatDots(remaining); }
  }, 50);
}

async function payDebt(debtId) {
  const amount = parseMoneyValue('debtPayAmount');
  const payment_method = document.getElementById('debtPayMethod').value;
  const notes = document.getElementById('debtPayNotes').value;
  if (!amount || amount <= 0) { showToast('Jumlah bayar harus diisi!', 'error'); return; }
  try {
    const result = await apiFetch('/api/debts/' + debtId + '/pay', { method: 'POST', body: JSON.stringify({ amount, payment_method, notes }) });
    showToast(result.message, 'success');
    closeModal();
    renderKasbon();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function payDebtQuick(debtId) {
  payDebt(debtId);
}

async function showDebtDetail(debtId) {
  try {
    const { debt, payments, items } = await apiFetch('/api/debts/' + debtId);
    let html = '<div class="modal-header"><h3>📋 Detail Kasbon #' + debtId + '</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
    html += '<div class="modal-body">';
    
    const statusBadge = debt.status === 'paid' ? '✅ Lunas' : debt.status === 'partial' ? '⏳ Bayar Sebagian' : '❌ Belum Bayar';
    html += '<div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:12px">';
    html += '<div style="display:flex;justify-content:space-between"><strong>👤 ' + escHtml(debt.customer_name) + '</strong><span>' + statusBadge + '</span></div>';
    html += '<div style="color:#64748b;font-size:12px;margin-top:4px">' + formatDateTime(debt.created_at) + ' · Kasir: ' + escHtml(debt.user_name || '-') + '</div>';
    if (debt.customer_phone) html += '<div style="color:#64748b;font-size:12px">📞 ' + escHtml(debt.customer_phone) + '</div>';
    html += '</div>';
    
    // Items
    if (items.length > 0) {
      html += '<div style="margin-bottom:12px"><strong>🛒 Barang:</strong>';
      html += '<table style="width:100%;font-size:12px;margin-top:4px"><thead><tr><th style="text-align:left">Produk</th><th>Qty</th><th style="text-align:right">Harga</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>';
      items.forEach(i => {
        html += '<tr><td>' + escHtml(i.product_name) + '</td><td style="text-align:center">' + i.qty + '</td><td style="text-align:right">' + formatRp(i.price) + '</td><td style="text-align:right">' + formatRp(i.subtotal) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    
    // Summary
    html += '<div style="display:flex;gap:12px;margin-bottom:12px">';
    html += '<div style="flex:1;background:#fee2e2;padding:8px;border-radius:8px;text-align:center"><div style="font-size:11px;color:#92400e">Total</div><div style="font-weight:700;color:#dc2626">' + formatRp(debt.amount) + '</div></div>';
    html += '<div style="flex:1;background:#dcfce7;padding:8px;border-radius:8px;text-align:center"><div style="font-size:11px;color:#166534">Dibayar</div><div style="font-weight:700;color:#16a34a">' + formatRp(debt.paid) + '</div></div>';
    html += '<div style="flex:1;background:#fef3c7;padding:8px;border-radius:8px;text-align:center"><div style="font-size:11px;color:#92400e">Sisa</div><div style="font-weight:700;color:#d97706">' + formatRp(debt.remaining) + '</div></div>';
    html += '</div>';
    
    // Payment history
    if (payments.length > 0) {
      html += '<strong>💵 Riwayat Pembayaran:</strong>';
      html += '<table style="width:100%;font-size:12px;margin-top:4px"><thead><tr><th style="text-align:left">Tanggal</th><th style="text-align:right">Jumlah</th><th>Metode</th><th style="text-align:left">Oleh</th></tr></thead><tbody>';
      payments.forEach(p => {
        html += '<tr><td>' + formatDateTime(p.created_at) + '</td><td style="text-align:right;color:#16a34a;font-weight:600">' + formatRp(p.amount) + '</td><td style="text-align:center">' + escHtml(p.payment_method) + '</td><td>' + escHtml(p.user_name || '-') + '</td></tr>';
      });
      html += '</tbody></table>';
    }
    
    html += '</div>';
    html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Tutup</button></div>';
    openModal(html);
  } catch (err) {
    showToast('Gagal memuat detail: ' + err.message, 'error');
  }
}

