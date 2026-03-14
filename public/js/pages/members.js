// ============================
// MEMBER MANAGEMENT
// ============================
let memberSearch = '';
let memberLevelFilter = '';
let memberLevels = [];
let selectedMember = null;

async function renderMembers() {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div style="text-align:center;padding:60px"><div class="spinner"></div><p>Memuat data member...</p></div>';
  try {
    const [stats, levels] = await Promise.all([
      apiFetch('/api/members/stats/summary'),
      apiFetch('/api/member-levels')
    ]);
    memberLevels = levels;
    let html = '<div class="page-header"><h2>👥 Member Management</h2><div style="display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button class="btn btn-primary" onclick="showAddMemberModal()">+ Tambah Member</button>';
    if (currentUser.role === 'owner') html += '<button class="btn" onclick="showPointSettingsModal()" style="background:#8b5cf6;color:#fff">⚙️ Setting Poin</button>';
    if (currentUser.role === 'owner') html += '<button class="btn" onclick="showLevelSettingsModal()" style="background:#f59e0b;color:#fff">🏅 Setting Level</button>';
    html += '</div></div>';

    // Stats
    html += '<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">';
    html += '<div class="stat-card"><div class="stat-number">' + stats.total_members + '</div><div class="stat-label">Total Member</div></div>';
    stats.by_level.forEach(l => {
      html += '<div class="stat-card" style="border-left:4px solid ' + l.color + '"><div class="stat-number">' + l.cnt + '</div><div class="stat-label">' + l.icon + ' ' + l.name + '</div></div>';
    });
    html += '<div class="stat-card" style="border-left:4px solid #8b5cf6"><div class="stat-number">' + stats.new_this_month + '</div><div class="stat-label">Baru Bulan Ini</div></div>';
    html += '</div>';

    // Search & filter
    html += '<div style="display:flex;gap:8px;margin:16px 0;flex-wrap:wrap">';
    html += '<input type="text" id="memberSearchInput" placeholder="🔍 Cari nama/HP/kode..." value="' + escHtml(memberSearch) + '" oninput="memberSearch=this.value;loadMemberList()" style="flex:1;min-width:200px;padding:10px;border:1px solid #d1d5db;border-radius:8px">';
    html += '<select id="memberLevelSelect" onchange="memberLevelFilter=this.value;loadMemberList()" style="padding:10px;border:1px solid #d1d5db;border-radius:8px"><option value="">Semua Level</option>';
    levels.forEach(l => { html += '<option value="' + l.id + '"' + (memberLevelFilter == l.id ? ' selected' : '') + '>' + l.icon + ' ' + l.name + '</option>'; });
    html += '</select></div>';

    html += '<div id="memberListContainer"></div>';
    main.innerHTML = html;
    loadMemberList();
  } catch(e) { main.innerHTML = '<div class="alert alert-error">Gagal memuat: ' + escHtml(e.message) + '</div>'; }
}

async function loadMemberList() {
  const container = document.getElementById('memberListContainer');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div></div>';
  try {
    let url = '/api/members?is_active=1';
    if (memberSearch) url += '&search=' + encodeURIComponent(memberSearch);
    if (memberLevelFilter) url += '&level_id=' + memberLevelFilter;
    const members = await apiFetch(url);
    if (!members.length) { container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Belum ada member</div>'; return; }
    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">';
    members.forEach(m => {
      html += '<div class="card" style="padding:16px;cursor:pointer;border-left:4px solid ' + (m.level_color || '#3b82f6') + '" onclick="showMemberDetail(' + m.id + ')">';
      html += '<div style="display:flex;justify-content:space-between;align-items:start">';
      html += '<div><div style="font-weight:700;font-size:15px">' + escHtml(m.name) + '</div>';
      html += '<div style="font-size:12px;color:#64748b;margin-top:2px">' + escHtml(m.member_code || '-') + '</div>';
      if (m.phone) html += '<div style="font-size:12px;color:#64748b">📱 ' + escHtml(m.phone) + '</div>';
      html += '</div>';
      html += '<div style="text-align:right">';
      html += '<div style="font-size:11px;padding:3px 8px;border-radius:20px;font-weight:600;color:#fff;background:' + (m.level_color || '#3b82f6') + '">' + (m.level_icon || '🥉') + ' ' + escHtml(m.level_name || 'Bronze') + '</div>';
      html += '<div style="font-size:18px;font-weight:700;color:#8b5cf6;margin-top:4px">🪙 ' + (m.points || 0) + '</div>';
      html += '</div></div>';
      html += '<div style="display:flex;gap:12px;margin-top:10px;font-size:12px;color:#64748b">';
      html += '<span>🛒 ' + (m.total_transactions || 0) + ' transaksi</span>';
      html += '<span>💰 ' + formatRp(m.total_spent || 0) + '</span>';
      if (m.discount_percent > 0) html += '<span style="color:#16a34a">🏷️ Disc ' + m.discount_percent + '%</span>';
      html += '</div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
  } catch(e) { container.innerHTML = '<div class="alert alert-error">' + escHtml(e.message) + '</div>'; }
}

async function showMemberDetail(id) {
  try {
    const m = await apiFetch('/api/members/' + id);
    selectedMember = m;
    let html = '<div class="modal-overlay" onclick="if(event.target===this)this.remove()">';
    html += '<div class="modal" style="max-width:600px;max-height:90vh;overflow-y:auto">';
    html += '<div class="modal-header"><h3>' + (m.level_icon || '🥉') + ' ' + escHtml(m.name) + '</h3><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
    
    // Info card
    html += '<div style="background:linear-gradient(135deg,' + (m.level_color || '#3b82f6') + '22, ' + (m.level_color || '#3b82f6') + '08);border-radius:12px;padding:16px;margin-bottom:16px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    html += '<div><div style="font-size:12px;color:#64748b">Kode Member</div><div style="font-weight:700">' + escHtml(m.member_code || '-') + '</div></div>';
    html += '<div style="text-align:center"><div style="font-size:28px;font-weight:800;color:#8b5cf6">🪙 ' + (m.points || 0) + '</div><div style="font-size:11px;color:#64748b">Poin</div></div>';
    html += '<div style="text-align:right;padding:6px 14px;border-radius:20px;font-weight:600;color:#fff;background:' + (m.level_color || '#3b82f6') + '">' + (m.level_icon || '🥉') + ' ' + escHtml(m.level_name || 'Bronze') + '</div>';
    html += '</div>';
    if (m.next_level) {
      const needed = m.next_level.min_points - m.points;
      const progress = Math.min(100, Math.round((m.points / m.next_level.min_points) * 100));
      html += '<div style="font-size:11px;color:#64748b;margin-bottom:4px">Next: ' + m.next_level.icon + ' ' + m.next_level.name + ' (' + needed + ' poin lagi)</div>';
      html += '<div style="background:#e2e8f0;border-radius:8px;height:8px;overflow:hidden"><div style="background:linear-gradient(90deg,#8b5cf6,#a78bfa);height:100%;width:' + progress + '%;border-radius:8px;transition:width .3s"></div></div>';
    }
    html += '</div>';

    // Detail info
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px">';
    html += '<div>📱 <strong>HP:</strong> ' + escHtml(m.phone || '-') + '</div>';
    html += '<div>📧 <strong>Email:</strong> ' + escHtml(m.email || '-') + '</div>';
    html += '<div>🛒 <strong>Transaksi:</strong> ' + (m.total_transactions || 0) + 'x</div>';
    html += '<div>💰 <strong>Total Belanja:</strong> ' + formatRp(m.total_spent || 0) + '</div>';
    html += '<div>🏷️ <strong>Diskon:</strong> ' + (m.discount_percent || 0) + '%</div>';
    html += '<div>📅 <strong>Sejak:</strong> ' + (m.member_since ? new Date(m.member_since).toLocaleDateString('id') : '-') + '</div>';
    if (m.address) html += '<div style="grid-column:1/-1">📍 <strong>Alamat:</strong> ' + escHtml(m.address) + '</div>';
    if (m.notes) html += '<div style="grid-column:1/-1">📝 <strong>Catatan:</strong> ' + escHtml(m.notes) + '</div>';
    html += '</div>';

    // Action buttons
    html += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">';
    html += '<button class="btn btn-primary" onclick="this.closest(\'.modal-overlay\').remove();showEditMemberModal(' + m.id + ')">✏️ Edit</button>';
    html += '<button class="btn" style="background:#8b5cf6;color:#fff" onclick="showAdjustPointsModal(' + m.id + ',\'' + escHtml(m.name) + '\',' + m.points + ')">🪙 Adjust Poin</button>';
    if (currentUser.role === 'owner') html += '<button class="btn" style="background:#ef4444;color:#fff" onclick="if(confirm(\' Hapus member ' + escHtml(m.name) + '?\'))deleteMember(' + m.id + ')">🗑️ Hapus</button>';
    html += '</div>';

    // Point history
    if (m.point_history && m.point_history.length > 0) {
      html += '<div style="margin-bottom:16px"><h4 style="margin-bottom:8px">📊 Riwayat Poin</h4>';
      html += '<div style="max-height:200px;overflow-y:auto"><table class="table" style="font-size:12px"><thead><tr><th>Tanggal</th><th>Tipe</th><th>Poin</th><th>Saldo</th><th>Keterangan</th></tr></thead><tbody>';
      m.point_history.forEach(p => {
        const color = p.points >= 0 ? '#16a34a' : '#ef4444';
        const typeLabel = {earn:'✅ Dapat',redeem:'🎁 Tukar',adjust:'🔧 Adjust',bonus:'⭐ Bonus'}[p.type] || p.type;
        html += '<tr><td>' + new Date(p.created_at).toLocaleDateString('id') + '</td><td>' + typeLabel + '</td><td style="color:' + color + ';font-weight:600">' + (p.points > 0 ? '+' : '') + p.points + '</td><td>' + p.balance_after + '</td><td>' + escHtml(p.description || '-') + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }

    // Recent transactions
    if (m.recent_transactions && m.recent_transactions.length > 0) {
      html += '<h4 style="margin-bottom:8px">🧾 Transaksi Terakhir</h4>';
      html += '<table class="table" style="font-size:12px"><thead><tr><th>Tanggal</th><th>Total</th><th>Metode</th></tr></thead><tbody>';
      m.recent_transactions.forEach(t => {
        html += '<tr><td>' + formatDateTime(t.created_at) + '</td><td>' + formatRp(t.total) + '</td><td>' + payMethodBadge(t.payment_method) + '</td></tr>';
      });
      html += '</tbody></table>';
    }

    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  } catch(e) { showToast('Gagal memuat detail: ' + e.message, 'error'); }
}

function showAddMemberModal() {
  let html = '<div class="modal-overlay" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal" style="max-width:500px">';
  html += '<div class="modal-header"><h3>➕ Tambah Member Baru</h3><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
  html += '<div class="form-group"><label>Nama *</label><input type="text" id="memberName" placeholder="Nama lengkap"></div>';
  html += '<div class="form-group"><label>No HP</label><input type="text" id="memberPhone" placeholder="08xxxxxxxxxx"></div>';
  html += '<div class="form-group"><label>Email</label><input type="email" id="memberEmail" placeholder="email@contoh.com"></div>';
  html += '<div class="form-group"><label>Alamat</label><textarea id="memberAddress" rows="2" placeholder="Alamat..."></textarea></div>';
  html += '<div class="form-group"><label>Catatan</label><textarea id="memberNotes" rows="2" placeholder="Catatan internal..."></textarea></div>';
  html += '<button class="btn btn-primary" onclick="saveMember()" style="width:100%">💾 Simpan Member</button>';
  html += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

async function saveMember() {
  const name = document.getElementById('memberName').value.trim();
  if (!name) return showToast('Nama wajib diisi!', 'error');
  try {
    const body = {
      name, phone: document.getElementById('memberPhone').value.trim() || null,
      email: document.getElementById('memberEmail').value.trim() || null,
      address: document.getElementById('memberAddress').value.trim() || null,
      notes: document.getElementById('memberNotes').value.trim() || null
    };
    const result = await apiFetch('/api/members', { method: 'POST', body: JSON.stringify(body) });
    showToast('Member ' + name + ' berhasil ditambahkan! Kode: ' + result.member_code, 'success');
    document.querySelector('.modal-overlay').remove();
    renderMembers();
  } catch(e) { showToast(e.message, 'error'); }
}

async function showEditMemberModal(id) {
  try {
    const m = await apiFetch('/api/members/' + id);
    let html = '<div class="modal-overlay" onclick="if(event.target===this)this.remove()">';
    html += '<div class="modal" style="max-width:500px">';
    html += '<div class="modal-header"><h3>✏️ Edit Member</h3><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
    html += '<div class="form-group"><label>Nama *</label><input type="text" id="editMemberName" value="' + escHtml(m.name) + '"></div>';
    html += '<div class="form-group"><label>No HP</label><input type="text" id="editMemberPhone" value="' + escHtml(m.phone || '') + '"></div>';
    html += '<div class="form-group"><label>Email</label><input type="email" id="editMemberEmail" value="' + escHtml(m.email || '') + '"></div>';
    html += '<div class="form-group"><label>Alamat</label><textarea id="editMemberAddress" rows="2">' + escHtml(m.address || '') + '</textarea></div>';
    html += '<div class="form-group"><label>Catatan</label><textarea id="editMemberNotes" rows="2">' + escHtml(m.notes || '') + '</textarea></div>';
    html += '<div class="form-group"><label><input type="checkbox" id="editMemberActive"' + (m.is_active ? ' checked' : '') + '> Aktif</label></div>';
    html += '<button class="btn btn-primary" onclick="updateMember(' + id + ')" style="width:100%">💾 Update</button>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  } catch(e) { showToast(e.message, 'error'); }
}

async function updateMember(id) {
  try {
    const body = {
      name: document.getElementById('editMemberName').value.trim(),
      phone: document.getElementById('editMemberPhone').value.trim() || null,
      email: document.getElementById('editMemberEmail').value.trim() || null,
      address: document.getElementById('editMemberAddress').value.trim() || null,
      notes: document.getElementById('editMemberNotes').value.trim() || null,
      is_active: document.getElementById('editMemberActive').checked ? 1 : 0
    };
    await apiFetch('/api/members/' + id, { method: 'PUT', body: JSON.stringify(body) });
    showToast('Member berhasil diupdate!', 'success');
    document.querySelector('.modal-overlay').remove();
    renderMembers();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteMember(id) {
  try {
    await apiFetch('/api/members/' + id, { method: 'DELETE' });
    showToast('Member berhasil dihapus!', 'success');
    document.querySelector('.modal-overlay').remove();
    renderMembers();
  } catch(e) { showToast(e.message, 'error'); }
}

function showAdjustPointsModal(id, name, currentPts) {
  let html = '<div class="modal-overlay" onclick="if(event.target===this)this.remove()" style="z-index:100002">';
  html += '<div class="modal" style="max-width:400px;z-index:100003">';
  html += '<div class="modal-header"><h3>🪙 Adjust Poin — ' + escHtml(name) + '</h3><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
  html += '<div style="text-align:center;font-size:24px;font-weight:700;color:#8b5cf6;margin-bottom:16px">Saldo: ' + currentPts + ' poin</div>';
  html += '<div class="form-group"><label>Jumlah Poin (negatif untuk kurangi)</label><input type="number" id="adjustPointsAmount" placeholder="contoh: 100 atau -50"></div>';
  html += '<div class="form-group"><label>Keterangan</label><input type="text" id="adjustPointsDesc" placeholder="Alasan adjust..."></div>';
  html += '<button class="btn btn-primary" onclick="doAdjustPoints(' + id + ')" style="width:100%">✅ Adjust Poin</button>';
  html += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

async function doAdjustPoints(id) {
  const points = parseInt(document.getElementById('adjustPointsAmount').value);
  if (isNaN(points) || points === 0) return showToast('Masukkan jumlah poin!', 'error');
  const description = document.getElementById('adjustPointsDesc').value.trim();
  try {
    await apiFetch('/api/members/' + id + '/adjust-points', { method: 'POST', body: JSON.stringify({ points, description }) });
    showToast('Poin berhasil di-adjust!', 'success');
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    renderMembers();
  } catch(e) { showToast(e.message, 'error'); }
}

async function showPointSettingsModal() {
  try {
    const settings = await apiFetch('/api/settings/points');
    let html = '<div class="modal-overlay" onclick="if(event.target===this)this.remove()">';
    html += '<div class="modal" style="max-width:450px">';
    html += '<div class="modal-header"><h3>⚙️ Setting Poin</h3><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
    html += '<div class="form-group"><label>Poin Aktif</label><select id="setPointsEnabled"><option value="1"' + (settings.points_enabled !== '0' ? ' selected' : '') + '>Ya, aktif</option><option value="0"' + (settings.points_enabled === '0' ? ' selected' : '') + '>Tidak</option></select></div>';
    html += '<div class="form-group"><label>Setiap belanja Rp</label><input type="number" id="setPointsPerAmount" value="' + (settings.points_per_amount || 10000) + '" min="1000" step="1000"></div>';
    html += '<div class="form-group"><label>Dapat berapa poin</label><input type="number" id="setPointsRatio" value="' + (settings.points_earn_ratio || 1) + '" min="1"></div>';
    html += '<div style="background:#f0f9ff;padding:10px;border-radius:8px;font-size:12px;color:#0369a1;margin-bottom:16px">💡 Contoh: Setiap belanja Rp ' + formatRp(settings.points_per_amount || 10000) + ' dapat ' + (settings.points_earn_ratio || 1) + ' poin</div>';
    html += '<button class="btn btn-primary" onclick="savePointSettings()" style="width:100%">💾 Simpan</button>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  } catch(e) { showToast(e.message, 'error'); }
}

async function savePointSettings() {
  try {
    await apiFetch('/api/settings/points', { method: 'PUT', body: JSON.stringify({
      points_enabled: document.getElementById('setPointsEnabled').value,
      points_per_amount: document.getElementById('setPointsPerAmount').value,
      points_earn_ratio: document.getElementById('setPointsRatio').value
    })});
    showToast('Setting poin berhasil disimpan!', 'success');
    document.querySelector('.modal-overlay').remove();
  } catch(e) { showToast(e.message, 'error'); }
}

async function showLevelSettingsModal() {
  try {
    const levels = await apiFetch('/api/member-levels');
    let html = '<div class="modal-overlay" onclick="if(event.target===this)this.remove()">';
    html += '<div class="modal" style="max-width:550px">';
    html += '<div class="modal-header"><h3>🏅 Setting Level Member</h3><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
    html += '<table class="table" style="font-size:13px"><thead><tr><th>Icon</th><th>Nama</th><th>Min Poin</th><th>Diskon %</th><th>Warna</th><th></th></tr></thead><tbody>';
    levels.forEach(l => {
      html += '<tr>';
      html += '<td><input type="text" id="lvlIcon' + l.id + '" value="' + escHtml(l.icon) + '" style="width:40px;text-align:center"></td>';
      html += '<td><input type="text" id="lvlName' + l.id + '" value="' + escHtml(l.name) + '" style="width:80px"></td>';
      html += '<td><input type="number" id="lvlPts' + l.id + '" value="' + l.min_points + '" style="width:70px"></td>';
      html += '<td><input type="number" id="lvlDisc' + l.id + '" value="' + l.discount_percent + '" step="0.5" style="width:60px"></td>';
      html += '<td><input type="color" id="lvlColor' + l.id + '" value="' + l.color + '" style="width:40px;height:30px;padding:0;border:none"></td>';
      html += '<td><button class="btn btn-primary" onclick="saveLevelSetting(' + l.id + ')" style="padding:4px 10px;font-size:11px">💾</button></td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += '<div style="background:#fef3c7;padding:10px;border-radius:8px;font-size:12px;color:#92400e;margin-top:12px">⚠️ Level otomatis naik saat poin member mencapai minimum poin level tersebut.</div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  } catch(e) { showToast(e.message, 'error'); }
}

async function saveLevelSetting(id) {
  try {
    await apiFetch('/api/member-levels/' + id, { method: 'PUT', body: JSON.stringify({
      icon: document.getElementById('lvlIcon' + id).value,
      name: document.getElementById('lvlName' + id).value,
      min_points: parseInt(document.getElementById('lvlPts' + id).value),
      discount_percent: parseFloat(document.getElementById('lvlDisc' + id).value),
      color: document.getElementById('lvlColor' + id).value
    })});
    showToast('Level berhasil diupdate!', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

