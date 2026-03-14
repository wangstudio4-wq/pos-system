// ============ PRODUCTS ============
async function renderProducts() {
  const main = document.getElementById('mainContent');
  try {
    const [prodData, catData] = await Promise.all([
      apiFetch('/api/products'),
      apiFetch('/api/categories')
    ]);
    const products = prodData.products || prodData || [];
    const categories = catData.categories || catData || [];

    let html = '<div class="page-header"><h1>📦 Kelola Produk</h1><p>Manajemen produk dan stok</p></div>';
    html += '<div class="toolbar"><input class="search-input" placeholder="🔍 Cari produk..." oninput="filterProductTable(this.value)"><div class="spacer"></div><button class="btn btn-primary" onclick="showProductModal()">+ Tambah Produk</button></div>';

    html += '<div class="card"><div class="overflow-x"><table id="productTable"><thead><tr><th>Barcode</th><th>Nama</th><th>Kategori</th><th>Harga Jual</th><th>Modal</th><th>Profit</th><th>Stok</th><th>Satuan</th><th>Min</th><th>Aksi</th></tr></thead><tbody>';
    if (products.length === 0) {
      html += '<tr><td colspan="10">' + emptyHtml('📦', 'Belum ada produk') + '</td></tr>';
    } else {
      products.forEach(p => {
        const catColor = p.category_color || '#6b7280';
        const low = (p.min_stock && p.stock <= p.min_stock);
        const profit = (p.price || 0) - (p.cost_price || 0);
        const profitColor = profit > 0 ? '#415D43' : profit < 0 ? '#dc2626' : '#6b7280';
        html += '<tr data-search="' + escHtml((p.name||'').toLowerCase() + ' ' + (p.barcode||'').toLowerCase()) + '">' +
          '<td><code>' + escHtml(p.barcode || '-') + '</code></td>' +
          '<td><strong>' + escHtml(p.name) + '</strong></td>' +
          '<td>' + (p.category_name ? '<span class="category-badge" style="background:' + escHtml(catColor) + '">' + escHtml(p.category_name) + '</span>' : '-') + '</td>' +
          '<td>' + formatRp(p.price) + '</td>' +
          '<td>' + (p.cost_price ? formatRp(p.cost_price) : '<span style="color:#999">-</span>') + '</td>' +
          '<td><strong style="color:' + profitColor + '">' + (p.cost_price ? formatRp(profit) : '-') + '</strong></td>' +
          '<td>' + (low ? '<span class="low-stock-tag">' + p.stock + '</span>' : p.stock) + '</td>' +
          '<td><span style="font-size:12px">' + escHtml(p.unit || 'pcs') + (p.purchase_unit ? '<br><span style="color:#64748b">beli: ' + escHtml(p.purchase_unit) + ' (1:' + (p.conversion_ratio||1) + ')</span>' : '') + '</span></td>' +
          '<td>' + (p.min_stock||0) + '</td>' +
          '<td><button class="btn btn-sm btn-primary" onclick=\'showProductModal(' + JSON.stringify(p).replace(/'/g, "\\'") + ')\'>✏️</button> ' +
          '<button class="btn btn-sm btn-danger" onclick="deleteProduct(' + p.id + ')">🗑️</button></td></tr>';
      });
    }
    html += '</tbody></table></div></div>';

    main.innerHTML = html;
    // Store categories for modal
    window._productCategories = categories;
  } catch (err) {
    main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat produk: ' + escHtml(err.message) + '</div>';
  }
}

function filterProductTable(val) {
  const rows = document.querySelectorAll('#productTable tbody tr');
  const s = val.toLowerCase();
  rows.forEach(r => {
    const d = r.dataset.search || '';
    r.style.display = d.includes(s) ? '' : 'none';
  });
}

function showProductModal(product) {
  const isEdit = !!product;
  const cats = window._productCategories || [];
  let html = '<div class="modal-header"><h3>' + (isEdit ? '✏️ Edit Produk' : '➕ Tambah Produk') + '</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body"><form id="productForm">';
  html += '<div class="form-group"><label>Barcode</label><input id="pBarcode" value="' + escHtml(product?.barcode || '') + '" placeholder="Barcode (opsional)"></div>';
  html += '<div class="form-group"><label>Nama Produk *</label><input id="pName" value="' + escHtml(product?.name || '') + '" required></div>';
  html += '<div class="form-group"><label>Harga Jual *</label><input id="pPrice" type="text" inputmode="numeric" value="' + (product?.price ? formatDots(product.price) : '') + '" oninput="formatMoneyInput(this)" required></div>';
  html += '<div class="form-group"><label>Harga Modal</label><input id="pCostPrice" type="text" inputmode="numeric" value="' + formatDots(product?.cost_price || 0) + '" oninput="formatMoneyInput(this)" placeholder="Harga beli/modal"></div>';
  html += '<div class="form-group"><label>Stok *</label><input id="pStock" type="number" min="0" value="' + (product?.stock ?? '') + '" required></div>';
  html += '<div class="form-group"><label>Stok Minimum</label><input id="pMinStock" type="number" min="0" value="' + (product?.min_stock || 0) + '"></div>';
  html += '<div class="form-group"><label>📅 Tanggal Kadaluarsa <span style="color:#64748b;font-weight:400;font-size:11px">(opsional)</span></label><input id="pExpireDate" type="date" value="' + (product?.expire_date ? product.expire_date.slice(0,10) : '') + '" style="padding:8px 12px;border:2px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg-card);color:var(--text)"></div>';
  html += '<div style="border-top:1px solid #e2e8f0;margin:12px 0;padding-top:12px"><strong>📏 Satuan</strong></div>';
  html += '<div class="form-row"><div class="form-group" style="flex:1"><label>Satuan Jual</label><select id="pUnit"><option value="pcs"' + ((product?.unit||'pcs')==='pcs'?' selected':'') + '>pcs</option><option value="kg"' + ((product?.unit)==='kg'?' selected':'') + '>kg</option><option value="gram"' + ((product?.unit)==='gram'?' selected':'') + '>gram</option><option value="liter"' + ((product?.unit)==='liter'?' selected':'') + '>liter</option><option value="ml"' + ((product?.unit)==='ml'?' selected':'') + '>ml</option><option value="meter"' + ((product?.unit)==='meter'?' selected':'') + '>meter</option><option value="lembar"' + ((product?.unit)==='lembar'?' selected':'') + '>lembar</option><option value="bungkus"' + ((product?.unit)==='bungkus'?' selected':'') + '>bungkus</option><option value="botol"' + ((product?.unit)==='botol'?' selected':'') + '>botol</option><option value="sachet"' + ((product?.unit)==='sachet'?' selected':'') + '>sachet</option></select></div>';
  html += '<div class="form-group" style="flex:1"><label>Satuan Beli (opsional)</label><select id="pPurchaseUnit"><option value="">-- Sama --</option><option value="karung"' + ((product?.purchase_unit)==='karung'?' selected':'') + '>karung</option><option value="box"' + ((product?.purchase_unit)==='box'?' selected':'') + '>box</option><option value="lusin"' + ((product?.purchase_unit)==='lusin'?' selected':'') + '>lusin</option><option value="dus"' + ((product?.purchase_unit)==='dus'?' selected':'') + '>dus</option><option value="bal"' + ((product?.purchase_unit)==='bal'?' selected':'') + '>bal</option><option value="pack"' + ((product?.purchase_unit)==='pack'?' selected':'') + '>pack</option><option value="roll"' + ((product?.purchase_unit)==='roll'?' selected':'') + '>roll</option><option value="sak"' + ((product?.purchase_unit)==='sak'?' selected':'') + '>sak</option></select></div>';
  html += '<div class="form-group" style="flex:1"><label>Konversi (1 beli = ? jual)</label><input id="pConversionRatio" type="number" min="1" step="0.01" value="' + (product?.conversion_ratio || 1) + '" placeholder="cth: 25"></div></div>';
  html += '<div class="form-group"><label>Kategori</label><select id="pCategory"><option value="">-- Pilih Kategori --</option>';
  cats.forEach(c => {
    html += '<option value="' + c.id + '"' + (product?.category_id === c.id ? ' selected' : '') + '>' + escHtml(c.name) + '</option>';
  });
  html += '</select></div>';
  // Diskon / Promo section
  html += '<div style="border-top:1px solid #e2e8f0;margin:12px 0;padding-top:12px"><strong>🏷️ Diskon / Promo</strong> <span style="color:#64748b;font-size:12px">(opsional)</span></div>';
  html += '<div id="discountRows">';
  if (isEdit && product.id) {
    html += '<div style="text-align:center;padding:8px;color:#64748b;font-size:12px">Memuat diskon...</div>';
  } else {
    html += '<div style="color:#64748b;font-size:12px;padding:4px 0">Simpan produk dulu, lalu edit untuk atur diskon.</div>';
  }
  html += '</div>';
  if (isEdit && product.id) {
    html += '<button type="button" class="btn btn-sm" style="margin-top:6px;font-size:12px;background:#ef4444;color:#fff" onclick="addDiscountRow()">+ Tambah Diskon</button>';
  }
  html += '<div style="border-top:1px solid #e2e8f0;margin:12px 0;padding-top:12px"><strong>🏷️ Harga Grosir</strong> <span style="color:#64748b;font-size:12px">(opsional)</span></div>';
  html += '<div id="tierRows">';
  if (isEdit && product.id) {
    html += '<div style="text-align:center;padding:8px;color:#64748b;font-size:12px">Memuat harga grosir...</div>';
  } else {
    html += '<div style="color:#64748b;font-size:12px;padding:4px 0">Simpan produk dulu, lalu edit untuk atur harga grosir.</div>';
  }
  html += '</div>';
  if (isEdit && product.id) {
    html += '<button type="button" class="btn btn-sm" style="margin-top:6px;font-size:12px" onclick="addTierRow()">+ Tambah Level Harga</button>';
  }
  html += '</form></div>';
  html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveProduct(' + (isEdit ? product.id : 'null') + ')">Simpan</button></div>';
  openModal(html);
  if (isEdit && product.id) { setTimeout(() => { loadTierRows(product.id); loadDiscountRows(product.id); }, 100); }
}

async function saveProduct(id) {
  const payload = {
    barcode: document.getElementById('pBarcode').value || null,
    name: document.getElementById('pName').value,
    price: parseMoneyValue('pPrice'),
    cost_price: parseMoneyValue('pCostPrice'),
    stock: Number(document.getElementById('pStock').value),
    min_stock: Number(document.getElementById('pMinStock').value) || 0,
    category_id: document.getElementById('pCategory').value ? Number(document.getElementById('pCategory').value) : null,
    unit: document.getElementById('pUnit').value || 'pcs',
    purchase_unit: document.getElementById('pPurchaseUnit').value || null,
    conversion_ratio: Number(document.getElementById('pConversionRatio').value) || 1,
    expire_date: document.getElementById('pExpireDate').value || null
  };
  if (!payload.name) { showToast('Nama produk wajib diisi', 'error'); return; }
  try {
    if (id) {
      await apiFetch('/api/products/' + id, { method: 'PUT', body: JSON.stringify(payload) });
      await saveTiers(id);
      await saveDiscounts(id);
      showToast('Produk berhasil diperbarui');
    } else {
      const newProd = await apiFetch('/api/products', { method: 'POST', body: JSON.stringify(payload) });
      if (newProd.product && newProd.product.id) { await saveTiers(newProd.product.id); await saveDiscounts(newProd.product.id); }
      showToast('Produk berhasil ditambahkan');
    }
    closeModal();
    renderProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Tier price management in product modal
function loadTierRows(productId) {
  apiFetch('/api/products/' + productId + '/price-tiers').then(tiers => {
    const container = document.getElementById('tierRows');
    if (!container) return;
    container.innerHTML = '';
    if (tiers.length === 0) {
      container.innerHTML = '<div style="color:#64748b;font-size:12px;padding:4px 0">Belum ada harga grosir</div>';
    } else {
      tiers.forEach(t => {
        addTierRow(t.min_qty, t.price);
      });
    }
  }).catch(() => {});
}

function addTierRow(minQty, price) {
  const container = document.getElementById('tierRows');
  if (!container) return;
  // Remove placeholder text if exists
  const placeholder = container.querySelector('div[style*="color:#64748b"]');
  if (placeholder) placeholder.remove();
  const row = document.createElement('div');
  row.className = 'form-row';
  row.style.cssText = 'margin-bottom:4px;align-items:center';
  row.innerHTML = '<div class="form-group" style="flex:1;margin:0"><input type="number" class="tier-min-qty" min="2" value="' + (minQty || '') + '" placeholder="Min qty" style="padding:6px 8px"></div>' +
    '<span style="padding:0 4px;color:#64748b">→</span>' +
    '<div class="form-group" style="flex:1;margin:0"><input type="text" inputmode="numeric" class="tier-price" value="' + (price ? formatDots(price) : '') + '" placeholder="Harga" oninput="formatMoneyInput(this)" style="padding:6px 8px"></div>' +
    '<button type="button" onclick="this.parentElement.remove()" style="background:none;border:none;color:#ef4444;font-size:16px;cursor:pointer;padding:4px">✕</button>';
  container.appendChild(row);
}

async function saveTiers(productId) {
  const rows = document.querySelectorAll('#tierRows .form-row');
  const tiers = [];
  rows.forEach(row => {
    const minQty = Number(row.querySelector('.tier-min-qty').value);
    const priceInput = row.querySelector('.tier-price');
    const price = Number(priceInput.value.replace(/\./g, '').replace(/,/g, '')) || 0;
    if (minQty > 0 && price > 0) tiers.push({ min_qty: minQty, price });
  });
  try {
    await apiFetch('/api/products/' + productId + '/price-tiers', { method: 'POST', body: JSON.stringify({ tiers }) });
  } catch (e) { console.log('Save tiers error:', e); }
}

function loadDiscountRows(productId) {
  apiFetch('/api/product-discounts').then(discounts => {
    const rows = discounts.filter(d => d.product_id === productId);
    const container = document.getElementById('discountRows');
    if (!container) return;
    container.innerHTML = '';
    if (rows.length === 0) {
      container.innerHTML = '<div style="color:#64748b;font-size:12px;padding:4px 0">Belum ada diskon aktif</div>';
    } else {
      rows.forEach(d => addDiscountRow(d));
    }
  }).catch(() => {});
}

function addDiscountRow(disc) {
  const container = document.getElementById('discountRows');
  if (!container) return;
  const placeholder = container.querySelector('div[style*="color:#64748b"]');
  if (placeholder) placeholder.remove();
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;align-items:center;flex-wrap:wrap;background:#fef2f2;padding:8px;border-radius:8px;border:1px solid #fecaca';
  row.dataset.discountId = disc ? disc.id : '';
  row.innerHTML = 
    '<div style="flex:1;min-width:100px"><input type="text" class="disc-name" value="' + escHtml(disc?.name || '') + '" placeholder="Nama promo" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:6px;font-size:12px"></div>' +
    '<div style="width:80px"><select class="disc-type" style="width:100%;padding:4px;border:1px solid #d1d5db;border-radius:6px;font-size:12px">' +
      '<option value="percentage"' + ((!disc || disc.discount_type === 'percentage') ? ' selected' : '') + '>%</option>' +
      '<option value="fixed"' + (disc?.discount_type === 'fixed' ? ' selected' : '') + '>Rp</option>' +
    '</select></div>' +
    '<div style="width:70px"><input type="number" class="disc-value" min="0" step="0.01" value="' + (disc?.discount_value || '') + '" placeholder="Nilai" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:6px;font-size:12px"></div>' +
    '<div style="width:60px"><input type="number" class="disc-min-qty" min="1" value="' + (disc?.min_qty || 1) + '" placeholder="Min" title="Min qty" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:6px;font-size:12px"></div>' +
    '<div style="width:110px"><input type="date" class="disc-start" value="' + (disc?.start_date ? disc.start_date.substring(0,10) : '') + '" title="Mulai" style="width:100%;padding:4px;border:1px solid #d1d5db;border-radius:6px;font-size:11px"></div>' +
    '<div style="width:110px"><input type="date" class="disc-end" value="' + (disc?.end_date ? disc.end_date.substring(0,10) : '') + '" title="Berakhir" style="width:100%;padding:4px;border:1px solid #d1d5db;border-radius:6px;font-size:11px"></div>' +
    '<button type="button" onclick="this.parentElement.remove()" style="background:none;border:none;color:#ef4444;font-size:16px;cursor:pointer;padding:2px" title="Hapus">✕</button>';
  container.appendChild(row);
}

async function saveDiscounts(productId) {
  const container = document.getElementById('discountRows');
  if (!container) return;
  // First, delete all existing discounts for this product
  try {
    const existing = await apiFetch('/api/product-discounts');
    const toDelete = existing.filter(d => d.product_id === productId);
    for (const d of toDelete) {
      await apiFetch('/api/product-discounts/' + d.id, { method: 'DELETE' });
    }
  } catch (e) {}
  // Then create new ones
  const rows = container.querySelectorAll('div[style*="flex"]');
  for (const row of rows) {
    const name = row.querySelector('.disc-name')?.value;
    const type = row.querySelector('.disc-type')?.value;
    const value = Number(row.querySelector('.disc-value')?.value) || 0;
    const minQty = Number(row.querySelector('.disc-min-qty')?.value) || 1;
    const startDate = row.querySelector('.disc-start')?.value || null;
    const endDate = row.querySelector('.disc-end')?.value || null;
    if (name && value > 0) {
      try {
        await apiFetch('/api/product-discounts', { method: 'POST', body: JSON.stringify({
          product_id: productId, name, discount_type: type, discount_value: value,
          min_qty: minQty, start_date: startDate, end_date: endDate
        })});
      } catch (e) {}
    }
  }
}

async function deleteProduct(id) {
  if (!confirm('Hapus produk ini?')) return;
  try {
    await apiFetch('/api/products/' + id, { method: 'DELETE' });
    showToast('Produk dihapus');
    renderProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

