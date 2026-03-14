// ============ AUTO RESTOCK ALERT ============
var restockDays = 30;

async function renderRestockAlert() {
  var main = document.getElementById('mainContent');
  var html = '<div class="page-header"><h1>\uD83D\uDD14 Restock Alert</h1><p>Rekomendasi restock berdasarkan kecepatan penjualan</p></div>';

  html += '<div class="toolbar" style="justify-content:space-between;flex-wrap:wrap;gap:8px">';
  html += '<div class="category-pills">';
  var dayOpts2 = [7, 14, 30, 60, 90];
  for (var ri = 0; ri < dayOpts2.length; ri++) {
    var rd = dayOpts2[ri];
    html += '<div class="category-pill' + (restockDays === rd ? ' active' : '') + '" onclick="changeRestockDays(' + rd + ')">Analisis ' + rd + ' Hari</div>';
  }
  html += '</div>';
  html += '<div style="font-size:12px;color:var(--text-secondary);padding:4px 0">\uD83D\uDCA1 Berdasarkan rata-rata penjualan ' + restockDays + ' hari terakhir</div>';
  html += '</div>';

  try {
    var data = await apiFetch('/api/reports/restock-alert?days=' + restockDays);
    var prods = data.products || [];

    html += '<div class="stat-grid">';
    html += '<div class="stat-card stat-red"><div class="stat-icon">\uD83D\uDEAB</div><div class="stat-value">' + (data.habis || 0) + '</div><div class="stat-label">Stok Habis</div></div>';
    html += '<div class="stat-card stat-orange"><div class="stat-icon">\uD83D\uDD34</div><div class="stat-value">' + (data.kritis || 0) + '</div><div class="stat-label">Kritis (\u22643 hari)</div></div>';
    html += '<div class="stat-card stat-yellow"><div class="stat-icon">\uD83D\uDFE1</div><div class="stat-value">' + (data.segera || 0) + '</div><div class="stat-label">Segera (4-7 hari)</div></div>';
    html += '<div class="stat-card stat-blue"><div class="stat-icon">\uD83D\uDFE3</div><div class="stat-value">' + (data.perhatian || 0) + '</div><div class="stat-label">Perhatian (8-14 hari)</div></div>';
    html += '</div>';

    if (prods.length === 0) {
      html += '<div class="card mt-4" style="text-align:center;padding:40px">' + emptyHtml('\uD83C\uDF89', 'Semua stok aman! Tidak ada restock mendesak saat ini.') + '</div>';
    } else {
      var habisProds     = prods.filter(function(p) { return p.urgency === 'habis'; });
      var kritisProds    = prods.filter(function(p) { return p.urgency === 'kritis'; });
      var segeraProds    = prods.filter(function(p) { return p.urgency === 'segera'; });
      var perhatianProds = prods.filter(function(p) { return p.urgency === 'perhatian'; });

      if (habisProds.length > 0) {
        html += '<div class="card mt-4" style="border-left:4px solid #dc2626"><div class="card-header" style="background:rgba(220,38,38,0.08)"><h3>\uD83D\uDEAB STOK HABIS (' + habisProds.length + ' produk) \u2014 Restock Segera!</h3></div>';
        html += renderRestockTable(habisProds, true);
        html += '</div>';
      }
      if (kritisProds.length > 0) {
        html += '<div class="card mt-4" style="border-left:4px solid #ef4444"><div class="card-header" style="background:rgba(239,68,68,0.08)"><h3>\uD83D\uDD34 KRITIS \u2014 Habis dalam \u22643 Hari (' + kritisProds.length + ' produk)</h3></div>';
        html += renderRestockTable(kritisProds, false);
        html += '</div>';
      }
      if (segeraProds.length > 0) {
        html += '<div class="card mt-4" style="border-left:4px solid #f59e0b"><div class="card-header" style="background:rgba(245,158,11,0.08)"><h3>\uD83D\uDFE1 SEGERA \u2014 Habis dalam 4-7 Hari (' + segeraProds.length + ' produk)</h3></div>';
        html += renderRestockTable(segeraProds, false);
        html += '</div>';
      }
      if (perhatianProds.length > 0) {
        html += '<div class="card mt-4" style="border-left:4px solid #6366f1"><div class="card-header" style="background:rgba(99,102,241,0.08)"><h3>\uD83D\uDFE3 PERHATIAN \u2014 Habis dalam 8-14 Hari (' + perhatianProds.length + ' produk)</h3></div>';
        html += renderRestockTable(perhatianProds, false);
        html += '</div>';
      }
    }

    html += '<div class="card mt-4" style="padding:12px 16px;background:rgba(99,102,241,0.05);border:1px dashed var(--border)">';
    html += '<p style="margin:0;font-size:13px;color:var(--text-secondary)">\uD83D\uDCA1 <strong>Cara kerja:</strong> Sistem menghitung rata-rata penjualan per hari dalam <strong>' + restockDays + ' hari terakhir</strong>, lalu memperkirakan kapan stok akan habis. Produk yang belum pernah terjual tidak ditampilkan.</p>';
    html += '</div>';

  } catch (err) {
    html += '<div class="alert-box alert-warning">Gagal memuat data: ' + escHtml(err.message) + '</div>';
  }

  main.innerHTML = html;
}

function renderRestockTable(products, isHabis) {
  var h = '<div class="overflow-x"><table><thead><tr><th>Produk</th><th>Kategori</th><th>Stok Saat Ini</th><th>Terjual (' + restockDays + ' hr)</th><th>Rata2/Hari</th>';
  h += isHabis ? '<th>Status</th>' : '<th>Habis dalam</th>';
  h += '<th>Aksi</th></tr></thead><tbody>';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var stockColor = p.urgency === 'habis' ? '#dc2626' : p.urgency === 'kritis' ? '#ef4444' : p.urgency === 'segera' ? '#f59e0b' : '#6366f1';
    var daysLabel = isHabis
      ? '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">HABIS</span>'
      : '<span style="color:' + stockColor + ';font-weight:700">' + (p.days_until_stockout >= 9999 ? '\u221E' : p.days_until_stockout + ' hari') + '</span>';
    h += '<tr>';
    h += '<td><strong>' + escHtml(p.name) + '</strong></td>';
    h += '<td>' + escHtml(p.category_name || '-') + '</td>';
    h += '<td><span style="color:' + stockColor + ';font-weight:700">' + (p.stock || 0) + ' ' + escHtml(p.unit || 'pcs') + '</span></td>';
    h += '<td>' + (p.total_sold || 0) + ' ' + escHtml(p.unit || 'pcs') + '</td>';
    h += '<td>' + (p.avg_daily_sales || 0) + '/hari</td>';
    h += '<td>' + daysLabel + '</td>';
    h += '<td><button class="btn btn-sm btn-primary" onclick="showPage(\'stockin\')" style="font-size:11px">\uD83D\uDCE5 Beli Stok</button></td>';
    h += '</tr>';
  }
  h += '</tbody></table></div>';
  return h;
}

function changeRestockDays(d) {
  restockDays = d;
  renderRestockAlert();
}

