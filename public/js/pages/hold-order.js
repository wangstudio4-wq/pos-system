// ============ HOLD ORDER ============
function saveHeldOrders() {
  localStorage.setItem('kasirpro_held_orders', JSON.stringify(heldOrders));
}

function holdOrder() {
  if (cart.length === 0) { showToast('Keranjang kosong!', 'warning'); return; }
  const discountEl = document.getElementById('cartDiscount');
  const notesEl = document.getElementById('cartNotes');
  const totalDiscount = discountEl ? (Number(discountEl.value) || 0) : 0;
  const notes = notesEl ? notesEl.value : '';

  const subtotal = cart.reduce((s, c) => s + (c.price * c.qty - c.discount - (c.autoDiscount || 0)), 0);
  const { grandTotal } = calcTaxService(subtotal, totalDiscount);

  const orderNum = heldOrders.length + 1;
  heldOrders.push({
    id: Date.now(),
    label: 'Order #' + orderNum,
    items: cart.map(c => ({ ...c })),
    discount: totalDiscount,
    notes,
    custId,
    custName,
    total: grandTotal,
    time: new Date().toISOString()
  });
  saveHeldOrders();
  cart = [];
  updateCartUI();
  showToast('Order ditahan! ⏸️', 'success');
  updateHeldBadge();
}

function updateHeldBadge() {
  const badge = document.getElementById('heldBadge');
  if (badge) {
    badge.textContent = heldOrders.length;
    badge.style.display = heldOrders.length > 0 ? 'inline-flex' : 'none';
  }
}

function showHeldOrders() {
  if (heldOrders.length === 0) {
    showToast('Tidak ada order tertahan', 'warning');
    return;
  }
  let html = '<div class="modal-header"><h3>⏸️ Order Tertahan (' + heldOrders.length + ')</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body"><div class="held-orders-list">';
  heldOrders.forEach((o, idx) => {
    const itemNames = o.items.slice(0, 2).map(i => escHtml(i.name)).join(', ') + (o.items.length > 2 ? ', +' + (o.items.length - 2) + ' lagi' : '');
    html += '<div class="held-order-item">' +
      '<div class="held-order-info">' +
        '<div class="held-order-label"><strong>' + escHtml(o.label) + '</strong>' +
          (o.custName && o.custName !== 'Umum' ? ' &nbsp;·&nbsp; 👤 ' + escHtml(o.custName) : '') +
        '</div>' +
        '<div class="held-order-items">🛍️ ' + itemNames + '</div>' +
        '<div class="held-order-meta">' +
          '<span class="held-order-total">' + formatRp(o.total) + '</span>' +
          '<span class="held-order-time">🕐 ' + formatDateTime(o.time) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="held-order-actions">' +
        '<button class="btn btn-primary" style="padding:6px 12px;font-size:13px" onclick="resumeHeldOrder(' + idx + ')">▶️ Lanjut</button>' +
        '<button class="btn btn-danger" style="padding:6px 10px;font-size:13px" onclick="deleteHeldOrder(' + idx + ')">🗑️</button>' +
      '</div>' +
    '</div>';
  });
  html += '</div></div>';
  html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Tutup</button></div>';
  openModal(html);
}

function resumeHeldOrder(idx) {
  if (cart.length > 0) {
    if (!confirm('Keranjang saat ini akan diganti dengan order tertahan ini. Lanjutkan?')) return;
  }
  const order = heldOrders[idx];
  cart = order.items.map(c => ({ ...c }));
  heldOrders.splice(idx, 1);
  saveHeldOrders();
  closeModal();
  updateCartUI();
  setTimeout(() => {
    const discountEl = document.getElementById('cartDiscount');
    if (discountEl) { discountEl.value = order.discount || 0; }
    const notesEl = document.getElementById('cartNotes');
    if (notesEl) { notesEl.value = order.notes || ''; }

  }, 80);
  showToast('Order dilanjutkan! ▶️', 'success');
  updateHeldBadge();
}

function deleteHeldOrder(idx) {
  if (!confirm('Hapus order tertahan ini?')) return;
  heldOrders.splice(idx, 1);
  saveHeldOrders();
  updateHeldBadge();
  if (heldOrders.length === 0) {
    closeModal();
    showToast('Order tertahan dihapus', 'success');
  } else {
    showHeldOrders();
  }
}

