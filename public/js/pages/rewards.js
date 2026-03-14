// ============================
// REWARDS MANAGEMENT
// ============================
async function renderRewards() {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div style="text-align:center;padding:60px"><div class="spinner"></div></div>';
  try {
    const rewards = await apiFetch('/api/rewards');
    let html = '<div class="page-header"><h2>🎁 Rewards Catalog</h2>';
    html += '<button class="btn btn-primary" onclick="showAddRewardModal()">+ Tambah Reward</button></div>';

    if (!rewards.length) {
      html += '<div style="text-align:center;padding:60px;color:#94a3b8"><div style="font-size:48px;margin-bottom:12px">🎁</div><p>Belum ada reward. Tambahkan reward yang bisa ditukar member!</p></div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">';
      rewards.forEach(r => {
        const typeLabel = {discount_percent:'🏷️ Diskon %',discount_fixed:'💵 Potongan',free_product:'📦 Produk Gratis',voucher:'🎫 Voucher'}[r.reward_type] || r.reward_type;
        const valueText = r.reward_type === 'discount_percent' ? r.reward_value + '%' : (r.reward_type === 'free_product' ? '' : formatRp(r.reward_value));
        html += '<div class="card" style="padding:16px;opacity:' + (r.is_active ? '1' : '0.5') + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:start">';
        html += '<div><div style="font-weight:700;font-size:15px">' + escHtml(r.name) + '</div>';
        if (r.description) html += '<div style="font-size:12px;color:#64748b;margin-top:2px">' + escHtml(r.description) + '</div>';
        html += '<div style="font-size:12px;margin-top:4px">' + typeLabel + (valueText ? ' ' + valueText : '') + '</div>';
        html += '</div>';
        html += '<div style="text-align:right">';
        html += '<div style="font-size:20px;font-weight:800;color:#8b5cf6">🪙 ' + r.points_cost + '</div>';
        html += '<div style="font-size:11px;color:#64748b">' + (r.stock < 0 ? '∞ Unlimited' : (r.stock === 0 ? '❌ Habis' : r.stock + ' tersisa')) + '</div>';
        html += '</div></div>';
        html += '<div style="display:flex;gap:6px;margin-top:12px">';
        html += '<button class="btn btn-primary" onclick="showRedeemModal(' + r.id + ',\'' + escHtml(r.name) + '\',' + r.points_cost + ')" style="flex:1;font-size:12px"' + (r.is_active && r.stock !== 0 ? '' : ' disabled') + '>🎁 Tukar</button>';
        html += '<button class="btn" onclick="showEditRewardModal(' + r.id + ')" style="font-size:12px;background:#f1f5f9;color:#334155">✏️</button>';
        if (currentUser.role === 'owner') html += '<button class="btn" onclick="if(confirm(\'Hapus reward?\'))deleteReward(' + r.id + ')" style="font-size:12px;background:#fef2f2;color:#ef4444">🗑️</button>';
        html += '</div></div>';
      });
      html += '</div>';
    }
    main.innerHTML = html;
  } catch(e) { main.innerHTML = '<div class="alert alert-error">' + escHtml(e.message) + '</div>'; }
}

function showAddRewardModal() {
  let html = '<div class="modal-overlay" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal" style="max-width:500px">';
  html += '<div class="modal-header"><h3>➕ Tambah Reward</h3><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
  html += '<div class="form-group"><label>Nama Reward *</label><input type="text" id="rewardName" placeholder="contoh: Diskon 10%"></div>';
  html += '<div class="form-group"><label>Deskripsi</label><input type="text" id="rewardDesc" placeholder="Keterangan..."></div>';
  html += '<div class="form-group"><label>Poin yang Dibutuhkan *</label><input type="number" id="rewardPointsCost" value="100" min="1"></div>';
  html += '<div class="form-group"><label>Tipe Reward</label><select id="rewardType" onchange="toggleRewardValue()">';
  html += '<option value="discount_fixed">💵 Potongan Harga (Rp)</option>';
  html += '<option value="discount_percent">🏷️ Diskon (%)</option>';
  html += '<option value="free_product">📦 Produk Gratis</option>';
  html += '<option value="voucher">🎫 Voucher</option></select></div>';
  html += '<div class="form-group" id="rewardValueGroup"><label>Nilai Reward</label><input type="number" id="rewardValue" value="10000" min="0"></div>';
  html += '<div class="form-group"><label>Stok (-1 = unlimited)</label><input type="number" id="rewardStock" value="-1" min="-1"></div>';
  html += '<button class="btn btn-primary" onclick="saveReward()" style="width:100%">💾 Simpan</button>';
  html += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function toggleRewardValue() {
  const type = document.getElementById('rewardType').value;
  document.getElementById('rewardValueGroup').style.display = type === 'free_product' ? 'none' : '';
}

async function saveReward() {
  const name = document.getElementById('rewardName').value.trim();
  const points_cost = parseInt(document.getElementById('rewardPointsCost').value);
  if (!name || !points_cost) return showToast('Nama dan poin wajib diisi!', 'error');
  try {
    await apiFetch('/api/rewards', { method: 'POST', body: JSON.stringify({
      name, description: document.getElementById('rewardDesc').value.trim(),
      points_cost, reward_type: document.getElementById('rewardType').value,
      reward_value: parseFloat(document.getElementById('rewardValue').value) || 0,
      stock: parseInt(document.getElementById('rewardStock').value)
    })});
    showToast('Reward berhasil ditambahkan!', 'success');
    document.querySelector('.modal-overlay').remove();
    renderRewards();
  } catch(e) { showToast(e.message, 'error'); }
}

async function showEditRewardModal(id) {
  try {
    const rewards = await apiFetch('/api/rewards');
    const r = rewards.find(x => x.id === id);
    if (!r) return showToast('Reward not found', 'error');
    let html = '<div class="modal-overlay" onclick="if(event.target===this)this.remove()">';
    html += '<div class="modal" style="max-width:500px">';
    html += '<div class="modal-header"><h3>✏️ Edit Reward</h3><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
    html += '<div class="form-group"><label>Nama</label><input type="text" id="editRewardName" value="' + escHtml(r.name) + '"></div>';
    html += '<div class="form-group"><label>Deskripsi</label><input type="text" id="editRewardDesc" value="' + escHtml(r.description || '') + '"></div>';
    html += '<div class="form-group"><label>Poin</label><input type="number" id="editRewardPts" value="' + r.points_cost + '"></div>';
    html += '<div class="form-group"><label>Tipe</label><select id="editRewardType">';
    ['discount_fixed','discount_percent','free_product','voucher'].forEach(t => {
      html += '<option value="' + t + '"' + (r.reward_type === t ? ' selected' : '') + '>' + t + '</option>';
    });
    html += '</select></div>';
    html += '<div class="form-group"><label>Nilai</label><input type="number" id="editRewardVal" value="' + r.reward_value + '"></div>';
    html += '<div class="form-group"><label>Stok</label><input type="number" id="editRewardStock" value="' + r.stock + '"></div>';
    html += '<div class="form-group"><label><input type="checkbox" id="editRewardActive"' + (r.is_active ? ' checked' : '') + '> Aktif</label></div>';
    html += '<button class="btn btn-primary" onclick="updateReward(' + id + ')" style="width:100%">💾 Update</button>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  } catch(e) { showToast(e.message, 'error'); }
}

async function updateReward(id) {
  try {
    await apiFetch('/api/rewards/' + id, { method: 'PUT', body: JSON.stringify({
      name: document.getElementById('editRewardName').value.trim(),
      description: document.getElementById('editRewardDesc').value.trim(),
      points_cost: parseInt(document.getElementById('editRewardPts').value),
      reward_type: document.getElementById('editRewardType').value,
      reward_value: parseFloat(document.getElementById('editRewardVal').value) || 0,
      stock: parseInt(document.getElementById('editRewardStock').value),
      is_active: document.getElementById('editRewardActive').checked ? 1 : 0
    })});
    showToast('Reward berhasil diupdate!', 'success');
    document.querySelector('.modal-overlay').remove();
    renderRewards();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteReward(id) {
  try {
    await apiFetch('/api/rewards/' + id, { method: 'DELETE' });
    showToast('Reward berhasil dihapus!', 'success');
    renderRewards();
  } catch(e) { showToast(e.message, 'error'); }
}

function showRedeemModal(rewardId, rewardName, pointsCost) {
  let html = '<div class="modal-overlay" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal" style="max-width:450px">';
  html += '<div class="modal-header"><h3>🎁 Tukar Reward</h3><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
  html += '<div style="text-align:center;margin-bottom:16px"><div style="font-size:16px;font-weight:700">' + escHtml(rewardName) + '</div><div style="color:#8b5cf6;font-weight:600">🪙 ' + pointsCost + ' poin</div></div>';
  html += '<div class="form-group"><label>Cari Member</label><input type="text" id="redeemMemberSearch" placeholder="Ketik nama/HP/kode..." oninput="searchRedeemMember(this.value,' + rewardId + ')"></div>';
  html += '<div id="redeemMemberResults" style="margin-bottom:16px"></div>';
  html += '<div id="redeemSelectedMember" style="display:none;background:#f0fdf4;padding:12px;border-radius:8px;margin-bottom:16px"></div>';
  html += '<button class="btn btn-primary" id="redeemBtn" onclick="doRedeem(' + rewardId + ')" style="width:100%" disabled>🎁 Konfirmasi Tukar</button>';
  html += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

let redeemCustomerId = null;
async function searchRedeemMember(q, rewardId) {
  if (q.length < 2) { document.getElementById('redeemMemberResults').innerHTML = ''; return; }
  try {
    const results = await apiFetch('/api/members/search/quick?q=' + encodeURIComponent(q));
    let html = '';
    results.forEach(m => {
      html += '<div style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:4px;cursor:pointer;display:flex;justify-content:space-between;align-items:center" onclick="selectRedeemMember(' + m.id + ',\'' + escHtml(m.name) + '\',' + m.points + ',\'' + escHtml(m.level_icon || '🥉') + ' ' + escHtml(m.level_name || 'Bronze') + '\')">';
      html += '<div><strong>' + escHtml(m.name) + '</strong> <span style="font-size:11px;color:#64748b">' + escHtml(m.member_code) + '</span></div>';
      html += '<div style="color:#8b5cf6;font-weight:600">🪙 ' + m.points + '</div></div>';
    });
    document.getElementById('redeemMemberResults').innerHTML = html || '<div style="color:#94a3b8;font-size:13px">Tidak ditemukan</div>';
  } catch(e) { /* ignore */ }
}

function selectRedeemMember(id, name, points, levelText) {
  redeemCustomerId = id;
  document.getElementById('redeemMemberResults').innerHTML = '';
  document.getElementById('redeemMemberSearch').value = name;
  const el = document.getElementById('redeemSelectedMember');
  el.style.display = 'block';
  el.innerHTML = '<div style="display:flex;justify-content:space-between"><div><strong>' + escHtml(name) + '</strong><br><span style="font-size:12px">' + levelText + '</span></div><div style="color:#8b5cf6;font-weight:700;font-size:18px">🪙 ' + points + '</div></div>';
  document.getElementById('redeemBtn').disabled = false;
}

async function doRedeem(rewardId) {
  if (!redeemCustomerId) return showToast('Pilih member dulu!', 'error');
  try {
    const result = await apiFetch('/api/rewards/' + rewardId + '/redeem', { method: 'POST', body: JSON.stringify({ customer_id: redeemCustomerId }) });
    showToast('🎉 Reward berhasil ditukar! Sisa poin: ' + result.new_balance, 'success');
    document.querySelector('.modal-overlay').remove();
    redeemCustomerId = null;
    renderRewards();
  } catch(e) { showToast(e.message, 'error'); }
}
