// ============ CATEGORIES ============
async function renderCategories() {
  const main = document.getElementById('mainContent');
  try {
    const data = await apiFetch('/api/categories');
    const categories = data.categories || data || [];
    let html = '<div class="page-header"><h1>🏷️ Kategori</h1><p>Manajemen kategori produk</p></div>';
    html += '<div class="toolbar"><div class="spacer"></div><button class="btn btn-primary" onclick="showCategoryModal()">+ Tambah Kategori</button></div>';

    html += '<div class="card"><div class="overflow-x"><table><thead><tr><th>Warna</th><th>Nama</th><th>Aksi</th></tr></thead><tbody>';
    if (categories.length === 0) {
      html += '<tr><td colspan="3">' + emptyHtml('🏷️', 'Belum ada kategori') + '</td></tr>';
    } else {
      categories.forEach(c => {
        html += '<tr><td><span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:' + escHtml(c.color || '#6b7280') + '"></span></td>' +
          '<td><strong>' + escHtml(c.name) + '</strong></td>' +
          '<td><button class="btn btn-sm btn-primary" onclick=\'showCategoryModal(' + JSON.stringify(c).replace(/'/g, "\\'") + ')\'>✏️</button> ' +
          '<button class="btn btn-sm btn-danger" onclick="deleteCategory(' + c.id + ')">🗑️</button></td></tr>';
      });
    }
    html += '</tbody></table></div></div>';
    main.innerHTML = html;
  } catch (err) {
    main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat: ' + escHtml(err.message) + '</div>';
  }
}

const COLORS = ['#415D43','#709775','#8FB996','#A1CCA5','#111D13','#5a8a5e','#3d7a42','#2d5e30','#6bb870','#4a9e50'];

function showCategoryModal(cat) {
  const isEdit = !!cat;
  let html = '<div class="modal-header"><h3>' + (isEdit ? '✏️ Edit Kategori' : '➕ Tambah Kategori') + '</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body">';
  html += '<div class="form-group"><label>Nama Kategori</label><input id="catName" value="' + escHtml(cat?.name || '') + '" required></div>';
  html += '<div class="form-group"><label>Warna</label><div class="color-options" id="colorOptions">';
  COLORS.forEach(clr => {
    html += '<div class="color-opt' + ((cat?.color||COLORS[0]) === clr ? ' selected' : '') + '" style="background:' + clr + '" onclick="selectColor(this,\'' + clr + '\')"></div>';
  });
  html += '</div><input type="hidden" id="catColor" value="' + escHtml(cat?.color || COLORS[0]) + '"></div>';
  html += '</div>';
  html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveCategory(' + (isEdit ? cat.id : 'null') + ')">Simpan</button></div>';
  openModal(html);
}

function selectColor(el, color) {
  document.querySelectorAll('#colorOptions .color-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('catColor').value = color;
}

async function saveCategory(id) {
  const payload = { name: document.getElementById('catName').value, color: document.getElementById('catColor').value };
  if (!payload.name) { showToast('Nama kategori wajib', 'error'); return; }
  try {
    if (id) {
      await apiFetch('/api/categories/' + id, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Kategori diperbarui');
    } else {
      await apiFetch('/api/categories', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Kategori ditambahkan');
    }
    closeModal(); renderCategories();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteCategory(id) {
  if (!confirm('Hapus kategori ini?')) return;
  try {
    await apiFetch('/api/categories/' + id, { method: 'DELETE' });
    showToast('Kategori dihapus'); renderCategories();
  } catch (err) { showToast(err.message, 'error'); }
}



