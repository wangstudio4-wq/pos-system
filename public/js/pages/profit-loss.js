// ============ LABA RUGI ============
let plPeriod = 'month';
let plStartDate = '';
let plEndDate = '';

async function renderProfitLoss() {
  const main = document.getElementById('mainContent');
  try {
    let plUrl = '/api/reports/profit-loss?period=' + plPeriod;
    if (plPeriod === 'custom' && plStartDate && plEndDate) {
      plUrl = '/api/reports/profit-loss?start_date=' + plStartDate + '&end_date=' + plEndDate;
    }
    const data = await apiFetch(plUrl);
    lastPLData = data;
    const s = data.summary || {};
    const byProduct = data.by_product || [];
    const expByCat = data.expenses_by_category || [];
    const purchBySupp = data.purchases_by_supplier || [];
    const trend = (data.daily_trend || []).reverse();

    let html = '<div class="page-header"><h1>💹 Laporan Laba Rugi</h1><p>Analisis profitabilitas bisnis Anda</p></div>';

    // Period filter with custom date
    html += '<div class="toolbar"><div class="category-pills">';
    [['today','Hari Ini'],['week','7 Hari'],['month','30 Hari'],['all','Semua'],['custom','📅 Custom']].forEach(([val, label]) => {
      html += '<div class="category-pill' + (plPeriod === val ? ' active' : '') + '" onclick="changePLPeriod(\'' + val + '\')">' + label + '</div>';
    });
    html += '</div><button class="btn btn-primary" onclick="exportProfitLossExcel()" style="padding:8px 16px;font-size:14px">📥 Export Excel</button></div>';

    // Custom date range picker
    if (plPeriod === 'custom') {
      html += '<div class="card" style="padding:16px;margin-bottom:16px;display:flex;flex-wrap:wrap;align-items:center;gap:12px">';
      html += '<div style="display:flex;align-items:center;gap:8px"><label style="font-weight:600;font-size:14px">Dari:</label>';
      html += '<input type="date" id="plStartDate" value="' + plStartDate + '" style="padding:8px 12px;border:2px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg-card);color:var(--text)" /></div>';
      html += '<div style="display:flex;align-items:center;gap:8px"><label style="font-weight:600;font-size:14px">Sampai:</label>';
      html += '<input type="date" id="plEndDate" value="' + plEndDate + '" style="padding:8px 12px;border:2px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg-card);color:var(--text)" /></div>';
      html += '<button class="btn btn-primary" onclick="applyPLDateRange()" style="padding:8px 20px">🔍 Tampilkan</button>';
      html += '</div>';
    }

    // Summary cards - waterfall style
    html += '<div class="pl-summary">';
    html += '<div class="pl-card pl-revenue"><div class="pl-value">' + formatRp(s.total_revenue) + '</div><div class="pl-label">💰 Pendapatan</div></div>';
    html += '<div class="pl-card pl-cogs"><div class="pl-value">' + formatRp(s.total_cogs) + '</div><div class="pl-label">📦 HPP (Modal)</div></div>';
    html += '<div class="pl-card pl-gross"><div class="pl-value">' + formatRp(s.gross_profit) + '</div><div class="pl-label">📊 Laba Kotor</div><div class="pl-margin">Margin ' + (s.margin_percent || 0) + '%</div></div>';
    html += '<div class="pl-card pl-expense"><div class="pl-value">' + formatRp(s.total_expenses) + '</div><div class="pl-label">💸 Pengeluaran</div></div>';
    
    const isProfit = (s.net_profit || 0) >= 0;
    html += '<div class="pl-card ' + (isProfit ? 'pl-net-profit' : 'pl-net-loss') + '">';
    html += '<div class="pl-value">' + (isProfit ? '' : '-') + formatRp(Math.abs(s.net_profit || 0)) + '</div>';
    html += '<div class="pl-label">' + (isProfit ? '🎉 LABA BERSIH' : '😞 RUGI BERSIH') + '</div>';
    html += '</div>';
    html += '</div>';

    // Cash Flow / Arus Kas summary
    if (Number(s.total_stock_purchases) > 0 || Number(s.total_expenses) > 0) {
      const isCashPositive = (s.net_cash_flow || 0) >= 0;
      html += '<div class="card mt-4" style="border-left:4px solid ' + (isCashPositive ? '#10b981' : '#ef4444') + '">';
      html += '<div class="card-header"><h3>💰 Arus Kas (Cash Flow)</h3></div>';
      html += '<div style="padding:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;text-align:center">';
      html += '<div><div style="font-size:13px;color:#94a3b8;margin-bottom:4px">💵 Uang Masuk</div><div style="font-size:20px;font-weight:800;color:#10b981">' + formatRp(s.cash_in) + '</div><div style="font-size:12px;color:#94a3b8">dari penjualan</div></div>';
      html += '<div><div style="font-size:13px;color:#94a3b8;margin-bottom:4px">📦 Pembelian Stok</div><div style="font-size:20px;font-weight:800;color:#d97706">' + formatRp(s.total_stock_purchases) + '</div><div style="font-size:12px;color:#94a3b8">ke supplier</div></div>';
      html += '<div><div style="font-size:13px;color:#94a3b8;margin-bottom:4px">💸 Pengeluaran Lain</div><div style="font-size:20px;font-weight:800;color:#ef4444">' + formatRp(s.total_expenses) + '</div><div style="font-size:12px;color:#94a3b8">operasional</div></div>';
      html += '<div><div style="font-size:13px;color:#94a3b8;margin-bottom:4px">' + (isCashPositive ? '✅' : '⚠️') + ' Arus Kas Bersih</div><div style="font-size:22px;font-weight:800;color:' + (isCashPositive ? '#10b981' : '#ef4444') + '">' + (isCashPositive ? '+' : '') + formatRp(s.net_cash_flow) + '</div><div style="font-size:12px;color:#94a3b8">masuk - keluar</div></div>';
      html += '</div></div>';
    }

    // Detail breakdown
    html += '<div class="card mt-4"><div class="card-header"><h3>📋 Rincian Laba Rugi</h3></div>';
    html += '<div style="padding:16px"><table style="width:100%;border-collapse:collapse">';
    html += '<tr style="border-bottom:2px solid var(--border)"><td style="padding:10px 0;font-weight:700;font-size:15px">💰 PENDAPATAN</td><td style="text-align:right;padding:10px 0;font-weight:700;font-size:15px">' + formatRp(s.total_revenue) + '</td></tr>';
    if (Number(s.total_discount) > 0) html += '<tr style="color:#999"><td style="padding:6px 0 6px 20px">Diskon</td><td style="text-align:right">-' + formatRp(s.total_discount) + '</td></tr>';
    if (Number(s.total_tax) > 0) html += '<tr style="color:#999"><td style="padding:6px 0 6px 20px">Termasuk Pajak</td><td style="text-align:right">' + formatRp(s.total_tax) + '</td></tr>';
    if (Number(s.total_service) > 0) html += '<tr style="color:#999"><td style="padding:6px 0 6px 20px">Termasuk Service</td><td style="text-align:right">' + formatRp(s.total_service) + '</td></tr>';
    html += '<tr style="border-bottom:2px solid var(--border)"><td style="padding:10px 0;font-weight:700;font-size:15px">📦 HPP (Harga Pokok Penjualan)</td><td style="text-align:right;padding:10px 0;font-weight:700;font-size:15px;color:#d97706">-' + formatRp(s.total_cogs) + '</td></tr>';
    html += '<tr style="border-bottom:2px solid var(--primary);background:rgba(65,93,67,0.05)"><td style="padding:12px 0;font-weight:800;font-size:16px">📊 LABA KOTOR</td><td style="text-align:right;padding:12px 0;font-weight:800;font-size:16px;color:#10b981">' + formatRp(s.gross_profit) + ' <small style="font-weight:500">(' + (s.margin_percent||0) + '%)</small></td></tr>';
    html += '<tr style="border-bottom:2px solid var(--border)"><td style="padding:10px 0;font-weight:700;font-size:15px">💸 PENGELUARAN OPERASIONAL</td><td style="text-align:right;padding:10px 0;font-weight:700;font-size:15px;color:#ef4444">-' + formatRp(s.total_expenses) + '</td></tr>';
    
    // Expense breakdown
    expByCat.forEach(e => {
      html += '<tr style="color:#999"><td style="padding:4px 0 4px 20px">' + escHtml(e.category || 'Lainnya') + '</td><td style="text-align:right">-' + formatRp(e.total) + '</td></tr>';
    });
    
    html += '<tr style="background:' + (isProfit ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') + '"><td style="padding:14px 0;font-weight:800;font-size:18px">' + (isProfit ? '🎉' : '😞') + ' LABA BERSIH</td><td style="text-align:right;padding:14px 0;font-weight:800;font-size:18px;color:' + (isProfit ? '#10b981' : '#ef4444') + '">' + (isProfit ? '' : '-') + formatRp(Math.abs(s.net_profit||0)) + '</td></tr>';

    // Stock Purchases section in rincian
    if (Number(s.total_stock_purchases) > 0) {
      html += '<tr style="border-top:3px solid var(--border)"><td colspan="2" style="padding:8px 0 4px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Informasi Arus Kas</td></tr>';
      html += '<tr style="border-bottom:2px solid var(--border)"><td style="padding:10px 0;font-weight:700;font-size:15px">📦 PEMBELIAN STOK</td><td style="text-align:right;padding:10px 0;font-weight:700;font-size:15px;color:#d97706">-' + formatRp(s.total_stock_purchases) + '</td></tr>';
      purchBySupp.forEach(p => {
        html += '<tr style="color:#999"><td style="padding:4px 0 4px 20px">' + escHtml(p.supplier_name || 'Tanpa Supplier') + ' <small>(' + p.total_invoices + ' invoice)</small></td><td style="text-align:right">-' + formatRp(p.total) + '</td></tr>';
      });
      const isCashPos = (s.net_cash_flow || 0) >= 0;
      html += '<tr style="background:' + (isCashPos ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)') + '"><td style="padding:12px 0;font-weight:700;font-size:16px">💰 ARUS KAS BERSIH</td><td style="text-align:right;padding:12px 0;font-weight:700;font-size:16px;color:' + (isCashPos ? '#10b981' : '#ef4444') + '">' + (isCashPos ? '+' : '') + formatRp(s.net_cash_flow || 0) + '</td></tr>';
    }

    html += '</table></div></div>';

    // Profit by product
    html += '<div class="dash-grid mt-4">';
    html += '<div class="card"><div class="card-header"><h3>🏆 Profit per Produk</h3></div>';
    if (byProduct.length > 0) {
      html += '<div class="overflow-x"><table><thead><tr><th>Produk</th><th>Qty</th><th>Penjualan</th><th>Modal</th><th>Profit</th><th>Margin</th></tr></thead><tbody>';
      byProduct.forEach(p => {
        const profit = Number(p.profit) || 0;
        const margin = Number(p.total_sales) > 0 ? ((profit / Number(p.total_sales)) * 100).toFixed(1) : 0;
        const cls = profit >= 0 ? 'profit-positive' : 'profit-negative';
        html += '<tr><td><strong>' + escHtml(p.product_name) + '</strong></td>' +
          '<td>' + (p.total_qty||0) + '</td>' +
          '<td>' + formatRp(p.total_sales) + '</td>' +
          '<td>' + formatRp(p.total_cost) + '</td>' +
          '<td class="' + cls + '">' + (profit >= 0 ? '+' : '') + formatRp(profit) + '</td>' +
          '<td class="' + cls + '">' + margin + '%</td></tr>';
      });
      html += '</tbody></table></div>';
    } else { html += emptyHtml('🏆', 'Tidak ada data produk'); }
    html += '</div>';

    // Expenses by category
    html += '<div class="card"><div class="card-header"><h3>💸 Pengeluaran per Kategori</h3></div>';
    if (expByCat.length > 0) {
      html += '<div class="overflow-x"><table><thead><tr><th>Kategori</th><th>Total</th><th>%</th></tr></thead><tbody>';
      const totalExp = Number(s.total_expenses) || 1;
      expByCat.forEach(e => {
        const pct = ((Number(e.total) / totalExp) * 100).toFixed(1);
        html += '<tr><td><strong>' + escHtml(e.category || 'Lainnya') + '</strong></td><td>' + formatRp(e.total) + '</td><td>' + pct + '%</td></tr>';
      });
      html += '</tbody></table></div>';
    } else { html += emptyHtml('💸', 'Tidak ada pengeluaran'); }
    html += '</div>';
    html += '</div>'; // end dash-grid

    // Purchases by supplier
    if (purchBySupp.length > 0) {
      html += '<div class="card mt-4"><div class="card-header"><h3>📦 Pembelian Stok per Supplier</h3></div>';
      html += '<div class="overflow-x"><table><thead><tr><th>Supplier</th><th>Jumlah Invoice</th><th>Total Pembelian</th><th>%</th></tr></thead><tbody>';
      const totalPurch = Number(s.total_stock_purchases) || 1;
      purchBySupp.forEach(p => {
        const pct = ((Number(p.total) / totalPurch) * 100).toFixed(1);
        html += '<tr><td><strong>' + escHtml(p.supplier_name || 'Tanpa Supplier') + '</strong></td><td>' + p.total_invoices + '</td><td>' + formatRp(p.total) + '</td><td>' + pct + '%</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }

    // Daily trend
    if (trend.length > 1) {
      html += '<div class="card mt-4"><div class="card-header"><h3>📈 Trend Harian</h3></div>';
      html += '<div class="overflow-x"><table><thead><tr><th>Tanggal</th><th>Pendapatan</th><th>HPP</th><th>Laba Kotor</th></tr></thead><tbody>';
      trend.forEach(d => {
        const gp = Number(d.revenue) - Number(d.cogs);
        html += '<tr><td>' + escHtml(d.date) + '</td><td>' + formatRp(d.revenue) + '</td><td>' + formatRp(d.cogs) + '</td><td class="' + (gp >= 0 ? 'profit-positive' : 'profit-negative') + '">' + (gp >= 0 ? '+' : '') + formatRp(gp) + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }

    main.innerHTML = html;
  } catch (err) {
    main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat laporan: ' + escHtml(err.message) + '</div>';
  }
}

function changePLPeriod(p) {
  plPeriod = p;
  if (p !== 'custom') { plStartDate = ''; plEndDate = ''; }
  renderProfitLoss();
}

function changeReportPeriod(p) {
  reportPeriod = p;
  if (p !== 'custom') { reportStartDate = ''; reportEndDate = ''; }
  renderReports();
}

function applyReportDateRange() {
  const s = document.getElementById('reportStartDate');
  const e = document.getElementById('reportEndDate');
  if (!s || !e || !s.value || !e.value) { showToast('Pilih tanggal mulai dan akhir', 'warning'); return; }
  if (s.value > e.value) { showToast('Tanggal mulai tidak boleh lebih dari tanggal akhir', 'warning'); return; }
  reportStartDate = s.value;
  reportEndDate = e.value;
  renderReports();
}

function applyPLDateRange() {
  const s = document.getElementById('plStartDate');
  const e = document.getElementById('plEndDate');
  if (!s || !e || !s.value || !e.value) { showToast('Pilih tanggal mulai dan akhir', 'warning'); return; }
  if (s.value > e.value) { showToast('Tanggal mulai tidak boleh lebih dari tanggal akhir', 'warning'); return; }
  plStartDate = s.value;
  plEndDate = e.value;
  renderProfitLoss();
}

function exportReportsExcel() {
  if (!lastReportsData) { showToast('Tidak ada data untuk diekspor', 'warning'); return; }
  try {
    const wb = XLSX.utils.book_new();
    const data = lastReportsData;
    const summary = data.summary || {};

    // Sheet 1: Ringkasan
    const summaryRows = [
      { Metrik: 'Total Pendapatan', Nilai: summary.total_revenue || 0 },
      { Metrik: 'Total Transaksi', Nilai: summary.total_transactions || 0 },
      { Metrik: 'Rata-rata Transaksi', Nilai: summary.avg_transaction || 0 },
      { Metrik: 'Total Diskon', Nilai: summary.total_discount || 0 }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan');

    // Sheet 2: Per Kasir
    const cashierRows = (data.per_cashier || []).map(c => ({
      Kasir: c.user_name || c.name || 'Kasir',
      Transaksi: c.transactions || c.total_transactions || 0,
      Revenue: c.revenue || c.total_revenue || 0
    }));
    if (cashierRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cashierRows), 'Per Kasir');

    // Sheet 3: Per Metode Bayar
    const payRows = (data.by_payment || []).map(p => ({
      Metode: p.payment_method || p.method || '-',
      Jumlah: p.count || p.transactions || 0,
      Total: p.total || p.revenue || 0
    }));
    if (payRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payRows), 'Per Metode Bayar');

    // Sheet 4: Produk Terlaris
    const prodRows = (data.top_products || []).map((p, i) => ({
      No: i + 1,
      Produk: p.name || p.product_name || '-',
      Terjual: p.total_qty || p.qty || 0,
      Revenue: p.total_revenue || p.revenue || 0
    }));
    if (prodRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodRows), 'Produk Terlaris');

    // Sheet 5: Daftar Transaksi (from cached txs if available)
    const byCategory = (data.by_category || []).map(c => ({
      Kategori: c.category_name || '-',
      Transaksi: c.transactions || 0,
      Qty: c.total_qty || 0,
      Revenue: c.total_revenue || 0
    }));
    if (byCategory.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byCategory), 'Per Kategori');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, 'Laporan-Penjualan-' + today + '.xlsx');
    showToast('Laporan berhasil diekspor!', 'success');
  } catch (err) { showToast('Gagal export: ' + err.message, 'error'); }
}

function exportProfitLossExcel() {
  if (!lastPLData) { showToast('Tidak ada data untuk diekspor', 'warning'); return; }
  try {
    const wb = XLSX.utils.book_new();
    const data = lastPLData;
    const s = data.summary || {};

    // Sheet 1: Ringkasan Laba Rugi
    const summaryRows = [
      { Keterangan: 'Pendapatan', Nilai: s.total_revenue || 0 },
      { Keterangan: 'Diskon', Nilai: -(s.total_discount || 0) },
      { Keterangan: 'HPP (Harga Pokok Penjualan)', Nilai: -(s.total_cogs || 0) },
      { Keterangan: 'Laba Kotor', Nilai: s.gross_profit || 0 },
      { Keterangan: 'Margin (%)', Nilai: (s.margin_percent || 0) + '%' },
      { Keterangan: 'Total Pengeluaran', Nilai: -(s.total_expenses || 0) },
      { Keterangan: 'Laba Bersih', Nilai: s.net_profit || 0 }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan Laba Rugi');

    // Sheet 2: Profit per Produk
    const prodRows = (data.by_product || []).map(p => ({
      Produk: p.product_name || '-',
      Qty: p.total_qty || 0,
      Penjualan: p.total_sales || 0,
      Modal: p.total_cost || 0,
      Profit: p.profit || 0,
      'Margin (%)': Number(p.total_sales) > 0 ? ((Number(p.profit) / Number(p.total_sales)) * 100).toFixed(1) + '%' : '0%'
    }));
    if (prodRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodRows), 'Profit per Produk');

    // Sheet 3: Pengeluaran per Kategori
    const expRows = (data.expenses_by_category || []).map(e => ({
      Kategori: e.category || 'Lainnya',
      Total: e.total || 0
    }));
    if (expRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows), 'Pengeluaran per Kategori');

    // Sheet 4: Trend Harian
    const trendRows = (data.daily_trend || []).map(d => ({
      Tanggal: d.date || '-',
      Pendapatan: d.revenue || 0,
      HPP: d.cogs || 0,
      'Laba Kotor': (Number(d.revenue) || 0) - (Number(d.cogs) || 0)
    }));
    if (trendRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendRows), 'Trend Harian');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, 'Laba-Rugi-' + today + '.xlsx');
    showToast('Laporan Laba Rugi berhasil diekspor!', 'success');
  } catch (err) { showToast('Gagal export: ' + err.message, 'error'); }
}

async function showTransactionDetail(id) {
  try {
    const data = await apiFetch('/api/transactions/' + id);
    const tx = data.transaction || data;
    const items = data.items || tx.items || [];
    let html = '<div class="modal-header"><h3>🧾 Detail Transaksi #' + escHtml(String(tx.id)) + '</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
    html += '<div class="modal-body"><div class="receipt">';
    const dtStoreName = appSettings.store_name || 'KasirPro';
    const dtLogoHtml = appSettings.store_logo_url ? '<img src="' + escHtml(appSettings.store_logo_url) + '" style="max-height:50px;max-width:150px;margin-bottom:4px" alt="">' : '';
    const dtStoreAddr = appSettings.store_address ? '<p style="font-size:10px;margin:2px 0">' + escHtml(appSettings.store_address) + '</p>' : '';
    const dtStorePhone = appSettings.store_phone ? '<p style="font-size:10px;margin:2px 0">📞 ' + escHtml(appSettings.store_phone) + '</p>' : '';
    html += '<div class="receipt-header">' + dtLogoHtml + '<h3>' + escHtml(dtStoreName) + '</h3>' + dtStoreAddr + dtStorePhone + '</div>';
    html += '<div class="receipt-divider"></div>';
    html += '<div class="receipt-row"><span>Tanggal</span><span>' + formatDateTime(tx.created_at || tx.date) + '</span></div>';
    html += '<div class="receipt-row"><span>Kasir</span><span>' + escHtml(tx.cashier_name || tx.user_name || '-') + '</span></div>';
    html += '<div class="receipt-divider"></div>';
    items.forEach(item => {
      html += '<div class="receipt-item"><div class="item-name">' + escHtml(item.name || item.product_name) + '</div>';
      html += '<div class="item-detail"><span>' + item.qty + ' x ' + formatRp(item.price) + (Number(item.discount) > 0 ? ' disc ' + formatRp(item.discount) : '') + '</span><span>' + formatRp((item.price * item.qty) - (Number(item.discount)||0)) + '</span></div></div>';
    });
    html += '<div class="receipt-divider"></div>';
    html += '<div class="receipt-row"><span>Subtotal</span><span>' + formatRp(tx.subtotal) + '</span></div>';
    if (Number(tx.discount) > 0) html += '<div class="receipt-row"><span>Diskon</span><span>-' + formatRp(tx.discount) + '</span></div>';
    html += '<div class="receipt-row receipt-total"><span>TOTAL</span><span>' + formatRp(tx.total) + '</span></div>';
    html += '<div class="receipt-row"><span>Bayar (' + escHtml(tx.payment_method) + ')</span><span>' + formatRp(tx.payment) + '</span></div>';
    if (Number(tx.change) > 0) html += '<div class="receipt-row"><span>Kembalian</span><span>' + formatRp(tx.change) + '</span></div>';
    if (tx.notes) { html += '<div class="receipt-divider"></div><p style="font-size:12px">Catatan: ' + escHtml(tx.notes) + '</p>'; }
    const st = tx.status || 'completed';
    if (st === 'void' || st === 'refund') {
      html += '<div class="receipt-divider"></div>';
      html += '<div style="background:' + (st === 'void' ? '#fee2e2' : '#fef3c7') + ';padding:10px;border-radius:8px;margin-top:8px">';
      html += '<p style="font-weight:700;color:' + (st === 'void' ? '#dc2626' : '#d97706') + ';margin:0 0 4px">' + (st === 'void' ? '🚫 VOID' : '↩️ REFUND') + '</p>';
      html += '<p style="font-size:12px;margin:0">Alasan: ' + escHtml(tx.void_reason || '-') + '</p>';
      html += '<p style="font-size:11px;margin:4px 0 0;color:#64748b">Oleh: ' + escHtml(tx.voided_by || '-') + ' — ' + (tx.voided_at ? formatDateTime(tx.voided_at) : '-') + '</p>';
      html += '</div>';
    }
    html += '</div></div>';
    html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Tutup</button></div>';
    openModal(html);
  } catch (err) { showToast(err.message, 'error'); }
}

