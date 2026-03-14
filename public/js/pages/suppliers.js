// ============ SUPPLIERS ============
async function renderSuppliers() {
  const main = document.getElementById('mainContent');
  try {
    const suppliers = await apiFetch('/api/suppliers');

    let html = '<div class="page-header"><h1>🏭 Supplier</h1><p>Kelola data supplier</p></div>';
    html += '<div class="toolbar"><input class="search-input" placeholder="🔍 Cari supplier..." oninput="filterSupplierTable(this.value)"><div class="spacer"></div><button class="btn btn-primary" onclick="showSupplierModal()">+ Tambah Supplier</button></div>';

    html += '<div class="card"><div class="overflow-x"><table id="supplierTable"><thead><tr><th>Nama</th><th>Telepon</th><th>Email</th><th>Alamat</th><th>Aksi</th></tr></thead><tbody>';
    if (suppliers.length === 0) {
      html += '<tr><td colspan="5">' + emptyHtml('🏭', 'Belum ada supplier') + '</td></tr>';
    } else {
      suppliers.forEach(s => {
        html += '<tr data-search="' + escHtml((s.name||'').toLowerCase()) + '">' +
          '<td><strong>' + escHtml(s.name) + '</strong></td>' +
          '<td>' + escHtml(s.phone || '-') + '</td>' +
          '<td>' + escHtml(s.email || '-') + '</td>' +
          '<td>' + escHtml(s.address || '-') + '</td>' +
          '<td><button class="btn btn-sm btn-primary" onclick=\'showSupplierModal(' + JSON.stringify(s).replace(/'/g, "\\'") + ')\'>✏️</button> ' +
          '<button class="btn btn-sm btn-danger" onclick="deleteSupplier(' + s.id + ')">🗑️</button></td></tr>';
      });
    }
    html += '</tbody></table></div></div>';
    main.innerHTML = html;
  } catch (err) {
    main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat supplier: ' + escHtml(err.message) + '</div>';
  }
}

function filterSupplierTable(val) {
  const rows = document.querySelectorAll('#supplierTable tbody tr');
  const s = val.toLowerCase();
  rows.forEach(r => { r.style.display = (r.dataset.search || '').includes(s) ? '' : 'none'; });
}

function showSupplierModal(supplier) {
  const isEdit = !!supplier;
  let html = '<div class="modal-header"><h3>' + (isEdit ? '✏️ Edit Supplier' : '➕ Tambah Supplier') + '</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body"><form id="supplierForm">';
  html += '<div class="form-group"><label>Nama Supplier *</label><input id="sName" value="' + escHtml(supplier?.name || '') + '" required></div>';
  html += '<div class="form-group"><label>Telepon</label><input id="sPhone" value="' + escHtml(supplier?.phone || '') + '"></div>';
  html += '<div class="form-group"><label>Email</label><input id="sEmail" type="email" value="' + escHtml(supplier?.email || '') + '"></div>';
  html += '<div class="form-group"><label>Alamat</label><textarea id="sAddress" rows="2">' + escHtml(supplier?.address || '') + '</textarea></div>';
  html += '<div class="form-group"><label>Catatan</label><textarea id="sNotes" rows="2">' + escHtml(supplier?.notes || '') + '</textarea></div>';
  html += '</form></div>';
  html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveSupplier(' + (isEdit ? supplier.id : 'null') + ')">Simpan</button></div>';
  openModal(html);
}

async function saveSupplier(id) {
  const payload = {
    name: document.getElementById('sName').value,
    phone: document.getElementById('sPhone').value || null,
    email: document.getElementById('sEmail').value || null,
    address: document.getElementById('sAddress').value || null,
    notes: document.getElementById('sNotes').value || null
  };
  if (!payload.name) { showToast('Nama supplier wajib diisi', 'error'); return; }
  try {
    if (id) {
      await apiFetch('/api/suppliers/' + id, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Supplier berhasil diperbarui');
    } else {
      await apiFetch('/api/suppliers', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Supplier berhasil ditambahkan');
    }
    closeModal();
    renderSuppliers();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteSupplier(id) {
  if (!confirm('Hapus supplier ini?')) return;
  try {
    await apiFetch('/api/suppliers/' + id, { method: 'DELETE' });
    showToast('Supplier dihapus');
    renderSuppliers();
  } catch (err) { showToast(err.message, 'error'); }
}

