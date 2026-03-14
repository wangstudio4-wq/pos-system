// ============ USERS ============
async function renderUsers() {
  const main = document.getElementById('mainContent');
  try {
    const data = await apiFetch('/api/users');
    const users = data.users || data || [];
    let html = '<div class="page-header"><h1>👤 Kelola User</h1><p>Manajemen pengguna sistem</p></div>';
    html += '<div class="toolbar"><div class="spacer"></div><button class="btn btn-primary" onclick="showUserModal()">+ Tambah User</button></div>';

    html += '<div class="card"><div class="overflow-x"><table><thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>PIN</th><th>Aksi</th></tr></thead><tbody>';
    if (users.length === 0) {
      html += '<tr><td colspan="5">' + emptyHtml('👤', 'Belum ada user') + '</td></tr>';
    } else {
      users.forEach(u => {
        const pinStatus = u.role === 'kasir' ? (u.has_pin ? '<span style="color:var(--success)">✅</span>' : '<span style="color:#94a3b8">—</span>') : '<span style="color:#94a3b8">—</span>';
        html += '<tr><td><code>' + escHtml(u.username) + '</code></td>' +
          '<td><strong>' + escHtml(u.name) + '</strong></td>' +
          '<td><span class="role-badge role-' + escHtml(u.role) + '">' + escHtml(u.role) + '</span></td>' +
          '<td>' + pinStatus + '</td>' +
          '<td><button class="btn btn-sm btn-primary" onclick=\'showUserModal(' + JSON.stringify(u).replace(/'/g, "\\'") + ')\'>✏️</button> ' +
          (u.id !== currentUser.id ? '<button class="btn btn-sm btn-danger" onclick="deleteUser(' + u.id + ')">🗑️</button>' : '') + '</td></tr>';
      });
    }
    html += '</tbody></table></div></div>';
    main.innerHTML = html;
  } catch (err) { main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat: ' + escHtml(err.message) + '</div>'; }
}

function showUserModal(user) {
  const isEdit = !!user;
  let html = '<div class="modal-header"><h3>' + (isEdit ? '✏️ Edit User' : '➕ Tambah User') + '</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body"><form id="userForm">';
  html += '<div class="form-group"><label>Username *</label><input id="uUsername" value="' + escHtml(user?.username || '') + '"' + (isEdit ? ' readonly style="background:#f3f4f6"' : ' required') + '></div>';
  html += '<div class="form-group"><label>Nama *</label><input id="uName" value="' + escHtml(user?.name || '') + '" required></div>';
  if (!isEdit) {
    html += '<div class="form-group"><label>Password *</label><input id="uPassword" type="password" required></div>';
  }
  html += '<div class="form-group"><label>Role *</label><select id="uRole" onchange="togglePinField()"><option value="kasir"' + (user?.role === 'kasir' ? ' selected' : '') + '>Kasir</option><option value="admin"' + (user?.role === 'admin' ? ' selected' : '') + '>Admin</option><option value="owner"' + (user?.role === 'owner' ? ' selected' : '') + '>Owner</option></select></div>';
  html += '<div id="pinFieldGroup" class="form-group" style="' + ((user?.role || 'kasir') === 'kasir' ? '' : 'display:none;') + '"><label>🔢 PIN Login (6 digit)' + (isEdit && user?.has_pin ? ' <span style="color:var(--success);font-size:12px;">✅ PIN sudah diatur</span>' : '') + '</label><input id="uPin" type="text" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="' + (isEdit ? 'Kosongkan jika tidak diubah' : 'Masukkan 6 digit PIN') + '"></div>';
  html += '</form></div>';
  html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveUser(' + (isEdit ? user.id : 'null') + ')">Simpan</button></div>';
  openModal(html);
}

function togglePinField() {
  const role = document.getElementById('uRole')?.value;
  const el = document.getElementById('pinFieldGroup');
  if (el) el.style.display = (role === 'kasir') ? '' : 'none';
}

async function saveUser(id) {
  const payload = {
    username: document.getElementById('uUsername').value,
    name: document.getElementById('uName').value,
    role: document.getElementById('uRole').value
  };
  // Include PIN if provided
  const pinVal = document.getElementById('uPin')?.value || '';
  if (pinVal) {
    if (!/^\d{6}$/.test(pinVal)) { showToast('PIN harus 6 digit angka', 'error'); return; }
    payload.pin = pinVal;
  }
  if (!id) {
    payload.password = document.getElementById('uPassword').value;
    if (!payload.password) { showToast('Password wajib diisi', 'error'); return; }
  }
  if (!payload.name || !payload.username) { showToast('Username dan nama wajib diisi', 'error'); return; }
  try {
    if (id) {
      await apiFetch('/api/users/' + id, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('User diperbarui');
    } else {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(payload) });
      showToast('User ditambahkan');
    }
    closeModal(); renderUsers();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteUser(id) {
  if (!confirm('Hapus user ini?')) return;
  try {
    await apiFetch('/api/users/' + id, { method: 'DELETE' });
    showToast('User dihapus'); renderUsers();
  } catch (err) { showToast(err.message, 'error'); }
}

