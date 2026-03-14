// ============ REPORTS ============
let reportPeriod = 'today';
let reportStartDate = '';
let reportEndDate = '';
let lastReportsData = null;
let lastPLData = null;

async function renderReports() {
  const main = document.getElementById('mainContent');
  try {
    let reportUrl = '/api/reports/sales?period=' + reportPeriod;
    if (reportPeriod === 'custom' && reportStartDate && reportEndDate) {
      reportUrl = '/api/reports/sales?start_date=' + reportStartDate + '&end_date=' + reportEndDate;
    }
    const data = await apiFetch(reportUrl);
    lastReportsData = data;
    const summary = data.summary || {};
    const perCashier = data.per_cashier || [];
    const topProducts = data.top_products || [];
    const byPayment = data.by_payment || [];

    let html = '<div class="page-header"><h1>📈 Laporan Penjualan</h1><p>Analisis penjualan bisnis Anda</p></div>';

    // Period filter with custom date
    html += '<div class="toolbar"><div class="category-pills">';
    [['today','Hari Ini'],['week','Minggu Ini'],['month','Bulan Ini'],['all','Semua'],['custom','📅 Custom']].forEach(([val, label]) => {
      html += '<div class="category-pill' + (reportPeriod === val ? ' active' : '') + '" onclick="changeReportPeriod(\'' + val + '\')">' + label + '</div>';
    });
    html += '</div><button class="btn btn-primary" onclick="exportReportsExcel()" style="padding:8px 16px;font-size:14px">📥 Export Excel</button></div>';

    // Custom date range picker
    if (reportPeriod === 'custom') {
      html += '<div class="card" style="padding:16px;margin-bottom:16px;display:flex;flex-wrap:wrap;align-items:center;gap:12px">';
      html += '<div style="display:flex;align-items:center;gap:8px"><label style="font-weight:600;font-size:14px">Dari:</label>';
      html += '<input type="date" id="reportStartDate" value="' + reportStartDate + '" style="padding:8px 12px;border:2px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg-card);color:var(--text)" /></div>';
      html += '<div style="display:flex;align-items:center;gap:8px"><label style="font-weight:600;font-size:14px">Sampai:</label>';
      html += '<input type="date" id="reportEndDate" value="' + reportEndDate + '" style="padding:8px 12px;border:2px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg-card);color:var(--text)" /></div>';
      html += '<button class="btn btn-primary" onclick="applyReportDateRange()" style="padding:8px 20px">🔍 Tampilkan</button>';
      html += '</div>';
    }

    // Summary cards
    html += '<div class="stat-grid">';
    html += '<div class="stat-card stat-green"><div class="stat-icon">💰</div><div class="stat-value">' + formatRp(summary.total_revenue || summary.revenue) + '</div><div class="stat-label">Total Pendapatan</div></div>';
    html += '<div class="stat-card stat-blue"><div class="stat-icon">🧾</div><div class="stat-value">' + (summary.total_transactions || summary.transactions || 0) + '</div><div class="stat-label">Total Transaksi</div></div>';
    html += '<div class="stat-card stat-purple"><div class="stat-icon">📊</div><div class="stat-value">' + formatRp(summary.average || summary.avg_transaction || 0) + '</div><div class="stat-label">Rata-rata Transaksi</div></div>';
    html += '</div>';

    html += '<div class="dash-grid">';

    // Per cashier
    html += '<div class="card"><div class="card-header"><h3>👤 Per Kasir</h3></div>';
    if (perCashier.length > 0) {
      html += '<div class="overflow-x"><table><thead><tr><th>Kasir</th><th>Transaksi</th><th>Revenue</th></tr></thead><tbody>';
      perCashier.forEach(c => {
        html += '<tr><td><strong>' + escHtml(c.user_name || c.name || c.username || c.cashier_name || 'Kasir') + '</strong></td><td>' + (c.transactions || c.total_transactions || 0) + '</td><td>' + formatRp(c.revenue || c.total_revenue) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else { html += emptyHtml('👤', 'Tidak ada data'); }
    html += '</div>';

    // By payment method
    html += '<div class="card"><div class="card-header"><h3>💳 Per Metode Bayar</h3></div>';
    if (byPayment.length > 0) {
      html += '<div class="overflow-x"><table><thead><tr><th>Metode</th><th>Jumlah</th><th>Total</th></tr></thead><tbody>';
      byPayment.forEach(p => {
        html += '<tr><td>' + payMethodBadge(p.payment_method || p.method) + '</td><td>' + (p.count || p.transactions || 0) + '</td><td>' + formatRp(p.total || p.revenue) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else { html += emptyHtml('💳', 'Tidak ada data'); }
    html += '</div>';

    // By category
    html += '<div class="card"><div class="card-header"><h3>📊 Per Kategori</h3></div>';
    const byCategory = data.by_category || [];
    if (byCategory.length > 0) {
      html += '<div class="overflow-x"><table><thead><tr><th>Kategori</th><th>Transaksi</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>';
      byCategory.forEach(c => {
        html += '<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + escHtml(c.category_color) + ';margin-right:6px"></span><strong>' + escHtml(c.category_name) + '</strong></td><td>' + (c.transactions || 0) + '</td><td>' + (c.total_qty || 0) + '</td><td>' + formatRp(c.total_revenue) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else { html += emptyHtml('📊', 'Tidak ada data kategori'); }
    html += '</div>';

    html += '</div>'; // end dash-grid

    // Top products
    html += '<div class="card mt-4"><div class="card-header"><h3>🏆 Produk Terlaris</h3></div>';
    if (topProducts.length > 0) {
      html += '<div class="overflow-x"><table><thead><tr><th>#</th><th>Produk</th><th>Terjual</th><th>Revenue</th></tr></thead><tbody>';
      topProducts.forEach((p, i) => {
        html += '<tr><td>' + (i+1) + '</td><td><strong>' + escHtml(p.name || p.product_name) + '</strong></td><td>' + (p.total_qty || p.qty || 0) + '</td><td>' + formatRp(p.total_revenue || p.revenue) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else { html += emptyHtml('🏆', 'Tidak ada data'); }
    html += '</div>';

    // By shift
    const byShift = data.by_shift || [];
    if (byShift.length > 0) {
      html += '<div class="card mt-4"><div class="card-header"><h3>⏰ Laporan per Shift</h3></div>';
      html += '<div class="overflow-x"><table><thead><tr><th>Kasir</th><th>Mulai</th><th>Selesai</th><th>Status</th><th>Transaksi</th><th>Revenue</th></tr></thead><tbody>';
      byShift.forEach(s => {
        const statusBadge = s.status === 'open' 
          ? '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">Buka</span>'
          : '<span style="background:#e2e8f0;color:#64748b;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">Tutup</span>';
        html += '<tr><td><strong>' + escHtml(s.user_name) + '</strong></td><td>' + escHtml(s.opened_at || '-') + '</td><td>' + escHtml(s.closed_at || '-') + '</td><td>' + statusBadge + '</td><td>' + (s.transactions || 0) + '</td><td>' + formatRp(s.revenue) + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }

    // Hourly analysis
    const byHour = data.by_hour || [];
    if (byHour.length > 0) {
      html += '<div class="card mt-4"><div class="card-header"><h3>🕐 Penjualan per Jam</h3></div>';
      // Find peak hour
      const peakHour = byHour.reduce((max, h) => h.revenue > max.revenue ? h : max, byHour[0]);
      html += '<div style="padding:12px 16px;background:linear-gradient(135deg,rgba(65,93,67,.05),rgba(113,151,117,.05));border-bottom:1px solid var(--border)">';
      html += '<span style="font-size:13px">🔥 <strong>Peak Hour:</strong> ' + String(peakHour.hour).padStart(2,'0') + ':00 — ' + formatRp(peakHour.revenue) + ' (' + peakHour.transactions + ' transaksi)</span></div>';
      // Bar chart using div bars
      const maxRev = Math.max(...byHour.map(h => Number(h.revenue)));
      html += '<div style="padding:16px;overflow-x:auto"><div style="display:flex;align-items:flex-end;gap:4px;height:160px;min-width:' + (byHour.length * 32) + 'px">';
      byHour.forEach(h => {
        const pct = maxRev > 0 ? (Number(h.revenue) / maxRev * 100) : 0;
        const isPeak = h.hour === peakHour.hour;
        html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">';
        html += '<div style="font-size:10px;color:#64748b">' + formatRp(h.revenue).replace('Rp ','') + '</div>';
        html += '<div style="width:100%;max-width:28px;height:' + Math.max(pct, 3) + '%;background:' + (isPeak ? 'linear-gradient(180deg,#415D43,#709775)' : '#d5e5d6') + ';border-radius:4px 4px 0 0;transition:height .3s"></div>';
        html += '<div style="font-size:10px;font-weight:' + (isPeak ? '700' : '500') + ';color:' + (isPeak ? '#415D43' : '#94a3b8') + '">' + String(h.hour).padStart(2,'0') + '</div>';
        html += '</div>';
      });
      html += '</div></div></div>';
    }

    // Transaction list
    let txUrl = '/api/transactions?start_date=&end_date=';
    if (reportPeriod === 'custom' && reportStartDate && reportEndDate) {
      txUrl = '/api/transactions?start_date=' + reportStartDate + '&end_date=' + reportEndDate;
    }
    const txData = await apiFetch(txUrl).catch(() => ({ transactions: [] }));
    const txs = txData.transactions || txData || [];
    if (Array.isArray(txs) && txs.length > 0) {
      html += '<div class="card mt-4"><div class="card-header"><h3>🧾 Daftar Transaksi</h3></div>';
      html += '<div class="overflow-x"><table><thead><tr><th>ID</th><th>Tanggal</th><th>Total</th><th>Metode</th><th>Kasir</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
      txs.slice(0, 50).forEach(tx => {
        const st = tx.status || 'completed';
        const statusBadge = st === 'void' ? '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">VOID</span>'
          : st === 'refund' ? '<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">REFUND</span>'
          : '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">✓</span>';
        const actions = st === 'completed' ?
          '<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();voidTransaction(' + tx.id + ')" title="Void">🚫</button> ' +
          '<button class="btn btn-sm btn-warning" onclick="event.stopPropagation();refundTransaction(' + tx.id + ')" title="Refund" style="background:#f59e0b;color:#fff">↩️</button>'
          : '<span style="font-size:11px;color:#94a3b8">' + escHtml(tx.void_reason || '-') + '</span>';
        html += '<tr class="clickable-row" onclick="showTransactionDetail(' + tx.id + ')">' +
          '<td>#' + tx.id + '</td>' +
          '<td>' + formatDateTime(tx.created_at || tx.date) + '</td>' +
          '<td><strong>' + formatRp(tx.total) + '</strong></td>' +
          '<td>' + payMethodBadge(tx.payment_method) + '</td>' +
          '<td>' + escHtml(tx.cashier_name || tx.user_name || '-') + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td>' + actions + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }

    main.innerHTML = html;
  } catch (err) { main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat: ' + escHtml(err.message) + '</div>'; }
}


