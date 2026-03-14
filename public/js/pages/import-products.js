// ============ IMPORT PRODUK ============
async function renderImportProducts() {
  const main = document.getElementById('mainContent');
  let html = '<div class="page-header"><h1>📤 Import Produk</h1><p>Upload produk massal via file Excel/CSV</p></div>';

  html += '<div class="card">';
  html += '<div class="card-header"><h3>📋 Format File</h3></div>';
  html += '<p style="margin-bottom:12px;color:var(--text-secondary)">Siapkan file Excel (.xlsx) atau CSV dengan kolom berikut:</p>';
  html += '<div class="overflow-x"><table><thead><tr><th>Kolom</th><th>Wajib</th><th>Contoh</th></tr></thead><tbody>';
  html += '<tr><td><code>name</code></td><td><span class="badge badge-red">Wajib</span></td><td>Indomie Goreng</td></tr>';
  html += '<tr><td><code>barcode</code></td><td><span class="badge badge-gray">Opsional</span></td><td>8991234567890</td></tr>';
  html += '<tr><td><code>price</code></td><td><span class="badge badge-gray">Opsional</span></td><td>3500</td></tr>';
  html += '<tr><td><code>cost_price</code></td><td><span class="badge badge-gray">Opsional</span></td><td>3000</td></tr>';
  html += '<tr><td><code>stock</code></td><td><span class="badge badge-gray">Opsional</span></td><td>100</td></tr>';
  html += '<tr><td><code>min_stock</code></td><td><span class="badge badge-gray">Opsional</span></td><td>10</td></tr>';
  html += '<tr><td><code>category_name</code></td><td><span class="badge badge-gray">Opsional</span></td><td>Makanan</td></tr>';
  html += '</tbody></table></div>';
  html += '</div>';

  html += '<div class="card" style="margin-top:16px">';
  html += '<div class="card-header"><h3>📤 Upload File</h3></div>';
  html += '<input type="file" id="importFile" accept=".xlsx,.xls,.csv" onchange="previewImportFile(this)" style="margin-bottom:12px">';
  html += '<div id="importPreview"></div>';
  html += '<div id="importActions" style="display:none;margin-top:12px"><button class="btn btn-primary" onclick="executeImport()">🚀 Import Sekarang</button></div>';
  html += '</div>';

  html += '<div id="importResult"></div>';
  main.innerHTML = html;
}

let importData = [];

function previewImportFile(input) {
  const file = input.files[0];
  if (!file) return;

  const preview = document.getElementById('importPreview');
  const actions = document.getElementById('importActions');
  preview.innerHTML = '<div style="padding:16px;text-align:center">⏳ Membaca file...</div>';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = e.target.result;
      let rows = [];

      if (file.name.endsWith('.csv')) {
        // Parse CSV
        const lines = data.split('\n').filter(l => l.trim());
        if (lines.length < 2) { preview.innerHTML = '<div class="alert-box alert-warning">File kosong atau hanya header.</div>'; return; }
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const obj = {};
          headers.forEach((h, j) => { obj[h] = vals[j] || ''; });
          rows.push(obj);
        }
      } else {
        // For XLSX, we parse the ArrayBuffer manually using a simple approach
        // Since we can't use external libs in browser, we'll tell user to use CSV
        preview.innerHTML = '<div class="alert-box alert-warning">Untuk saat ini, gunakan format <strong>CSV (.csv)</strong>. Buka file Excel → Save As → CSV.</div>';
        return;
      }

      importData = rows.map(r => ({
        name: r.name || r.nama || '',
        barcode: r.barcode || r.kode || '',
        price: Number(r.price || r.harga_jual || r.harga || 0),
        cost_price: Number(r.cost_price || r.harga_modal || r.modal || 0),
        stock: Number(r.stock || r.stok || 0),
        min_stock: Number(r.min_stock || r.stok_minimum || 5),
        category_name: r.category_name || r.kategori || ''
      })).filter(r => r.name);

      if (importData.length === 0) {
        preview.innerHTML = '<div class="alert-box alert-warning">Tidak ada data valid ditemukan.</div>';
        actions.style.display = 'none';
        return;
      }

      let html = '<p style="margin-bottom:8px"><strong>' + importData.length + ' produk</strong> siap diimport:</p>';
      html += '<div class="overflow-x"><table><thead><tr><th>Nama</th><th>Barcode</th><th>Harga</th><th>Modal</th><th>Stok</th><th>Kategori</th></tr></thead><tbody>';
      importData.slice(0, 20).forEach(r => {
        html += '<tr><td>' + escHtml(r.name) + '</td><td>' + escHtml(r.barcode || '-') + '</td><td>' + formatRp(r.price) + '</td><td>' + formatRp(r.cost_price) + '</td><td>' + r.stock + '</td><td>' + escHtml(r.category_name || '-') + '</td></tr>';
      });
      if (importData.length > 20) html += '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">... dan ' + (importData.length - 20) + ' produk lainnya</td></tr>';
      html += '</tbody></table></div>';

      preview.innerHTML = html;
      actions.style.display = 'block';
    } catch (err) {
      preview.innerHTML = '<div class="alert-box alert-warning">Gagal membaca file: ' + escHtml(err.message) + '</div>';
    }
  };

  if (file.name.endsWith('.csv')) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
}

async function executeImport() {
  if (importData.length === 0) { showToast('Tidak ada data untuk diimport', 'error'); return; }
  const resultDiv = document.getElementById('importResult');
  resultDiv.innerHTML = '<div class="alert-box alert-info">⏳ Mengimport ' + importData.length + ' produk...</div>';

  try {
    const result = await apiFetch('/api/products/import', {
      method: 'POST',
      body: JSON.stringify({ products: importData })
    });
    let html = '<div class="card" style="margin-top:16px">';
    html += '<div class="card-header"><h3>✅ Hasil Import</h3></div>';
    html += '<div class="alert-box alert-info mb-2">' + escHtml(result.message) + '</div>';
    if (result.errors && result.errors.length > 0) {
      html += '<div style="max-height:200px;overflow-y:auto;padding:8px;background:#fef3c7;border-radius:8px;font-size:12px">';
      result.errors.forEach(e => { html += '<div>⚠️ ' + escHtml(e) + '</div>'; });
      html += '</div>';
    }
    html += '</div>';
    resultDiv.innerHTML = html;
    showToast('Import selesai: ' + (result.imported || 0) + ' berhasil!');
    importData = [];
    document.getElementById('importActions').style.display = 'none';
  } catch (err) {
    resultDiv.innerHTML = '<div class="alert-box alert-warning">Gagal import: ' + escHtml(err.message) + '</div>';
  }
}

