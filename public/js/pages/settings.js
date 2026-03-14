// ============ SETTINGS ============
let appSettings = {};
async function loadSettings() {
  try {
    const res = await apiFetch('/api/settings');
    appSettings = res;
  } catch(e) { appSettings = {}; }
}

async function renderSettings() {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-header"><h1>⚙️ Pengaturan</h1><p>Konfigurasi toko, pajak, dan service charge</p></div><div style="display:flex;gap:20px;flex-wrap:wrap"><div class="card" style="flex:1;min-width:300px" id="settingsLoading"><p>Memuat...</p></div></div>';
  
  try {
    const s = await apiFetch('/api/settings');
    appSettings = s;
    
    main.innerHTML = `
    <div class="page-header"><h1>⚙️ Pengaturan</h1><p>Konfigurasi toko, pajak, dan service charge</p></div>
    <div style="display:flex;gap:20px;flex-wrap:wrap">
      <div class="card" style="flex:1;min-width:300px">
        <h3 style="margin-bottom:16px">🏪 Informasi Toko</h3>
        <div class="form-group"><label>Nama Toko</label><input id="sStoreName" value="${escHtml(s.store_name||'KasirPro')}"></div>
        <div class="form-group"><label>Alamat Toko</label><textarea id="sStoreAddr" rows="2">${escHtml(s.store_address||'')}</textarea></div>
        <div class="form-group"><label>No. Telepon</label><input id="sStorePhone" value="${escHtml(s.store_phone||'')}"></div>
      </div>
      <div class="card" style="flex:1;min-width:300px">
        <h3 style="margin-bottom:16px">💰 Pajak & Service Charge</h3>
        <div class="form-group" style="display:flex;align-items:center;gap:12px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="sTaxEnabled" ${s.tax_enabled ? 'checked' : ''} style="width:18px;height:18px"> Aktifkan Pajak
          </label>
        </div>
        <div class="form-group" style="display:flex;gap:12px">
          <div style="flex:1"><label>Nama Pajak</label><input id="sTaxName" value="${escHtml(s.tax_name||'PB1')}" placeholder="PB1/PPN"></div>
          <div style="flex:1"><label>Rate (%)</label><input id="sTaxRate" type="number" step="0.5" min="0" max="100" value="${s.tax_rate||10}"></div>
        </div>
        <hr style="margin:16px 0;border-color:rgba(255,255,255,0.1)">
        <div class="form-group" style="display:flex;align-items:center;gap:12px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="sServiceEnabled" ${s.service_charge_enabled ? 'checked' : ''} style="width:18px;height:18px"> Aktifkan Service Charge
          </label>
        </div>
        <div class="form-group"><label>Rate Service (%)</label><input id="sServiceRate" type="number" step="0.5" min="0" max="100" value="${s.service_charge_rate||5}"></div>
        <button class="btn" onclick="saveSettings()" style="width:100%;margin-top:8px">💾 Simpan Pengaturan</button>
      </div>
      <div class="card" style="flex:1;min-width:300px">
        <h3 style="margin-bottom:16px">🧾 Struk & Branding</h3>
        <div class="form-group"><label>Logo Toko (URL gambar)</label><input id="sLogoUrl" value="${escHtml(s.store_logo_url||'')}" placeholder="https://example.com/logo.png"></div>
        <div id="logoPreview" style="text-align:center;margin-bottom:12px">${s.store_logo_url ? '<img src="'+escHtml(s.store_logo_url)+'" style="max-height:80px;max-width:200px;border-radius:8px;border:1px solid var(--border)">' : '<span style="color:#94a3b8;font-size:13px">Belum ada logo</span>'}</div>
        <div class="form-group"><label>Footer Struk</label><input id="sReceiptFooter" value="${escHtml(s.receipt_footer||'Terima kasih telah berbelanja!')}" placeholder="Terima kasih telah berbelanja!"></div>
        <p style="font-size:12px;color:#94a3b8;margin-top:8px">💡 Logo akan muncul di halaman login dan struk</p>
      </div>
    </div>`;
  } catch(err) {
    main.innerHTML = '<div class="card"><p style="color:#ef4444">Gagal memuat settings: ' + escHtml(err.message) + '</p></div>';
  }
}

async function saveSettings() {
  try {
    const data = {
      store_name: document.getElementById('sStoreName').value,
      store_address: document.getElementById('sStoreAddr').value,
      store_phone: document.getElementById('sStorePhone').value,
      tax_enabled: document.getElementById('sTaxEnabled').checked,
      tax_name: document.getElementById('sTaxName').value,
      tax_rate: parseFloat(document.getElementById('sTaxRate').value) || 0,
      service_charge_enabled: document.getElementById('sServiceEnabled').checked,
      service_charge_rate: parseFloat(document.getElementById('sServiceRate').value) || 0,
      receipt_footer: document.getElementById('sReceiptFooter').value,
      store_logo_url: document.getElementById('sLogoUrl').value,
    };
    const res = await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(data) });
    appSettings = res.settings;
    showToast('Pengaturan berhasil disimpan! ✅');
  } catch(err) {
    showToast(err.message, 'error');
  }
}

