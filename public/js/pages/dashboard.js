// ============ DASHBOARD ============
async function renderDashboard() {
  const main = document.getElementById('mainContent');
  try {
    const data = await apiFetch('/api/dashboard');
    const t = data.today || {};
    const stock = data.stock || {};
    const profit = (Number(t.revenue)||0) - (Number(t.expenses)||0);

    let html = '<div class="page-header"><h1>📊 Dashboard</h1><p>Ringkasan bisnis hari ini</p></div>';

    // Stat cards
    html += '<div class="stat-grid">';
    html += '<div class="stat-card stat-green"><div class="stat-icon">💰</div><div class="stat-value">' + formatRp(t.revenue) + '</div><div class="stat-label">Pendapatan Hari Ini</div></div>';
    html += '<div class="stat-card stat-blue"><div class="stat-icon">🧾</div><div class="stat-value">' + (t.transactions||0) + '</div><div class="stat-label">Transaksi Hari Ini</div></div>';
    html += '<div class="stat-card stat-red"><div class="stat-icon">💸</div><div class="stat-value">' + formatRp(t.expenses) + '</div><div class="stat-label">Pengeluaran Hari Ini</div></div>';
    html += '<div class="stat-card stat-purple"><div class="stat-icon">📈</div><div class="stat-value">' + formatRp(profit) + '</div><div class="stat-label">Laba Bersih Hari Ini</div></div>';
    html += '</div>';

    // Current shift info
    if (data.current_shift) {
      const sh = data.current_shift;
      html += '<div class="alert-box alert-info mb-4">⏰ Shift aktif oleh <strong>' + escHtml(sh.user_name || sh.username || '-') + '</strong> sejak ' + formatTime(sh.opened_at) + ' | Kas awal: ' + formatRp(sh.opening_cash) + '</div>';
    }

    // Sales chart
    const chart = data.sales_chart || [];
    if (chart.length > 0) {
      const maxRev = Math.max(...chart.map(c => Number(c.revenue)||0), 1);
      html += '<div class="card mb-4"><div class="card-header"><h3>📊 Grafik Penjualan 7 Hari Terakhir</h3></div>';
      html += '<div class="bar-chart">';
      chart.forEach(c => {
        const pct = Math.round(((Number(c.revenue)||0) / maxRev) * 100);
        const day = c.date ? new Date(c.date).toLocaleDateString('id-ID',{weekday:'short'}) : '-';
        html += '<div class="bar-col"><div class="bar-value">' + formatRp(c.revenue) + '</div><div class="bar" style="height:' + Math.max(pct,3) + '%"></div><div class="bar-label">' + escHtml(day) + '</div></div>';
      });
      html += '</div></div>';
    }

    // 2-column grid
    html += '<div class="dash-grid">';

    // Recent transactions
    html += '<div class="card"><div class="card-header"><h3>🧾 Transaksi Terakhir</h3></div>';
    const recent = data.recent_transactions || [];
    if (recent.length) {
      html += '<div class="overflow-x"><table><thead><tr><th>Waktu</th><th>Total</th><th>Metode</th></tr></thead><tbody>';
      recent.forEach(tx => {
        html += '<tr><td>' + formatDateTime(tx.created_at || tx.date) + '</td><td><strong>' + formatRp(tx.total) + '</strong></td><td>' + payMethodBadge(tx.payment_method) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += emptyHtml('🧾', 'Belum ada transaksi hari ini');
    }
    html += '</div>';

    // Top products
    html += '<div class="card"><div class="card-header"><h3>🏆 Produk Terlaris Hari Ini</h3></div>';
    const tops = data.top_products_today || data.top_products || [];
    if (tops.length) {
      html += '<div class="overflow-x"><table><thead><tr><th>Produk</th><th class="text-right">Terjual</th></tr></thead><tbody>';
      tops.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
        html += '<tr><td>' + medal + ' ' + escHtml(p.name || p.product_name) + '</td><td class="text-right"><strong>' + (p.total_qty || p.qty || 0) + '</strong></td></tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += emptyHtml('🏆', 'Belum ada data');
    }
    html += '</div>';
    html += '</div>'; // end dash-grid

    // Low stock alerts
    const lowStockProducts = (data.low_stock_products || []);
    const outStock = stock.out || 0;
    const lowStock = stock.low || 0;
    if (lowStock > 0 || outStock > 0 || lowStockProducts.length > 0) {
      html += '<div class="card"><div class="card-header"><h3>⚠️ Peringatan Stok</h3></div>';
      html += '<div class="alert-box alert-warning mb-2">Stok habis: <strong>' + outStock + '</strong> produk | Stok menipis: <strong>' + lowStock + '</strong> produk</div>';
      if (lowStockProducts.length > 0) {
        html += '<div class="overflow-x"><table><thead><tr><th>Produk</th><th>Stok</th><th>Min</th></tr></thead><tbody>';
        lowStockProducts.forEach(p => {
          html += '<tr><td>' + escHtml(p.name) + '</td><td><span class="low-stock-tag">' + p.stock + '</span></td><td>' + (p.min_stock||0) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div>';
    }

    main.innerHTML = html;
  } catch (err) {
    main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat dashboard: ' + escHtml(err.message) + '</div>';
  }
}

