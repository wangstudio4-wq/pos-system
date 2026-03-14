// ============ HISTORI TRANSAKSI (KASIR) ============
let historyFilterState = { start_date: '', end_date: '', user_id: '' };
let historyUsersList = [];

async function renderHistory() {
  const main = document.getElementById('mainContent');
  try {
    const isOwner = currentUser && currentUser.role === 'owner';

    // Build endpoint with filters
    let endpoint = isOwner ? '/api/transactions' : '/api/my-transactions';
    if (isOwner) {
      const qp = [];
      if (historyFilterState.start_date && historyFilterState.end_date) {
        qp.push('start_date=' + historyFilterState.start_date);
        qp.push('end_date=' + historyFilterState.end_date);
      }
      if (historyFilterState.user_id) {
        qp.push('user_id=' + historyFilterState.user_id);
      }
      if (qp.length > 0) endpoint += '?' + qp.join('&');

      // Load users for filter dropdown (once)
      if (historyUsersList.length === 0) {
        try {
          const uData = await apiFetch('/api/users');
          historyUsersList = (uData.users || uData || []);
        } catch(e) { historyUsersList = []; }
      }
    }

    const data = await apiFetch(endpoint);
    const txs = data.transactions || data || [];

    let html = '<div class="page-header"><h1>🧾 Histori Transaksi</h1><p>' +
      (isOwner ? 'Semua transaksi dari seluruh kasir' : 'Riwayat transaksi Anda') + '</p></div>';

    // Filter bar (owner only)
    if (isOwner) {
      const today = new Date().toISOString().slice(0, 10);
      html += '<div class="card mb-4" style="padding:16px;">';
      html += '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">';
      html += '<div style="flex:1;min-width:140px;"><label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">📅 Dari</label>';
      html += '<input type="date" id="histFilterStart" value="' + (historyFilterState.start_date || '') + '" max="' + today + '" onchange="autoHistoryDateFilter()" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;"></div>';
      html += '<div style="flex:1;min-width:140px;"><label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">📅 Sampai</label>';
      html += '<input type="date" id="histFilterEnd" value="' + (historyFilterState.end_date || '') + '" max="' + today + '" onchange="autoHistoryDateFilter()" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;"></div>';
      html += '<div style="flex:1;min-width:160px;"><label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">👤 Kasir</label>';
      html += '<select id="histFilterUser" onchange="applyHistoryFilter()" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">';
      html += '<option value="">Semua Kasir</option>';
      historyUsersList.forEach(u => {
        const sel = (historyFilterState.user_id == u.id) ? ' selected' : '';
        html += '<option value="' + u.id + '"' + sel + '>' + escHtml(u.name || u.username) + ' (' + u.role + ')</option>';
      });
      html += '</select></div>';
      html += '<div style="display:flex;gap:8px;">';
      html += '<button onclick="applyHistoryFilter()" class="btn btn-primary" style="padding:8px 16px;font-size:14px;">🔍 Filter</button>';
      html += '<button onclick="resetHistoryFilter()" class="btn btn-secondary" style="padding:8px 16px;font-size:14px;">↻ Reset</button>';
      html += '</div></div></div>';
    }

    // Summary
    let totalRevenue = 0;
    txs.forEach(tx => { totalRevenue += Number(tx.total) || 0; });
    html += '<div class="stat-grid">';
    html += '<div class="stat-card stat-blue"><div class="stat-icon">🧾</div><div class="stat-value">' + txs.length + '</div><div class="stat-label">Total Transaksi</div></div>';
    html += '<div class="stat-card stat-green"><div class="stat-icon">💰</div><div class="stat-value">' + formatRp(totalRevenue) + '</div><div class="stat-label">Total Penjualan</div></div>';
    html += '</div>';

    if (txs.length > 0) {
      html += '<div class="card mt-4"><div class="card-header"><h3>📋 Daftar Transaksi</h3></div>';
      html += '<div class="overflow-x"><table><thead><tr><th>ID</th><th>Tanggal</th>';
      if (isOwner) html += '<th>Kasir</th>';
      html += '<th>Pelanggan</th><th>Total</th><th>Metode</th></tr></thead><tbody>';
      txs.forEach(tx => {
        html += '<tr class="clickable-row" onclick="showTransactionDetail(' + tx.id + ')">' +
          '<td>#' + tx.id + '</td>' +
          '<td>' + formatDateTime(tx.created_at || tx.date) + '</td>';
        if (isOwner) html += '<td><span style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:600;">👤 ' + escHtml(tx.user_name || 'Unknown') + '</span></td>';
        html += '<td>' + escHtml(tx.customer_name || 'Umum') + '</td>' +
          '<td><strong>' + formatRp(tx.total) + '</strong></td>' +
          '<td>' + payMethodBadge(tx.payment_method) + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    } else {
      html += '<div class="card mt-4">' + emptyHtml('🧾', 'Belum ada transaksi') + '</div>';
    }

    main.innerHTML = html;
  } catch (err) {
    main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat histori: ' + escHtml(err.message) + '</div>';
  }
}

function autoHistoryDateFilter() {
  const s = document.getElementById('histFilterStart').value;
  const e = document.getElementById('histFilterEnd').value;
  if (s && e) applyHistoryFilter();
}

function applyHistoryFilter() {
  historyFilterState.start_date = document.getElementById('histFilterStart').value;
  historyFilterState.end_date = document.getElementById('histFilterEnd').value;
  historyFilterState.user_id = document.getElementById('histFilterUser').value;
  renderHistory();
}

function resetHistoryFilter() {
  historyFilterState = { start_date: '', end_date: '', user_id: '' };
  renderHistory();
}

