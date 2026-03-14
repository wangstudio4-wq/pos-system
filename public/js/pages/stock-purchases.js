// ============ STOK MASUK (PEMBELIAN) ============
async function renderStockIn() {
  const main = document.getElementById('mainContent');
  try {
    const [purchases, suppliers] = await Promise.all([
      apiFetch('/api/stock-purchases'),
      apiFetch('/api/suppliers')
    ]);
    window._suppliers = suppliers;

    let html = '<div class="page-header"><h1>📥 Stok Masuk</h1><p>Catat pembelian stok dari supplier</p></div>';
    html += '<div class="toolbar"><div class="spacer"></div><button class="btn btn-primary" onclick="showStockInModal()">+ Catat Pembelian</button></div>';

    html += '<div class="card"><div class="overflow-x"><table id="stockInTable"><thead><tr><th>#</th><th>Tanggal</th><th>Invoice</th><th>Supplier</th><th>Total</th><th>Dicatat Oleh</th><th>Aksi</th></tr></thead><tbody>';
    if (purchases.length === 0) {
      html += '<tr><td colspan="7">' + emptyHtml('📥', 'Belum ada pembelian stok') + '</td></tr>';
    } else {
      purchases.forEach(p => {
        html += '<tr>' +
          '<td>' + p.id + '</td>' +
          '<td>' + formatDateTime(p.created_at) + '</td>' +
          '<td><code>' + escHtml(p.invoice_number || '-') + '</code></td>' +
          '<td>' + escHtml(p.supplier_name || '-') + '</td>' +
          '<td><strong>' + formatRp(p.total_amount) + '</strong></td>' +
          '<td>' + escHtml(p.user_name || '-') + '</td>' +
          '<td><button class="btn btn-sm btn-primary" onclick="showStockInDetail(' + p.id + ')">👁️</button> ' +
          '<button class="btn btn-sm btn-danger" onclick="deleteStockIn(' + p.id + ')">🗑️</button></td></tr>';
      });
    }
    html += '</tbody></table></div></div>';
    main.innerHTML = html;
  } catch (err) {
    main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat data: ' + escHtml(err.message) + '</div>';
  }
}

async function showStockInDetail(id) {
  try {
    const data = await apiFetch('/api/stock-purchases/' + id);
    const p = data.purchase;
    const items = data.items || [];
    let html = '<div class="modal-header"><h3>📥 Detail Pembelian #' + p.id + '</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
    html += '<div class="modal-body">';
    html += '<p><strong>Invoice:</strong> ' + escHtml(p.invoice_number || '-') + '</p>';
    html += '<p><strong>Supplier:</strong> ' + escHtml(p.supplier_name || '-') + '</p>';
    html += '<p><strong>Tanggal:</strong> ' + formatDateTime(p.created_at) + '</p>';
    html += '<p><strong>Dicatat oleh:</strong> ' + escHtml(p.user_name || '-') + '</p>';
    if (p.notes) html += '<p><strong>Catatan:</strong> ' + escHtml(p.notes) + '</p>';
    html += '<div class="overflow-x" style="margin-top:12px"><table><thead><tr><th>Produk</th><th>Qty</th><th>Harga Beli</th><th>Subtotal</th></tr></thead><tbody>';
    items.forEach(i => {
      html += '<tr><td>' + escHtml(i.product_name) + '</td><td>' + i.qty + '</td><td>' + formatRp(i.cost_price) + '</td><td>' + formatRp(i.subtotal) + '</td></tr>';
    });
    html += '</tbody><tfoot><tr><td colspan="3" style="font-weight:700;text-align:right">Total</td><td style="font-weight:700">' + formatRp(p.total_amount) + '</td></tr></tfoot></table></div>';
    html += '</div>';
    openModal(html);
  } catch (err) { showToast(err.message, 'error'); }
}

let stockInItems = [];

async function showStockInModal() {
  stockInItems = [];
  const products = await apiFetch('/api/products');
  const prodList = Array.isArray(products) ? products : (products.products || []);
  window._stockInProducts = prodList;
  const suppliers = window._suppliers || [];

  let html = '<div class="modal-header"><h3>📥 Catat Pembelian Stok</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body">';
  html += '<div class="form-group"><label>No. Invoice</label><input id="siInvoice" placeholder="Opsional"></div>';
  html += '<div class="form-group"><label>Supplier</label><select id="siSupplier"><option value="">-- Pilih Supplier --</option>';
  suppliers.forEach(s => { html += '<option value="' + s.id + '" data-name="' + escHtml(s.name) + '">' + escHtml(s.name) + '</option>'; });
  html += '</select></div>';
  html += '<div class="form-group"><label>Catatan</label><textarea id="siNotes" rows="2"></textarea></div>';
  html += '<hr style="margin:12px 0">';
  html += '<div style="display:flex;gap:8px;margin-bottom:8px"><select id="siProductSelect" style="flex:1"><option value="">-- Pilih Produk --</option>';
  prodList.forEach(p => { html += '<option value="' + p.id + '">' + escHtml(p.name) + ' (stok: ' + p.stock + ')</option>'; });
  html += '</select><input id="siQty" type="number" min="1" value="1" style="width:70px" placeholder="Qty">';
  html += '<input id="siCost" type="text" inputmode="numeric" style="width:120px" placeholder="Harga beli" oninput="formatMoneyInput(this)">';
  html += '<button class="btn btn-sm btn-primary" onclick="addStockInItem()">+</button></div>';
  html += '<div id="siItemsTable"></div>';
  html += '</div>';
  html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveStockIn()">💾 Simpan Pembelian</button></div>';
  openModal(html);
  renderStockInItems();
}

function addStockInItem() {
  const sel = document.getElementById('siProductSelect');
  const productId = Number(sel.value);
  if (!productId) { showToast('Pilih produk dulu', 'error'); return; }
  const product = (window._stockInProducts || []).find(p => p.id === productId);
  if (!product) return;
  const qty = Number(document.getElementById('siQty').value) || 1;
  const costPrice = parseMoneyValue('siCost') || product.cost_price || 0;

  // Check if already added
  const existing = stockInItems.find(i => i.product_id === productId);
  if (existing) {
    existing.qty += qty;
    existing.cost_price = costPrice;
  } else {
    stockInItems.push({ product_id: productId, product_name: product.name, qty, cost_price: costPrice });
  }
  document.getElementById('siQty').value = 1;
  document.getElementById('siCost').value = '';
  renderStockInItems();
}

function removeStockInItem(idx) {
  stockInItems.splice(idx, 1);
  renderStockInItems();
}

function renderStockInItems() {
  const container = document.getElementById('siItemsTable');
  if (!container) return;
  if (stockInItems.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:16px">Belum ada item</div>';
    return;
  }
  let html = '<table><thead><tr><th>Produk</th><th>Qty</th><th>Harga Beli</th><th>Subtotal</th><th></th></tr></thead><tbody>';
  let total = 0;
  stockInItems.forEach((item, i) => {
    const sub = item.qty * item.cost_price;
    total += sub;
    html += '<tr><td>' + escHtml(item.product_name) + '</td><td>' + item.qty + '</td><td>' + formatRp(item.cost_price) + '</td><td>' + formatRp(sub) + '</td><td><button class="btn btn-sm btn-danger" onclick="removeStockInItem(' + i + ')">✕</button></td></tr>';
  });
  html += '</tbody><tfoot><tr><td colspan="3" style="font-weight:700;text-align:right">Total</td><td colspan="2" style="font-weight:700">' + formatRp(total) + '</td></tr></tfoot></table>';
  container.innerHTML = html;
}

async function saveStockIn() {
  if (stockInItems.length === 0) { showToast('Tambahkan item dulu', 'error'); return; }
  const supplierSel = document.getElementById('siSupplier');
  const supplierId = supplierSel.value ? Number(supplierSel.value) : null;
  const supplierName = supplierSel.selectedOptions[0]?.dataset?.name || null;

  const payload = {
    invoice_number: document.getElementById('siInvoice').value || null,
    supplier_id: supplierId,
    supplier_name: supplierName,
    notes: document.getElementById('siNotes').value || null,
    items: stockInItems
  };
  try {
    await apiFetch('/api/stock-purchases', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Pembelian stok berhasil dicatat!');
    closeModal();
    renderStockIn();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteStockIn(id) {
  if (!confirm('Hapus pembelian ini? Stok akan dikurangi kembali.')) return;
  try {
    await apiFetch('/api/stock-purchases/' + id, { method: 'DELETE' });
    showToast('Pembelian dihapus');
    renderStockIn();
  } catch (err) { showToast(err.message, 'error'); }
}

