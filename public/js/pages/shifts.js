// ============ SHIFTS ============
async function renderShifts() {
  const main = document.getElementById('mainContent');
  try {
    const currentData = await apiFetch('/api/shifts/current').catch(() => ({ shift: null }));
    const currentShift = currentData.shift || currentData.current_shift || null;

    let html = '<div class="page-header"><h1>⏰ Shift</h1><p>Manajemen shift kasir</p></div>';

    // Current shift status
    html += '<div class="card shift-card mb-4">';
    if (currentShift) {
      const expectedCash = currentShift.expected_cash || (parseFloat(currentShift.opening_cash || 0) + parseFloat(currentShift.total_sales || 0));
      html += '<div class="shift-status shift-open">';
      html += '<h3 style="color:var(--success)">🟢 Shift Sedang Berjalan</h3>';
      html += '<p class="mt-2">Dibuka oleh: <strong>' + escHtml(currentShift.user_name || currentShift.username || '-') + '</strong></p>';
      html += '<p>Waktu buka: <strong>' + formatDateTime(currentShift.opened_at) + '</strong></p>';
      html += '</div>';
      // Shift summary cards
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:16px 0;">';
      html += '<div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center;"><div style="font-size:11px;color:var(--text-secondary);">Kas Awal</div><div style="font-size:18px;font-weight:700;color:var(--primary);margin-top:4px;">' + formatRp(currentShift.opening_cash) + '</div></div>';
      html += '<div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center;"><div style="font-size:11px;color:var(--text-secondary);">Penjualan</div><div style="font-size:18px;font-weight:700;color:var(--success);margin-top:4px;">' + formatRp(currentShift.total_sales || 0) + '</div><div style="font-size:11px;color:var(--text-secondary);">' + (currentShift.total_transactions || 0) + ' transaksi</div></div>';
      html += '<div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center;"><div style="font-size:11px;color:var(--text-secondary);">Kas Diharapkan</div><div style="font-size:18px;font-weight:700;color:var(--primary);margin-top:4px;">' + formatRp(expectedCash) + '</div></div>';
      html += '</div>';
      // Close shift form
      html += '<div class="mt-4"><div class="form-group"><label>💰 Kas Aktual (hitung uang fisik di laci kas)</label>';
      html += '<input id="closingCash" type="text" inputmode="numeric" value="' + formatDots(expectedCash) + '" oninput="formatMoneyInput(this); calcShiftDiff(' + expectedCash + ')" style="font-size:18px;font-weight:700;text-align:center;padding:12px;">';
      html += '</div>';
      html += '<div id="shiftDiffInfo" style="text-align:center;padding:8px;border-radius:8px;margin-bottom:12px;background:rgba(34,197,94,0.1);color:var(--success);font-weight:600;">✅ Kas sesuai</div>';
      html += '<div class="form-group"><label>Catatan</label><textarea id="shiftNotes" placeholder="Catatan shift (opsional)"></textarea></div>';
      html += '<button class="btn btn-danger btn-block" onclick="closeShift()">🔴 Tutup Shift</button></div>';
    } else {
      html += '<div class="shift-status shift-closed">';
      html += '<h3>⚪ Tidak Ada Shift Aktif</h3>';
      html += '<p class="mt-2" style="color:var(--text-secondary)">Buka shift untuk mulai bertransaksi</p>';
      html += '</div>';
      html += '<div class="mt-4"><div class="form-group"><label>Kas Awal (Rp)</label><input id="openingCash" type="text" inputmode="numeric" oninput="formatMoneyInput(this)" placeholder="Masukkan jumlah kas awal"></div>';
      html += '<button class="btn btn-success btn-block" onclick="openShift()">🟢 Buka Shift</button></div>';
    }
    html += '</div>';

    // Shift history (admin/owner)
    if (currentUser.role === 'admin' || currentUser.role === 'owner') {
      const today = new Date().toISOString().split('T')[0];
      const histData = await apiFetch('/api/shifts?date=' + today).catch(() => ({ shifts: [] }));
      const shifts = histData.shifts || histData || [];

      html += '<div class="card"><div class="card-header"><h3>📋 Riwayat Shift Hari Ini</h3></div>';
      if (Array.isArray(shifts) && shifts.length > 0) {
        html += '<div class="overflow-x"><table><thead><tr><th>Kasir</th><th>Buka</th><th>Tutup</th><th>Kas Awal</th><th>Kas Akhir</th><th>Status</th></tr></thead><tbody>';
        shifts.forEach(s => {
          const status = s.closed_at ? '<span class="badge badge-red">Ditutup</span>' : '<span class="badge badge-green">Aktif</span>';
          html += '<tr><td>' + escHtml(s.user_name || s.username || '-') + '</td>' +
            '<td>' + formatTime(s.opened_at) + '</td>' +
            '<td>' + (s.closed_at ? formatTime(s.closed_at) : '-') + '</td>' +
            '<td>' + formatRp(s.opening_cash) + '</td>' +
            '<td>' + (s.closing_cash !== null && s.closing_cash !== undefined ? formatRp(s.closing_cash) : '-') + '</td>' +
            '<td>' + status + '</td></tr>';
        });
        html += '</tbody></table></div>';
      } else {
        html += emptyHtml('⏰', 'Belum ada shift hari ini');
      }
      html += '</div>';
    }

    main.innerHTML = html;
  } catch (err) { main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat: ' + escHtml(err.message) + '</div>'; }
}

function formatMoneyInput(el) {
  const pos = el.selectionStart;
  const oldLen = el.value.length;
  let raw = el.value.replace(/\D/g, '');
  el.value = raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const newLen = el.value.length;
  const newPos = Math.max(0, pos + (newLen - oldLen));
  el.setSelectionRange(newPos, newPos);
}

function parseMoneyValue(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return Number(String(el.value).replace(/\./g, '')) || 0;
}

function formatDots(num) {
  return String(Math.round(Number(num) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function calcShiftDiff(expected) {
  const actual = parseMoneyValue('closingCash');
  const diff = actual - expected;
  const el = document.getElementById('shiftDiffInfo');
  if (!el) return;
  if (Math.abs(diff) < 1) {
    el.style.background = 'rgba(34,197,94,0.1)';
    el.style.color = 'var(--success)';
    el.innerHTML = '✅ Kas sesuai!';
  } else if (diff > 0) {
    el.style.background = 'rgba(59,130,246,0.1)';
    el.style.color = '#3b82f6';
    el.innerHTML = '⬆️ Lebih <strong>' + formatRp(diff) + '</strong>';
  } else {
    el.style.background = 'rgba(239,68,68,0.1)';
    el.style.color = '#ef4444';
    el.innerHTML = '⬇️ Kurang <strong>' + formatRp(Math.abs(diff)) + '</strong>';
  }
}

async function openShift() {
  const cashEl = document.getElementById('openingCash');
  const cash = parseMoneyValue('openingCash');
  try {
    const res = await apiFetch('/api/shifts/open', { method: 'POST', body: JSON.stringify({ opening_cash: cash }) });
    showToast(res.message || 'Shift dibuka!', 'success');
    // Update active shift
    const shiftData = await apiFetch('/api/shifts/current').catch(() => ({ shift: null }));
    activeShift = shiftData.shift || null;
    renderShifts();
  } catch (err) { showToast('Gagal buka shift: ' + err.message, 'error'); }
}

async function closeShift() {
  const cashEl = document.getElementById('closingCash');
  const notesEl = document.getElementById('shiftNotes');
  const cash = parseMoneyValue('closingCash');
  const notes = notesEl?.value || '';
  try {
    const result = await apiFetch('/api/shifts/close', { method: 'POST', body: JSON.stringify({ closing_cash: cash, notes: notes }) });
    activeShift = null;
    showToast('Shift ditutup!', 'success');
    // Show summary if available
    if (result.summary) {
      const s = result.summary;
      const diff = s.difference || 0;
      const diffColor = diff >= 0 ? 'var(--success)' : 'var(--danger, #ef4444)';
      const diffLabel = diff >= 0 ? 'Lebih' : 'Kurang';
      openModal('<div class="modal-header"><h3>📊 Ringkasan Shift</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
        '<div class="modal-body" style="padding:16px;">' +
        '<div class="receipt-row"><span>Kas Awal</span><span>' + formatRp(s.opening_cash) + '</span></div>' +
        '<div class="receipt-row"><span>Total Penjualan</span><span>' + formatRp(s.total_sales) + '</span></div>' +
        '<div class="receipt-row"><span>Total Transaksi</span><span>' + s.total_transactions + ' transaksi</span></div>' +
        '<div class="receipt-row"><span>Kas Diharapkan</span><span>' + formatRp(s.expected_cash) + '</span></div>' +
        '<div class="receipt-row"><span>Kas Akhir</span><span>' + formatRp(s.closing_cash) + '</span></div>' +
        '<hr style="margin:8px 0">' +
        '<div class="receipt-row" style="font-weight:bold;"><span>Selisih</span><span style="color:' + diffColor + '">' + diffLabel + ' ' + formatRp(Math.abs(diff)) + '</span></div>' +
        '</div>');
    }
    renderShifts();
  } catch (err) { showToast(err.message, 'error'); }
}

