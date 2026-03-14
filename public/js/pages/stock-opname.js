// ============ STOK OPNAME ============
async function renderStockOpname() {
  const main = document.getElementById('mainContent');
  try {
    const opnames = await apiFetch('/api/stock-opname');

    let html = '<div class="page-header"><h1>📋 Stok Opname</h1><p>Koreksi stok fisik vs sistem</p></div>';
    html += '<div class="toolbar"><div class="spacer"></div><button class="btn btn-primary" onclick="createNewOpname()">+ Buat Opname Baru</button></div>';

    html += '<div class="card"><div class="overflow-x"><table><thead><tr><th>#</th><th>Tanggal</th><th>Oleh</th><th>Status</th><th>Items</th><th>Selisih</th><th>Aksi</th></tr></thead><tbody>';
    if (opnames.length === 0) {
      html += '<tr><td colspan="7">' + emptyHtml('📋', 'Belum ada opname') + '</td></tr>';
    } else {
      opnames.forEach(o => {
        const statusBadge = o.status === 'completed' ? '<span class="badge badge-green">Selesai</span>' : '<span class="badge badge-yellow">Draft</span>';
        html += '<tr>' +
          '<td>' + o.id + '</td>' +
          '<td>' + formatDateTime(o.created_at) + '</td>' +
          '<td>' + escHtml(o.user_name || '-') + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td>' + (o.total_items || 0) + '</td>' +
          '<td>' + (o.total_difference || 0) + '</td>' +
          '<td>' + (o.status === 'draft' ? '<button class="btn btn-sm btn-primary" onclick="openOpnameDetail(' + o.id + ')">📝 Isi</button> <button class="btn btn-sm btn-danger" onclick="deleteOpname(' + o.id + ')">🗑️</button>' : '<button class="btn btn-sm btn-primary" onclick="openOpnameDetail(' + o.id + ')">👁️ Lihat</button>') + '</td></tr>';
      });
    }
    html += '</tbody></table></div></div>';
    main.innerHTML = html;
  } catch (err) {
    main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat data: ' + escHtml(err.message) + '</div>';
  }
}

async function createNewOpname() {
  if (!confirm('Buat opname baru? Semua produk akan dimuat dengan stok sistem saat ini.')) return;
  try {
    const data = await apiFetch('/api/stock-opname', { method: 'POST', body: JSON.stringify({ notes: '' }) });
    showToast('Opname baru dibuat!');
    openOpnameDetail(data.opname.id);
  } catch (err) { showToast(err.message, 'error'); }
}

async function openOpnameDetail(id) {
  try {
    const data = await apiFetch('/api/stock-opname/' + id);
    const o = data.opname;
    const items = data.items || [];
    const isCompleted = o.status === 'completed';

    const main = document.getElementById('mainContent');
    let html = '<div class="page-header"><h1>📋 Opname #' + o.id + '</h1><p>' + (isCompleted ? 'Status: Selesai' : 'Isi stok fisik aktual') + '</p></div>';

    if (!isCompleted) {
      html += '<div class="toolbar"><button class="btn btn-secondary" onclick="renderStockOpname()">← Kembali</button><div class="spacer"></div><button class="btn btn-primary" onclick="saveOpnameItems(' + o.id + ')">💾 Simpan</button><button class="btn btn-success" style="background:#10b981;color:#fff;margin-left:8px" onclick="completeOpname(' + o.id + ')">✅ Selesaikan</button></div>';
    } else {
      html += '<div class="toolbar"><button class="btn btn-secondary" onclick="renderStockOpname()">← Kembali</button></div>';
    }

    html += '<div class="card"><div class="overflow-x"><table id="opnameTable"><thead><tr><th>Produk</th><th>Stok Sistem</th><th>Stok Fisik</th><th>Selisih</th><th>Catatan</th></tr></thead><tbody>';
    items.forEach((item, i) => {
      const diff = (item.actual_stock || 0) - (item.system_stock || 0);
      const diffColor = diff > 0 ? 'color:#10b981' : diff < 0 ? 'color:#ef4444' : 'color:#6b7280';
      const diffText = diff > 0 ? '+' + diff : diff.toString();
      if (isCompleted) {
        html += '<tr><td>' + escHtml(item.product_name) + '</td><td>' + item.system_stock + '</td><td>' + item.actual_stock + '</td><td style="font-weight:700;' + diffColor + '">' + diffText + '</td><td>' + escHtml(item.notes || '-') + '</td></tr>';
      } else {
        html += '<tr><td>' + escHtml(item.product_name) + '</td><td>' + item.system_stock + '</td>' +
          '<td><input type="number" min="0" value="' + item.actual_stock + '" data-item-id="' + item.id + '" data-system="' + item.system_stock + '" class="opname-input" oninput="updateOpnameDiff(this)" style="width:80px;padding:6px 8px;border:1px solid var(--border);border-radius:6px"></td>' +
          '<td class="opname-diff" style="font-weight:700;' + diffColor + '">' + diffText + '</td>' +
          '<td><input type="text" value="' + escHtml(item.notes || '') + '" data-notes-id="' + item.id + '" placeholder="Catatan" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px"></td></tr>';
      }
    });
    html += '</tbody></table></div></div>';
    main.innerHTML = html;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateOpnameDiff(input) {
  const system = Number(input.dataset.system) || 0;
  const actual = Number(input.value) || 0;
  const diff = actual - system;
  const td = input.closest('tr').querySelector('.opname-diff');
  td.textContent = diff > 0 ? '+' + diff : diff.toString();
  td.style.color = diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#6b7280';
}

async function saveOpnameItems(opnameId) {
  const inputs = document.querySelectorAll('.opname-input');
  const items = [];
  inputs.forEach(inp => {
    const itemId = Number(inp.dataset.itemId);
    const system = Number(inp.dataset.system) || 0;
    const actual = Number(inp.value) || 0;
    const notesInput = document.querySelector('[data-notes-id="' + itemId + '"]');
    items.push({ id: itemId, system_stock: system, actual_stock: actual, notes: notesInput ? notesInput.value : null });
  });
  try {
    await apiFetch('/api/stock-opname/' + opnameId + '/items', { method: 'PUT', body: JSON.stringify({ items }) });
    showToast('Data opname berhasil disimpan!');
  } catch (err) { showToast(err.message, 'error'); }
}

async function completeOpname(opnameId) {
  // Save first
  await saveOpnameItems(opnameId);
  if (!confirm('Selesaikan opname? Stok akan disesuaikan sesuai data fisik. Aksi ini tidak bisa dibatalkan.')) return;
  try {
    await apiFetch('/api/stock-opname/' + opnameId + '/complete', { method: 'POST' });
    showToast('Opname selesai! Stok telah disesuaikan.');
    renderStockOpname();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteOpname(id) {
  if (!confirm('Hapus opname ini?')) return;
  try {
    await apiFetch('/api/stock-opname/' + id, { method: 'DELETE' });
    showToast('Opname dihapus');
    renderStockOpname();
  } catch (err) { showToast(err.message, 'error'); }
}

