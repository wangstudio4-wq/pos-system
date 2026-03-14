// ============ EXPIRED DATE TRACKING ============
var expiredDays = 30;

async function renderExpiredTracking() {
  var main = document.getElementById('mainContent');
  var html = '<div class="page-header"><h1>\uD83D\uDCC5 Expired Tracking</h1><p>Pantau produk mendekati atau sudah kadaluarsa</p></div>';

  html += '<div class="toolbar"><div class="category-pills">';
  var dayOpts = [7, 14, 30, 60, 90];
  for (var di = 0; di < dayOpts.length; di++) {
    var dd = dayOpts[di];
    html += '<div class="category-pill' + (expiredDays === dd ? ' active' : '') + '" onclick="changeExpiredDays(' + dd + ')">' + dd + ' Hari</div>';
  }
  html += '</div></div>';

  try {
    var data = await apiFetch('/api/products/expiring?days=' + expiredDays);
    var products = data || [];

    var expired = products.filter(function(p) { return p.urgency === 'expired'; });
    var kritis  = products.filter(function(p) { return p.urgency === 'kritis'; });
    var segera  = products.filter(function(p) { return p.urgency === 'segera'; });
    var perhatian = products.filter(function(p) { return p.urgency === 'perhatian'; });

    html += '<div class="stat-grid">';
    html += '<div class="stat-card stat-red"><div class="stat-icon">\u2620\uFE0F</div><div class="stat-value">' + expired.length + '</div><div class="stat-label">Sudah Expired</div></div>';
    html += '<div class="stat-card stat-orange"><div class="stat-icon">\uD83D\uDD34</div><div class="stat-value">' + kritis.length + '</div><div class="stat-label">Kritis (\u22647 hari)</div></div>';
    html += '<div class="stat-card stat-yellow"><div class="stat-icon">\uD83D\uDFE1</div><div class="stat-value">' + segera.length + '</div><div class="stat-label">Segera (8-14 hari)</div></div>';
    html += '<div class="stat-card stat-blue"><div class="stat-icon">\uD83D\uDFE3</div><div class="stat-value">' + perhatian.length + '</div><div class="stat-label">Perhatian (15-' + expiredDays + ' hari)</div></div>';
    html += '</div>';

    if (products.length === 0) {
      html += '<div class="card mt-4" style="text-align:center;padding:40px">' + emptyHtml('\uD83C\uDF89', 'Tidak ada produk kadaluarsa dalam ' + expiredDays + ' hari ke depan') + '</div>';
    } else {
      // Expired
      if (expired.length > 0) {
        html += '<div class="card mt-4" style="border-left:4px solid #dc2626"><div class="card-header" style="background:rgba(220,38,38,0.08)"><h3>\u2620\uFE0F SUDAH EXPIRED (' + expired.length + ' produk)</h3></div>';
        html += renderExpiredTable(expired, true);
        html += '</div>';
      }
      // Kritis
      if (kritis.length > 0) {
        html += '<div class="card mt-4" style="border-left:4px solid #ef4444"><div class="card-header" style="background:rgba(239,68,68,0.08)"><h3>\uD83D\uDD34 KRITIS \u2014 Habis \u22647 Hari (' + kritis.length + ' produk)</h3></div>';
        html += renderExpiredTable(kritis, false);
        html += '</div>';
      }
      // Segera
      if (segera.length > 0) {
        html += '<div class="card mt-4" style="border-left:4px solid #f59e0b"><div class="card-header" style="background:rgba(245,158,11,0.08)"><h3>\uD83D\uDFE1 SEGERA \u2014 Habis 8-14 Hari (' + segera.length + ' produk)</h3></div>';
        html += renderExpiredTable(segera, false);
        html += '</div>';
      }
      // Perhatian
      if (perhatian.length > 0) {
        html += '<div class="card mt-4" style="border-left:4px solid #6366f1"><div class="card-header" style="background:rgba(99,102,241,0.08)"><h3>\uD83D\uDFE3 PERHATIAN \u2014 Habis 15-' + expiredDays + ' Hari (' + perhatian.length + ' produk)</h3></div>';
        html += renderExpiredTable(perhatian, false);
        html += '</div>';
      }
    }

    // Info: produk tanpa expire_date
    html += '<div class="card mt-4" style="padding:12px 16px;background:rgba(99,102,241,0.05);border:1px dashed var(--border)">';
    html += '<p style="margin:0;font-size:13px;color:var(--text-secondary)">\uD83D\uDCA1 <strong>Tips:</strong> Atur tanggal kadaluarsa produk di halaman <strong>Kelola Produk</strong> \u2192 Edit Produk \u2192 kolom <em>Tanggal Kadaluarsa</em>. Produk tanpa tanggal kadaluarsa tidak ditampilkan di sini.</p>';
    html += '</div>';

  } catch (err) {
    html += '<div class="alert-box alert-warning">Gagal memuat data: ' + escHtml(err.message) + '</div>';
  }

  main.innerHTML = html;
}

function renderExpiredTable(products, isExpired) {
  var h = '<div class="overflow-x"><table><thead><tr><th>Produk</th><th>Kategori</th><th>Stok</th>';
  h += isExpired ? '<th>Tgl Expired</th><th>Sudah Lewat</th>' : '<th>Tgl Kadaluarsa</th><th>Sisa Hari</th>';
  h += '<th>Aksi</th></tr></thead><tbody>';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var dateStr = p.expire_date ? p.expire_date.slice(0,10) : '-';
    var daysLabel = isExpired
      ? '<span style="color:#dc2626;font-weight:700">' + Math.abs(p.days_until_expire) + ' hari lalu</span>'
      : '<span style="color:' + (p.days_until_expire <= 7 ? '#ef4444' : p.days_until_expire <= 14 ? '#f59e0b' : '#6366f1') + ';font-weight:700">' + p.days_until_expire + ' hari</span>';
    h += '<tr>';
    h += '<td><strong>' + escHtml(p.name) + '</strong></td>';
    h += '<td>' + escHtml(p.category_name || 'Tanpa Kategori') + '</td>';
    h += '<td>' + (p.stock || 0) + ' ' + escHtml(p.unit || 'pcs') + '</td>';
    h += '<td>' + dateStr + '</td>';
    h += '<td>' + daysLabel + '</td>';
    h += '<td><button class="btn btn-sm btn-secondary" onclick="showProductById(' + p.id + ')">Edit</button></td>';
    h += '</tr>';
  }
  h += '</tbody></table></div>';
  return h;
}

function changeExpiredDays(d) {
  expiredDays = d;
  renderExpiredTracking();
}

async function showProductById(id) {
  try {
    const data = await apiFetch('/api/products');
    const product = data.find(function(p) { return p.id === id; });
    if (product) showProductModal(product);
  } catch(e) { showToast('Gagal memuat produk', 'error'); }
}

