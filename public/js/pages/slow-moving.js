// ============ PRODUK SLOW MOVING ============
var slowMovingDays = 30;

async function renderSlowMoving() {
  var main = document.getElementById('mainContent');
  var html = '<div class="page-header"><h1>\uD83D\uDC0C Produk Slow Moving</h1><p>Analisis produk yang jarang laku untuk optimasi stok</p></div>';

  html += '<div class="toolbar"><div class="category-pills">';
  var dayOpts = [7, 14, 30, 60, 90];
  for (var di = 0; di < dayOpts.length; di++) {
    var dd = dayOpts[di];
    html += '<div class="category-pill' + (slowMovingDays === dd ? ' active' : '') + '" onclick="changeSlowDays(' + dd + ')">' + dd + ' Hari</div>';
  }
  html += '</div></div>';

  try {
    var data = await apiFetch('/api/reports/slow-moving?days=' + slowMovingDays);
    var s = data.summary || {};
    var products = data.products || [];

    html += '<div class="stat-grid">';
    html += '<div class="stat-card stat-red"><div class="stat-icon">\uD83D\uDEAB</div><div class="stat-value">' + (s.zero_sales || 0) + '</div><div class="stat-label">Tidak Terjual</div></div>';
    html += '<div class="stat-card stat-orange"><div class="stat-icon">\uD83D\uDC0C</div><div class="stat-value">' + (s.slow_products || 0) + '</div><div class="stat-label">Slow Moving (1-5 pcs)</div></div>';
    html += '<div class="stat-card stat-blue"><div class="stat-icon">\uD83D\uDCE6</div><div class="stat-value">' + (s.total_products || 0) + '</div><div class="stat-label">Total Produk</div></div>';
    html += '<div class="stat-card stat-purple"><div class="stat-icon">\uD83D\uDCB0</div><div class="stat-value">' + formatRp(s.total_capital_tied || 0) + '</div><div class="stat-label">Modal Tertahan</div></div>';
    html += '</div>';

    var zeroProducts = products.filter(function(p) { return Number(p.total_sold) === 0; });
    if (zeroProducts.length > 0) {
      html += '<div class="card mt-4" style="border-left:4px solid #ef4444"><div class="card-header"><h3>\uD83D\uDEAB Tidak Terjual Sama Sekali (' + zeroProducts.length + ' produk)</h3></div>';
      html += '<div class="overflow-x"><table><thead><tr><th>Produk</th><th>Kategori</th><th>Stok</th><th>Harga Jual</th><th>Modal/pcs</th><th>Modal Tertahan</th></tr></thead><tbody>';
      for (var zi = 0; zi < zeroProducts.length; zi++) {
        var zp = zeroProducts[zi];
        html += '<tr><td><strong>' + escHtml(zp.name) + '</strong></td><td>' + escHtml(zp.category_name) + '</td><td>' + (zp.stock||0) + ' ' + escHtml(zp.unit||'pcs') + '</td><td>' + formatRp(zp.price) + '</td><td>' + formatRp(zp.cost_price) + '</td><td style="color:#ef4444;font-weight:700">' + formatRp(zp.capital_tied) + '</td></tr>';
      }
      html += '</tbody></table></div></div>';
    }

    var slowProds = products.filter(function(p) { return Number(p.total_sold) > 0 && Number(p.total_sold) <= 5; });
    if (slowProds.length > 0) {
      html += '<div class="card mt-4" style="border-left:4px solid #f59e0b"><div class="card-header"><h3>\uD83D\uDC0C Slow Moving (' + slowProds.length + ' produk)</h3></div>';
      html += '<div class="overflow-x"><table><thead><tr><th>Produk</th><th>Kategori</th><th>Terjual</th><th>Rata2/Hari</th><th>Stok</th><th>Perkiraan Habis</th><th>Modal Tertahan</th></tr></thead><tbody>';
      for (var si = 0; si < slowProds.length; si++) {
        var sp = slowProds[si];
        var daysLabel = sp.days_of_stock >= 999 ? '\u221E' : sp.days_of_stock + ' hari';
        html += '<tr><td><strong>' + escHtml(sp.name) + '</strong></td><td>' + escHtml(sp.category_name) + '</td><td>' + sp.total_sold + ' ' + escHtml(sp.unit||'pcs') + '</td><td>' + sp.avg_daily_sales + '</td><td>' + (sp.stock||0) + '</td><td>' + daysLabel + '</td><td style="color:#f59e0b;font-weight:700">' + formatRp(sp.capital_tied) + '</td></tr>';
      }
      html += '</tbody></table></div></div>';
    }

    html += '<div class="card mt-4"><div class="card-header"><h3>\uD83D\uDCCA Semua Produk \u2014 Ranking Penjualan ' + data.days + ' Hari</h3></div>';
    html += '<div class="overflow-x"><table><thead><tr><th>#</th><th>Produk</th><th>Kategori</th><th>Terjual</th><th>Revenue</th><th>Stok</th><th>Modal Tertahan</th><th>Status</th></tr></thead><tbody>';
    for (var ai = 0; ai < products.length; ai++) {
      var ap = products[ai];
      var sold = Number(ap.total_sold) || 0;
      var statusBadge = sold === 0 ? '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">Mati</span>'
        : sold <= 5 ? '<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">Lambat</span>'
        : sold <= 20 ? '<span style="background:#dbeafe;color:#2563eb;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">Normal</span>'
        : '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">Laris</span>';
      html += '<tr><td>' + (ai+1) + '</td><td><strong>' + escHtml(ap.name) + '</strong></td><td>' + escHtml(ap.category_name) + '</td><td>' + sold + '</td><td>' + formatRp(ap.total_revenue) + '</td><td>' + (ap.stock||0) + '</td><td>' + formatRp(ap.capital_tied) + '</td><td>' + statusBadge + '</td></tr>';
    }
    html += '</tbody></table></div></div>';

  } catch (err) {
    html += '<div class="alert-box alert-warning">Gagal memuat data: ' + escHtml(err.message) + '</div>';
  }

  main.innerHTML = html;
}

function changeSlowDays(d) {
  slowMovingDays = d;
  renderSlowMoving();
}

