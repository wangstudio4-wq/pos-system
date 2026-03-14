// ============ CHANGE PASSWORD ============
function renderPassword() {
  const main = document.getElementById('mainContent');
  let html = '<div class="page-header"><h1>🔑 Ganti Password</h1><p>Ubah password akun Anda</p></div>';
  html += '<div class="card" style="max-width:500px"><form id="passwordForm">';
  html += '<div class="form-group"><label>Password Lama</label><input id="oldPassword" type="password" required></div>';
  html += '<div class="form-group"><label>Password Baru</label><input id="newPassword" type="password" required></div>';
  html += '<div class="form-group"><label>Konfirmasi Password Baru</label><input id="confirmPassword" type="password" required></div>';
  html += '<button type="button" class="btn btn-primary" onclick="changePassword()">Simpan Password</button>';
  html += '</form></div>';
  main.innerHTML = html;
}

function renderChangePin() {
  const main = document.getElementById('mainContent');
  let html = '<div class="page-header"><h1>🔢 Ganti PIN</h1><p>Ubah PIN login Anda</p></div>';
  html += '<div class="card" style="max-width:400px;margin:0 auto;padding:24px;">';
  html += '<form id="changePinForm">';
  html += '<div class="form-group"><label>PIN Lama</label><input type="password" id="cpOldPin" inputmode="numeric" maxlength="6" placeholder="Masukkan PIN lama (kosongkan jika belum punya)"></div>';
  html += '<div class="form-group"><label>PIN Baru (6 digit) *</label><input type="password" id="cpNewPin" inputmode="numeric" maxlength="6" placeholder="Masukkan 6 digit PIN baru" required></div>';
  html += '<div class="form-group"><label>Konfirmasi PIN Baru *</label><input type="password" id="cpNewPin2" inputmode="numeric" maxlength="6" placeholder="Ulangi PIN baru" required></div>';
  html += '<button type="submit" class="btn btn-primary btn-block">💾 Simpan PIN</button>';
  html += '</form></div>';
  main.innerHTML = html;
  document.getElementById('changePinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPin = document.getElementById('cpOldPin').value;
    const newPin = document.getElementById('cpNewPin').value;
    const newPin2 = document.getElementById('cpNewPin2').value;
    if (!/^\d{6}$/.test(newPin)) { showToast('PIN baru harus 6 digit angka', 'error'); return; }
    if (newPin !== newPin2) { showToast('Konfirmasi PIN tidak cocok', 'error'); return; }
    try {
      await apiFetch('/api/auth/change-pin', { method: 'POST', body: JSON.stringify({ old_pin: oldPin || null, new_pin: newPin }) });
      showToast('PIN berhasil diubah!');
      document.getElementById('changePinForm').reset();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function changePassword() {
  const oldPw = document.getElementById('oldPassword').value;
  const newPw = document.getElementById('newPassword').value;
  const confirmPw = document.getElementById('confirmPassword').value;
  if (!oldPw || !newPw) { showToast('Semua field wajib diisi', 'error'); return; }
  if (newPw !== confirmPw) { showToast('Konfirmasi password tidak cocok', 'error'); return; }
  if (newPw.length < 4) { showToast('Password minimal 4 karakter', 'error'); return; }
  try {
    await apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ old_password: oldPw, new_password: newPw }) });
    showToast('Password berhasil diubah!');
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
  } catch (err) { showToast(err.message, 'error'); }
}


