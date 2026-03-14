// ============ KARTU STOK ============
async function renderStockCard() {
  const main = document.getElementById('mainContent');
  try {
    const prodData = await apiFetch('/api/products');
    const products = Array.isArray(prodData) ? prodData : (prodData.products || []);

    let html = '<div class="page-header"><h1>📊 Kartu Stok</h1><p>Histori pergerakan stok per produk</p></div>';
    html += '<div class="toolbar">';
    html += '<select id="stockCardProduct" onchange="loadStockCard()" style="min-width:200px"><option value="">-- Pilih Produk --</option>';
    products.forEach(p => { html += '<option value="' + p.id + '">' + escHtml(p.name) + ' (stok: ' + p.stock + ')</option>'; });
    html += '</select>';
    html += '<input type="date" id="stockCardStart" onchange="loadStockCard()" style="margin-left:8px">';
    html += '<input type="date" id="stockCardEnd" onchange="loadStockCard()" style="margin-left:4px">';
    html += '</div>';
    html += '<div id="stockCardContent">' + emptyHtml('📊', 'Pilih produk untuk melihat kartu stok') + '</div>';
    main.innerHTML = html;
  } catch (err) {
    main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat data: ' + escHtml(err.message) + '</div>';
  }
}

async function loadStockCard() {
  const productId = document.getElementById('stockCardProduct').value;
  const container = document.getElementById('stockCardContent');
  if (!productId) {
    container.innerHTML = emptyHtml('📊', 'Pilih produk untuk melihat kartu stok');
    return;
  }
  try {
    let url = '/api/stock-movements?product_id=' + productId;
    const startDate = document.getElementById('stockCardStart').value;
    const endDate = document.getElementById('stockCardEnd').value;
    if (startDate && endDate) url += '&start_date=' + startDate + '&end_date=' + endDate;

    const movements = await apiFetch(url);

    if (movements.length === 0) {
      container.innerHTML = '<div class="card">' + emptyHtml('📊', 'Belum ada pergerakan stok') + '</div>';
      return;
    }

    const typeLabels = { purchase: '📥 Pembelian', sale: '📤 Penjualan', void: '↩️ Void', refund: '↩️ Refund', opname: '📋 Opname', adjustment: '🔧 Penyesuaian', manual: '✏️ Manual' };
    const typeBadges = { purchase: 'badge-green', sale: 'badge-red', void: 'badge-yellow', refund: 'badge-orange', opname: 'badge-blue', adjustment: 'badge-purple', manual: 'badge-gray' };

    let html = '<div class="card"><div class="overflow-x"><table><thead><tr><th>Tanggal</th><th>Tipe</th><th>Qty</th><th>Sebelum</th><th>Sesudah</th><th>Catatan</th><th>Oleh</th></tr></thead><tbody>';
    movements.forEach(m => {
      const qtyColor = m.qty > 0 ? 'color:#10b981' : m.qty < 0 ? 'color:#ef4444' : '';
      const qtyText = m.qty > 0 ? '+' + m.qty : m.qty.toString();
      html += '<tr>' +
        '<td style="white-space:nowrap">' + formatDateTime(m.created_at) + '</td>' +
        '<td><span class="badge ' + (typeBadges[m.type] || 'badge-gray') + '">' + (typeLabels[m.type] || m.type) + '</span></td>' +
        '<td style="font-weight:700;' + qtyColor + '">' + qtyText + '</td>' +
        '<td>' + m.before_stock + '</td>' +
        '<td><strong>' + m.after_stock + '</strong></td>' +
        '<td>' + escHtml(m.notes || '-') + '</td>' +
        '<td>' + escHtml(m.user_name || '-') + '</td></tr>';
    });
    html += '</tbody></table></div></div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div class="alert-box alert-warning">Gagal memuat kartu stok: ' + escHtml(err.message) + '</div>';
  }
}


