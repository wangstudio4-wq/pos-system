// ============ VOID & REFUND ============
function voidTransaction(id) {
  let html = '<div class="modal-header"><h3>🚫 Void Transaksi #' + id + '</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body"><p style="color:#dc2626;font-weight:600;margin-bottom:12px">⚠️ Void akan membatalkan transaksi dan mengembalikan stok.</p>';
  html += '<div class="form-group"><label>Alasan Void *</label><textarea id="voidReason" rows="3" placeholder="Masukkan alasan void..." required style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-family:inherit"></textarea></div></div>';
  html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-danger" onclick="confirmVoid(' + id + ')">🚫 Void Transaksi</button></div>';
  openModal(html);
}

async function confirmVoid(id) {
  const reason = document.getElementById('voidReason').value.trim();
  if (!reason) { showToast('Alasan void wajib diisi!', 'error'); return; }
  try {
    await apiFetch('/api/transactions/' + id + '/void', { method: 'POST', body: JSON.stringify({ reason }) });
    showToast('Transaksi berhasil di-void!', 'success');
    closeModal();
    renderReports();
  } catch (err) { showToast(err.message, 'error'); }
}

function refundTransaction(id) {
  let html = '<div class="modal-header"><h3>↩️ Refund Transaksi #' + id + '</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body"><p style="color:#d97706;font-weight:600;margin-bottom:12px">⚠️ Refund akan mengembalikan uang & stok ke semula.</p>';
  html += '<div class="form-group"><label>Alasan Refund *</label><textarea id="refundReason" rows="3" placeholder="Masukkan alasan refund..." required style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-family:inherit"></textarea></div></div>';
  html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="confirmRefund(' + id + ')" style="background:#f59e0b">↩️ Refund Transaksi</button></div>';
  openModal(html);
}

async function confirmRefund(id) {
  const reason = document.getElementById('refundReason').value.trim();
  if (!reason) { showToast('Alasan refund wajib diisi!', 'error'); return; }
  try {
    await apiFetch('/api/transactions/' + id + '/refund', { method: 'POST', body: JSON.stringify({ reason }) });
    showToast('Transaksi berhasil di-refund!', 'success');
    closeModal();
    renderReports();
  } catch (err) { showToast(err.message, 'error'); }
}

