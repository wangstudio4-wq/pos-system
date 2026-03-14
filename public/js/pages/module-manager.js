// ============ MODULE MANAGER ============
async function renderModuleManager() {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-header"><h1>🧩 Module Manager</h1><p>Kelola modul & fitur yang aktif</p></div><div class="card"><p>Memuat modul...</p></div>';

  try {
    const modules = await apiFetch('/api/modules');
    
    const coreModules = modules.filter(m => m.is_core);
    const optionalModules = modules.filter(m => !m.is_core);
    
    main.innerHTML = `
    <div class="page-header">
      <h1>🧩 Module Manager</h1>
      <p>Kelola modul & fitur yang aktif di toko Anda</p>
    </div>
    
    <div class="card" style="margin-bottom:20px;background:linear-gradient(135deg,var(--primary-light),#fff);border:1px solid var(--primary)">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:28px">📊</span>
        <div>
          <div style="font-weight:700;font-size:16px;color:var(--primary-dark)">${modules.filter(m=>m.is_enabled).length} / ${modules.length} modul aktif</div>
          <div style="font-size:13px;color:var(--text-secondary)">Aktifkan modul sesuai kebutuhan bisnis Anda</div>
        </div>
      </div>
    </div>

    ${coreModules.length ? `
    <h3 style="margin:20px 0 12px;color:var(--text-secondary);font-size:14px;text-transform:uppercase;letter-spacing:1px">🔒 Modul Inti (Selalu Aktif)</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:24px">
      ${coreModules.map(m => moduleCard(m)).join('')}
    </div>` : ''}

    ${optionalModules.length ? `
    <h3 style="margin:20px 0 12px;color:var(--text-secondary);font-size:14px;text-transform:uppercase;letter-spacing:1px">⚡ Modul Opsional</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
      ${optionalModules.map(m => moduleCard(m)).join('')}
    </div>` : `
    <div class="card" style="text-align:center;padding:40px;color:var(--text-secondary)">
      <span style="font-size:48px">📦</span>
      <p style="margin-top:12px">Belum ada modul opsional tersedia.<br>Modul akan muncul setelah Phase R2.</p>
    </div>`}
    `;
  } catch(err) {
    main.innerHTML = `<div class="card"><p style="color:#ef4444">Gagal memuat modul: ${escHtml(err.message)}</p><button class="btn" onclick="renderModuleManager()">🔄 Coba Lagi</button></div>`;
  }
}

function moduleCard(m) {
  const icons = {
    'core-pos': '🛒', 'core-products': '📦', 'core-reports': '📊', 'core-users': '👥',
    'inventory': '📋', 'pricing': '💲', 'member': '🏅', 'vip-pricing': '⭐',
    'kasbon': '💳', 'advanced-report': '📈', 'expired-tracking': '⏰', 'import-export': '📤'
  };
  const icon = icons[m.id] || '🧩';
  const statusColor = m.is_enabled ? 'var(--success)' : '#94a3b8';
  const statusText = m.is_enabled ? 'Aktif' : 'Nonaktif';
  const deps = m.dependencies ? JSON.parse(m.dependencies || '[]') : [];
  
  return `
  <div class="card" style="padding:16px;border-left:4px solid ${statusColor};transition:all .2s">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="display:flex;gap:10px;align-items:center">
        <span style="font-size:24px">${icon}</span>
        <div>
          <div style="font-weight:700;font-size:15px">${escHtml(m.name)}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${escHtml(m.description||'')}</div>
        </div>
      </div>
      ${m.is_core ? 
        '<span style="font-size:11px;background:var(--primary-light);color:var(--primary);padding:2px 8px;border-radius:8px;font-weight:600">CORE</span>' :
        `<label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer">
          <input type="checkbox" ${m.is_enabled ? 'checked' : ''} onchange="toggleModule('${m.id}',this.checked)" style="opacity:0;width:0;height:0">
          <span style="position:absolute;inset:0;background:${m.is_enabled ? 'var(--success)' : '#cbd5e1'};border-radius:24px;transition:.3s"></span>
          <span style="position:absolute;top:2px;left:${m.is_enabled ? '22px' : '2px'};width:20px;height:20px;background:white;border-radius:50%;transition:.3s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></span>
        </label>`
      }
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;align-items:center">
      <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:${m.is_enabled ? 'var(--success-bg)' : '#f1f5f9'};color:${m.is_enabled ? 'var(--success)' : '#94a3b8'};font-weight:600">${statusText}</span>
      <span style="font-size:11px;color:#94a3b8">v${m.version||'1.0.0'}</span>
      ${deps.length ? `<span style="font-size:11px;color:#94a3b8">⛓ ${deps.join(', ')}</span>` : ''}
    </div>
  </div>`;
}

async function toggleModule(moduleId, enabled) {
  try {
    await apiFetch(`/api/modules/${moduleId}/toggle`, { 
      method: 'POST', 
      body: JSON.stringify({ enabled }) 
    });
    showToast(`Modul ${enabled ? 'diaktifkan' : 'dinonaktifkan'} ✅`);
    // Reload modules list in ModuleLoader if available
    if (window.ModuleLoader) await ModuleLoader.init();
    renderModuleManager();
  } catch(err) {
    showToast('Gagal: ' + err.message, 'error');
    renderModuleManager();
  }
}
