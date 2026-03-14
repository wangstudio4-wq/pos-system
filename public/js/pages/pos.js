// ============ POS ============
let posProducts = [];
let posCategories = [];
let cart = [];
let selectedCategory = null;
let selectedPayMethod = 'Cash';
let selectedPOSMember = null; // { id, name, member_code, points, level_name, level_icon, discount_percent }
let memberVIPPrices = {}; // { product_id: { special_price, description, is_customer_specific } }
let posSearchTerm = '';
let heldOrders = JSON.parse(localStorage.getItem('kasirpro_held_orders') || '[]');
let activeShift = null; // Track current active shift

async function renderPOS() {
  const main = document.getElementById('mainContent');
  // Check shift for kasir
  if (currentUser.role === 'kasir' && !activeShift) {
    main.innerHTML = '<div class="card" style="text-align:center;padding:40px 20px;">' +
      '<div style="font-size:48px;margin-bottom:16px;">⏰</div>' +
      '<h2 style="margin-bottom:8px;">Shift Belum Dibuka</h2>' +
      '<p style="color:var(--text-secondary);margin-bottom:20px;">Anda harus membuka shift terlebih dahulu sebelum dapat melakukan transaksi.</p>' +
      '<button class="btn btn-success" onclick="navigateTo(\'shifts\')" style="font-size:16px;padding:12px 32px;">🟢 Buka Shift Sekarang</button>' +
      '</div>';
    return;
  }
  main.innerHTML = loadingHtml();
  try {
    const [prodData, catData, settingsData, tiersData] = await Promise.all([
      apiFetch('/api/products'),
      apiFetch('/api/categories'),
      apiFetch('/api/settings').catch(() => ({})),
      apiFetch('/api/price-tiers').catch(() => [])
    ]);
    window._priceTiers = tiersData || [];
    const discountData = await apiFetch('/api/product-discounts/active');
    window._activeDiscounts = discountData;
    appSettings = settingsData || {};
    posProducts = prodData.products || prodData || [];
    posCategories = catData.categories || catData || [];
    if (Array.isArray(posProducts) === false) posProducts = [];
    if (Array.isArray(posCategories) === false) posCategories = [];
    cart = [];
    selectedCategory = null;
    selectedPayMethod = 'Cash';
    posSearchTerm = '';
    renderPOSPage();
    cachePOSData();
  } catch (err) {
    main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat data: ' + escHtml(err.message) + '</div>';
  }
}

function renderPOSPage() {
  const main = document.getElementById('mainContent');
  let html = '<div class="page-header"><h1>🛒 Kasir</h1></div>';
  html += '<div class="pos-layout">';

  // Left: Products
  html += '<div class="pos-products">';
  html += '<div class="barcode-input-wrap"><input type="text" id="posSearch" placeholder="🔍 Scan barcode / cari produk..." value="' + escHtml(posSearchTerm) + '" onkeyup="handlePosSearch(event)" autocomplete="off" autofocus><button class="scan-btn" onclick="openCameraScanner()" title="Scan pakai kamera">📷</button></div>';

  // Category pills
  html += '<div class="category-pills">';
  html += '<div class="category-pill' + (selectedCategory === null ? ' active' : '') + '" onclick="filterCategory(null)">Semua</div>';
  posCategories.forEach(c => {
    html += '<div class="category-pill' + (selectedCategory === c.id ? ' active' : '') + '" onclick="filterCategory(' + c.id + ')" style="' + (selectedCategory === c.id ? 'background:' + (c.color||'var(--primary)') + ';color:#fff;border-color:' + (c.color||'var(--primary)') : '') + '">' + escHtml(c.name) + '</div>';
  });
  html += '</div>';

  // Product grid
  html += '<div class="product-grid" id="posProductGrid">';
  html += renderProductGrid();
  html += '</div></div>';

  // Right: Cart
  html += renderCartPanel();
  html += '</div>';

  main.innerHTML = html;
  // Auto-focus barcode input for physical scanner
  refocusBarcodeInput();
}

function renderProductGrid() {
  let filtered = posProducts;
  if (selectedCategory !== null) {
    filtered = filtered.filter(p => p.category_id === selectedCategory);
  }
  if (posSearchTerm) {
    const s = posSearchTerm.toLowerCase();
    filtered = filtered.filter(p => (p.name && p.name.toLowerCase().includes(s)) || (p.barcode && p.barcode.toLowerCase().includes(s)));
  }
  if (filtered.length === 0) {
    return emptyHtml('📦', 'Tidak ada produk ditemukan');
  }
  return filtered.map(p => {
    const oos = (p.stock !== undefined && p.stock !== null && p.stock <= 0);
    const catColor = p.category_color || '#6b7280';
    const lowStk = (!oos && p.min_stock && p.stock <= p.min_stock);
    const hasTiers = (window._priceTiers || []).some(t => t.product_id === p.id);
    const hasDiscount = (window._activeDiscounts || []).some(d => d.product_id === p.id);
    return '<div class="product-card' + (oos ? ' out-of-stock' : '') + '" style="' + (lowStk ? 'border: 2px solid #f59e0b;' : '') + 'position:relative" onclick="addToCart(' + p.id + ')">' +
      (function(){ const hasVIP = selectedPOSMember && memberVIPPrices[p.id]; if (hasVIP) return '<span style="position:absolute;top:4px;left:4px;background:#7c3aed;color:#fff;font-size:9px;padding:1px 5px;border-radius:8px">👑VIP</span>'; if (hasDiscount) return '<span style="position:absolute;top:4px;left:4px;background:#ef4444;color:#fff;font-size:9px;padding:1px 5px;border-radius:8px">🏷️PROMO</span>'; if (hasTiers) return '<span style="position:absolute;top:4px;left:4px;background:#8b5cf6;color:#fff;font-size:9px;padding:1px 5px;border-radius:8px">GROSIR</span>'; return ''; }()) +
      (lowStk ? '<span class="stock-warning-badge" title="Stok menipis!">⚠️</span>' : '') +
      '<div class="p-name">' + escHtml(p.name) + '</div>' +
      (p.barcode ? '<div class="p-barcode">' + escHtml(p.barcode) + '</div>' : '') +
      (function() {
        const vipP = selectedPOSMember && memberVIPPrices[p.id];
        if (vipP) {
          return '<div class="p-price"><span style="text-decoration:line-through;color:#94a3b8;font-size:11px">' + formatRp(p.price) + '</span> <span style="color:#7c3aed">' + formatRp(vipP.special_price) + '</span><span style="font-size:10px;color:#64748b">/' + escHtml(p.unit || 'pcs') + '</span></div>';
        }
        const disc = (window._activeDiscounts || []).find(d => d.product_id === p.id && d.min_qty <= 1);
        if (disc) {
          const discPrice = disc.discount_type === 'percentage' ? Math.round(p.price * (1 - disc.discount_value/100)) : Math.max(p.price - disc.discount_value, 0);
          return '<div class="p-price"><span style="text-decoration:line-through;color:#94a3b8;font-size:11px">' + formatRp(p.price) + '</span> ' + formatRp(discPrice) + '<span style="font-size:10px;color:#64748b">/' + escHtml(p.unit || 'pcs') + '</span></div>';
        }
        return '<div class="p-price">' + formatRp(p.price) + '<span style="font-size:10px;color:#64748b">/' + escHtml(p.unit || 'pcs') + '</span></div>';
      }()) +
      '<div class="p-meta">' +
        '<span class="p-stock"' + (lowStk ? ' style="color:#f59e0b;font-weight:700"' : '') + '>' + (oos ? '❌ Habis' : (lowStk ? '⚠️ ' + p.stock + ' ' + escHtml(p.unit||'pcs') : '📦 ' + p.stock + ' ' + escHtml(p.unit||'pcs'))) + '</span>' +
        (p.category_name ? '<span class="category-badge" style="background:' + escHtml(catColor) + '">' + escHtml(p.category_name) + '</span>' : '') +
      '</div></div>';
  }).join('');
}

// Beep sound for successful scan
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 1200; osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch(e) {}
}

function flashScanSuccess() {
  const inp = document.getElementById('posSearch');
  if (inp) { inp.classList.add('scan-success-flash'); setTimeout(() => inp.classList.remove('scan-success-flash'), 600); }
}

function refocusBarcodeInput() {
  setTimeout(() => { const inp = document.getElementById('posSearch'); if (inp) inp.focus(); }, 100);
}

async function handleBarcodeHit(code) {
  // 1. Try local match first
  const found = posProducts.find(p => p.barcode && p.barcode.trim() === code.trim());
  if (found) {
    addToCart(found.id);
    playBeep(); flashScanSuccess();
    return true;
  }
  // 2. Fallback: API lookup
  try {
    const data = await apiFetch('/api/products/barcode/' + encodeURIComponent(code));
    const p = data.product || data;
    if (p && p.id) {
      if (!posProducts.find(x => x.id === p.id)) posProducts.push(p);
      addToCart(p.id);
      playBeep(); flashScanSuccess();
      return true;
    }
  } catch(e) {}
  return false;
}

let scanBuffer = '';
let scanTimeout = null;

function handlePosSearch(e) {
  posSearchTerm = e.target.value;

  if (e.key === 'Enter' && posSearchTerm.trim()) {
    e.preventDefault();
    const code = posSearchTerm.trim();
    // Clear immediately for next scan
    e.target.value = '';
    posSearchTerm = '';
    document.getElementById('posProductGrid').innerHTML = renderProductGrid();
    
    handleBarcodeHit(code).then(found => {
      if (!found) {
        // Not a barcode - restore as search term
        posSearchTerm = code;
        const inp = document.getElementById('posSearch');
        if (inp) inp.value = code;
        document.getElementById('posProductGrid').innerHTML = renderProductGrid();
      }
      refocusBarcodeInput();
    });
    return;
  }
  document.getElementById('posProductGrid').innerHTML = renderProductGrid();
}

// Camera scanner using html5-qrcode
let html5QrScanner = null;

var scannerBusy = false;

function openCameraScanner() {
  scannerBusy = false;
  const modal = document.createElement('div');
  modal.id = 'barcodeScannerModal';
  modal.className = 'scanner-overlay';
  modal.onclick = function(e) { if (e.target === modal) closeCameraScanner(); };
  modal.innerHTML = '<div class="scanner-box">' +
    '<div class="scanner-header"><h3>📷 Scan Barcode</h3><button class="close-scanner" onclick="closeCameraScanner()">✕</button></div>' +
    '<div id="qr-reader"></div>' +
    '<p style="text-align:center;margin-top:10px;font-size:13px;color:#666">Arahkan kamera ke barcode produk</p>' +
    '<button class="close-btn-bottom" onclick="closeCameraScanner()">✖ Tutup Kamera</button>' +
    '</div>';
  document.body.appendChild(modal);
  // Force display
  setTimeout(() => { modal.style.display = 'flex'; }, 10);

  if (typeof Html5Qrcode !== 'undefined') {
    html5QrScanner = new Html5Qrcode('qr-reader');
    html5QrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 280, height: 150 } },
      (decodedText) => {
        if (scannerBusy) return; // prevent double scan
        scannerBusy = true;
        // Stop scanner first, then close modal & process
        const scanner = html5QrScanner;
        html5QrScanner = null;
        (scanner ? scanner.stop() : Promise.resolve()).catch(() => {}).finally(async () => {
          forceRemoveModal();
          const found = await handleBarcodeHit(decodedText);
          if (!found) showToast('Produk dengan barcode ' + decodedText + ' tidak ditemukan', 'warning');
          refocusBarcodeInput();
        });
      },
      () => {} // ignore errors
    ).catch(err => {
      const reader = document.getElementById('qr-reader');
      if (reader) reader.innerHTML = '<p style="text-align:center;padding:20px;color:#ef4444">Kamera tidak tersedia.<br>Pastikan izin kamera diaktifkan.</p>';
    });
  } else {
    document.getElementById('qr-reader').innerHTML = '<p style="text-align:center;padding:20px;color:#ef4444">Library scanner tidak dimuat.</p>';
  }
}

function forceRemoveModal() {
  const modal = document.getElementById('barcodeScannerModal');
  if (modal) modal.remove();
  // Cleanup any leftover video streams
  document.querySelectorAll('video').forEach(v => {
    if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); }
  });
}

function closeCameraScanner() {
  const scanner = html5QrScanner;
  html5QrScanner = null;
  if (scanner) {
    scanner.stop().catch(() => {}).finally(() => { forceRemoveModal(); });
  } else {
    forceRemoveModal();
  }
  refocusBarcodeInput();
}

function filterCategory(catId) {
  selectedCategory = catId;
  renderPOSPage();
}

function applyVIPPricesToCart() {
  cart.forEach((c, i) => {
    const vip = memberVIPPrices[c.id];
    if (vip) {
      c.price = Number(vip.special_price);
      c.isVIPPrice = true;
      c.vipDesc = vip.description || '';
    } else {
      const p = posProducts.find(x => x.id === c.id);
      if (p) c.price = Number(p.price);
      c.isVIPPrice = false;
    }
    applyTieredPrice(i);
    applyProductDiscount(i);
  });
}

function addToCart(productId) {
  const p = posProducts.find(x => x.id === productId);
  if (!p) return;
  if (p.stock !== undefined && p.stock !== null && p.stock <= 0) {
    showToast('Stok produk habis', 'warning');
    return;
  }
  const existing = cart.find(c => c.id === productId);
  if (existing) {
    if (p.stock !== undefined && p.stock !== null && existing.qty >= p.stock) {
      showToast('Stok tidak mencukupi', 'warning');
      return;
    }
    existing.qty++;
    applyTieredPrice(cart.indexOf(existing));
    applyProductDiscount(cart.indexOf(existing));
  } else {
    const vip = (selectedPOSMember && memberVIPPrices[p.id]) ? memberVIPPrices[p.id] : null;
    const itemPrice = vip ? Number(vip.special_price) : Number(p.price);
    cart.push({ id: p.id, name: p.name, price: itemPrice, cost_price: Number(p.cost_price || 0), qty: 1, discount: 0, autoDiscount: 0, unit: p.unit || 'pcs', isVIPPrice: !!vip, vipDesc: vip ? (vip.description || '') : '' });
    applyProductDiscount(cart.length - 1);
  }
  updateCartUI();
}

function removeFromCart(idx) {
  cart.splice(idx, 1);
  updateCartUI();
}

function changeQty(idx, delta) {
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) { cart.splice(idx, 1); }
  else {
    const p = posProducts.find(x => x.id === cart[idx].id);
    if (p && p.stock !== undefined && p.stock !== null && cart[idx].qty > p.stock) {
      cart[idx].qty = p.stock;
      showToast('Stok tidak mencukupi', 'warning');
    }
    // Auto-apply tiered pricing & discounts
    applyTieredPrice(idx);
    applyProductDiscount(idx);
  }
  updateCartUI();
}

function applyTieredPrice(idx) {
  const item = cart[idx];
  if (!item) return;
  const tiers = (window._priceTiers || []).filter(t => t.product_id === item.id).sort((a,b) => b.min_qty - a.min_qty);
  if (tiers.length === 0) return;
  const p = posProducts.find(x => x.id === item.id);
  const basePrice = p ? Number(p.price) : item.price;
  let appliedPrice = basePrice;
  for (const t of tiers) {
    if (item.qty >= t.min_qty) { appliedPrice = Number(t.price); break; }
  }
  if (appliedPrice !== item.price) {
    item.price = appliedPrice;
    if (appliedPrice < basePrice) showToast('Harga grosir diterapkan! ' + formatRp(appliedPrice), 'info');
  }
}

function applyProductDiscount(idx) {
  const item = cart[idx];
  if (!item) return;
  const discounts = (window._activeDiscounts || []).filter(d => d.product_id === item.id).sort((a,b) => b.min_qty - a.min_qty);
  if (discounts.length === 0) { item.autoDiscount = 0; return; }
  // Find the best matching discount for current qty
  let bestDisc = null;
  for (const d of discounts) {
    if (item.qty >= d.min_qty) { bestDisc = d; break; }
  }
  if (!bestDisc) { item.autoDiscount = 0; return; }
  const p = posProducts.find(x => x.id === item.id);
  const basePrice = p ? Number(p.price) : item.price;
  const itemSubtotal = item.price * item.qty;
  let discAmount = 0;
  if (bestDisc.discount_type === 'percentage') {
    discAmount = Math.round(itemSubtotal * bestDisc.discount_value / 100);
  } else {
    discAmount = Math.round(bestDisc.discount_value * item.qty);
  }
  item.autoDiscount = discAmount;
  item.autoDiscountName = bestDisc.name;
  if (discAmount > 0 && item._lastDiscNotify !== item.qty) {
    showToast('🏷️ ' + bestDisc.name + ': -' + formatRp(discAmount), 'info');
    item._lastDiscNotify = item.qty;
  }
}

function updateItemDiscount(idx, val) {
  cart[idx].discount = Number(val) || 0;
  updateCartUI();
}

function updateCartUI() {
  const cartEl = document.getElementById('cartPanel');
  if (cartEl) cartEl.outerHTML = renderCartPanel();
}

function calcTaxService(subtotal, totalDiscount) {
  const memberDiscAmt = (selectedPOSMember && selectedPOSMember.discount_percent > 0) ? Math.round(subtotal * selectedPOSMember.discount_percent / 100) : 0;
  const afterDiscount = Math.max(subtotal - totalDiscount - memberDiscAmt, 0);
  let taxAmt = 0, serviceAmt = 0;
  if (appSettings.tax_enabled) taxAmt = Math.round(afterDiscount * (appSettings.tax_rate || 0) / 100);
  if (appSettings.service_charge_enabled) serviceAmt = Math.round(afterDiscount * (appSettings.service_charge_rate || 0) / 100);
  return { afterDiscount, taxAmt, serviceAmt, grandTotal: afterDiscount + taxAmt + serviceAmt, memberDiscAmt };
}

function renderCartPanel() {
  const subtotal = cart.reduce((s, c) => s + (c.price * c.qty - c.discount - (c.autoDiscount || 0)), 0);
  const discountEl = document.getElementById('cartDiscount');
  const totalDiscount = discountEl ? (Number(discountEl.value)||0) : 0;
  const { afterDiscount, taxAmt, serviceAmt, grandTotal } = calcTaxService(subtotal, totalDiscount);

  let html = '<div class="pos-cart" id="cartPanel">';
  html += '<div class="cart-header">' +
    '<h3>🛒 Keranjang (' + cart.length + ' item)</h3>' +
    '<button class="btn-held-list" onclick="showHeldOrders()" title="Lihat order tertahan">' +
      '⏸️ Tahan' +
      (heldOrders.length > 0 ? ' <span class="held-badge" id="heldBadge">' + heldOrders.length + '</span>' : '<span class="held-badge" id="heldBadge" style="display:none">0</span>') +
    '</button>' +
  '</div>';

  // Cart items
  html += '<div class="cart-items">';
  if (cart.length === 0) {
    html += '<div class="cart-empty"><div class="empty-icon">🛒</div><p>Keranjang kosong</p><p style="font-size:12px;margin-top:4px">Klik produk untuk menambahkan</p></div>';
  } else {
    cart.forEach((c, i) => {
      const itemTotal = c.price * c.qty - c.discount - (c.autoDiscount || 0);
      html += '<div class="cart-item">' +
        '<div class="cart-item-info">' +
          '<div class="cart-item-name">' + escHtml(c.name) + '</div>' +
          '<div class="cart-item-price">' + formatRp(c.price) + '/' + escHtml(c.unit || 'pcs') + ' x ' + c.qty + (function(){ const p = posProducts.find(x=>x.id===c.id); const base = p ? Number(p.price) : c.price; if (c.isVIPPrice) return ' <span style="color:#7c3aed;font-size:10px">👑VIP</span>'; return c.price < base ? ' <span style="color:#8b5cf6;font-size:10px">🏷️GROSIR</span>' : ''; }()) + '</div>' +
          ((c.autoDiscount > 0) ? '<div style="color:#ef4444;font-size:11px;margin-top:2px">🏷️ ' + escHtml(c.autoDiscountName || 'Promo') + ': -' + formatRp(c.autoDiscount) + '</div>' : '') +
          '<div class="cart-item-disc">Disc: <input type="number" min="0" value="' + c.discount + '" onchange="updateItemDiscount(' + i + ',this.value)" placeholder="0"></div>' +
        '</div>' +
        '<div class="qty-control">' +
          '<button onclick="changeQty(' + i + ',-1)">−</button>' +
          '<span>' + c.qty + '</span>' +
          '<button onclick="changeQty(' + i + ',1)">+</button>' +
        '</div>' +
        '<div class="cart-item-total">' + formatRp(itemTotal) + '</div>' +
        '<button class="remove-btn" onclick="removeFromCart(' + i + ')">✕</button>' +
      '</div>';
    });
  }
  html += '</div>';

  // Summary (member + totals + payment all in one scrollable area)
  html += '<div class="cart-summary">';
  // Member selection
  html += '<div style="background:linear-gradient(135deg,#8b5cf622,#8b5cf608);border:1px solid #c4b5fd;border-radius:10px;padding:10px;margin-bottom:10px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:12px;font-weight:600;color:#7c3aed">👥 Member</span>';
  if (selectedPOSMember) html += '<button onclick="clearPOSMember()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:11px">✕ Hapus</button>';
  html += '</div>';
  if (selectedPOSMember) {
    html += '<div style="display:flex;justify-content:space-between;align-items:center">';
    html += '<div><strong>' + escHtml(selectedPOSMember.name) + '</strong> <span style="font-size:11px;color:#64748b">' + escHtml(selectedPOSMember.member_code || '') + '</span>';
    html += '<div style="font-size:11px">' + (selectedPOSMember.level_icon || '🥉') + ' ' + escHtml(selectedPOSMember.level_name || 'Bronze');
    if (selectedPOSMember.discount_percent > 0) html += ' — <span style="color:#16a34a">Disc ' + selectedPOSMember.discount_percent + '%</span>';
    const vipCount = Object.keys(memberVIPPrices).length;
    if (vipCount > 0) html += ' <span style="color:#7c3aed">👑' + vipCount + ' VIP</span>';
    html += '</div></div>';
    html += '<div style="color:#8b5cf6;font-weight:700">🪙 ' + (selectedPOSMember.points || 0) + '</div>';
    html += '</div>';
  } else {
    html += '<input type="text" id="posMemberSearch" placeholder="🔍 Cari member..." oninput="searchPOSMember(this.value)" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px">';
    html += '<div id="posMemberResults"></div>';
  }
  html += '</div>';

  html += '<div class="summary-row"><span>Subtotal</span><span>' + formatRp(subtotal) + '</span></div>';
  html += '<div class="discount-input"><label>Diskon:</label><input type="number" id="cartDiscount" min="0" value="' + totalDiscount + '" onchange="updateCartUI()" placeholder="0"></div>';
  if (appSettings.tax_enabled && taxAmt > 0) {
    html += '<div class="summary-row"><span>' + escHtml(appSettings.tax_name || 'Pajak') + ' (' + appSettings.tax_rate + '%)</span><span>' + formatRp(taxAmt) + '</span></div>';
  }
  if (appSettings.service_charge_enabled && serviceAmt > 0) {
    html += '<div class="summary-row"><span>Service (' + appSettings.service_charge_rate + '%)</span><span>' + formatRp(serviceAmt) + '</span></div>';
  }
  // Member discount
  if (selectedPOSMember && selectedPOSMember.discount_percent > 0) {
    const memberDiscAmt = Math.round(subtotal * selectedPOSMember.discount_percent / 100);
    html += '<div class="summary-row" style="color:#16a34a"><span>🏷️ Disc Member ' + selectedPOSMember.discount_percent + '%</span><span>-' + formatRp(memberDiscAmt) + '</span></div>';
  }
  html += '<div class="summary-row total"><span>TOTAL</span><span>' + formatRp(grandTotal) + '</span></div>';

  // Payment methods
  html += '<div class="payment-methods">';
  ['Cash','QRIS','Transfer','Kartu','Hutang'].forEach(m => {
    html += '<div class="pay-method-btn' + (selectedPayMethod === m ? ' active' : '') + '" onclick="selectPayMethod(\'' + m + '\')">' + m + '</div>';
  });
  html += '</div>';

  // Payment input
  if (selectedPayMethod === 'Cash') {
    html += '<div class="payment-input"><input type="text" inputmode="numeric" id="paymentAmount" placeholder="Jumlah bayar..." oninput="formatMoneyInput(this); calcChange()"></div>';
    html += '<div class="change-display">Kembalian: <span id="changeAmount">Rp 0</span></div>';
  }
  if (selectedPayMethod === 'Hutang') {
    html += '<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:10px;margin-bottom:8px">';
    html += '<div style="font-size:12px;color:#92400e;margin-bottom:6px">📝 <strong>Kasbon</strong> — Wajib isi nama pelanggan</div>';
    html += '<input type="text" id="kasbonName" placeholder="Nama pelanggan..." style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:4px" list="kasbonCustomerList">';
    html += '<datalist id="kasbonCustomerList"></datalist>';
    html += '<input type="text" id="kasbonPhone" placeholder="No HP (opsional)" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px">';
    html += '</div>';
  }

  // Notes
  html += '<div class="cart-notes"><textarea id="cartNotes" placeholder="Catatan (opsional)..."></textarea></div>';

  html += '<div class="cart-action-row">';
  html += '<button class="btn-hold" onclick="holdOrder()"' + (cart.length === 0 ? ' disabled' : '') + '>⏸️ Tahan</button>';
  html += '<button class="btn-pay" onclick="processPayment()"' + (cart.length === 0 ? ' disabled' : '') + '>💳 Bayar ' + formatRp(grandTotal) + '</button>';
  html += '</div>';
  html += '</div></div>';

  return html;
}

function selectPayMethod(m) {
  selectedPayMethod = m;
  updateCartUI();
  if (m === 'Hutang') loadKasbonCustomers();
}

function loadKasbonCustomers() {
  apiFetch('/api/kasbon-customers').then(customers => {
    const dl = document.getElementById('kasbonCustomerList');
    if (dl) {
      dl.innerHTML = customers.map(c => '<option value="' + escHtml(c.name) + '">' + escHtml(c.name) + (c.total_remaining > 0 ? ' (hutang: ' + formatRp(c.total_remaining) + ')' : '') + '</option>').join('');
    }
  }).catch(() => {});
}

function calcChange() {
  const subtotal = cart.reduce((s, c) => s + (c.price * c.qty - c.discount - (c.autoDiscount || 0)), 0);
  const discountEl = document.getElementById('cartDiscount');
  const totalDiscount = discountEl ? (Number(discountEl.value)||0) : 0;
  const { grandTotal } = calcTaxService(subtotal, totalDiscount);
  const paid = parseMoneyValue('paymentAmount');
  const change = paid - grandTotal;
  const el = document.getElementById('changeAmount');
  if (el) {
    el.textContent = formatRp(Math.max(change, 0));
    el.style.color = change >= 0 ? 'var(--success)' : 'var(--error)';
  }
}

async function processPayment() {
  if (cart.length === 0) return;
  // Kasir must have open shift
  if (currentUser.role === 'kasir' && !activeShift) {
    showToast('Buka shift terlebih dahulu sebelum transaksi!', 'error');
    navigateTo('shifts');
    return;
  }
  const subtotal = cart.reduce((s, c) => s + (c.price * c.qty - c.discount - (c.autoDiscount || 0)), 0);
  const discountEl = document.getElementById('cartDiscount');
  const totalDiscount = discountEl ? (Number(discountEl.value)||0) : 0;
  const { taxAmt, serviceAmt, grandTotal } = calcTaxService(subtotal, totalDiscount);

  let payment = grandTotal;
  let kasbonName = '';
  let kasbonPhone = '';
  if (selectedPayMethod === 'Cash') {
    const payEl = document.getElementById('paymentAmount');
    payment = payEl ? parseMoneyValue('paymentAmount') : 0;
    if (payment < grandTotal) {
      showToast('Pembayaran kurang!', 'error');
      return;
    }
  }
  if (selectedPayMethod === 'Hutang') {
    kasbonName = (document.getElementById('kasbonName') || {}).value || '';
    kasbonPhone = (document.getElementById('kasbonPhone') || {}).value || '';
    if (!kasbonName.trim()) {
      showToast('Nama pelanggan wajib diisi untuk kasbon!', 'error');
      return;
    }
    payment = 0; // No payment yet
  }

  const change = payment - grandTotal;
  const notesEl = document.getElementById('cartNotes');
  const notes = notesEl ? notesEl.value : '';

  const payload = {
    items: cart.map(c => ({ id: c.id, name: c.name, price: c.price, cost_price: c.cost_price || 0, qty: c.qty, discount: (c.discount || 0) + (c.autoDiscount || 0) })),
    subtotal: subtotal,
    discount: totalDiscount,
    total: grandTotal,
    payment: payment,
    change: selectedPayMethod === 'Hutang' ? 0 : change,
    payment_method: selectedPayMethod,
    customer_id: selectedPOSMember ? selectedPOSMember.id : null,
    customer_name: selectedPOSMember ? selectedPOSMember.name : (selectedPayMethod === 'Hutang' ? kasbonName : 'Umum'),
    customer_phone: selectedPayMethod === 'Hutang' ? kasbonPhone : null,
    notes: notes,
    tax_amount: taxAmt,
    tax_name: appSettings.tax_enabled ? (appSettings.tax_name || 'Pajak') : null,
    tax_rate: appSettings.tax_enabled ? (appSettings.tax_rate || 0) : 0,
    service_charge: serviceAmt,
    service_charge_rate: appSettings.service_charge_enabled ? (appSettings.service_charge_rate || 0) : 0
  };

  try {
    let result;
    if (!navigator.onLine) {
      result = await addOfflineTx(payload);
      showToast('📴 Transaksi disimpan offline — akan disync saat online', 'info');
    } else {
      result = await apiFetch('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Transaksi berhasil!', 'success');
    }
    showReceipt(payload, result);
    cart = [];
    selectedPOSMember = null;
    // Refresh products stock
    try {
      const prodData = await apiFetch('/api/products');
      posProducts = prodData.products || prodData || [];
    } catch {}
    updateCartUI();
    document.getElementById('posProductGrid').innerHTML = renderProductGrid();
  } catch (err) {
    showToast('Gagal memproses: ' + err.message, 'error');
  }
}

function showReceipt(payload, result) {
  const tx = result.transaction || result;
  const txId = tx.id || '-';
  const now = new Date();
  let html = '<div class="modal-header"><h3>🧾 Struk Pembayaran</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body"><div class="receipt" id="receiptContent">';
  const storeName = appSettings.store_name || 'KasirPro';
  const storeAddr = appSettings.store_address ? '<p style="font-size:10px;margin:2px 0">' + escHtml(appSettings.store_address) + '</p>' : '';
  const storePhone = appSettings.store_phone ? '<p style="font-size:10px;margin:2px 0">📞 ' + escHtml(appSettings.store_phone) + '</p>' : '';
  const logoHtml = appSettings.store_logo_url ? '<img src="' + escHtml(appSettings.store_logo_url) + '" style="max-height:50px;max-width:150px;margin-bottom:4px" alt="">' : '';
  html += '<div class="receipt-header">' + logoHtml + '<h3>' + escHtml(storeName) + '</h3>' + storeAddr + storePhone + '<p style="font-size:11px">Struk Pembayaran</p></div>';
  html += '<div class="receipt-divider"></div>';
  html += '<div class="receipt-row"><span>No: #' + escHtml(String(txId)) + '</span><span>' + formatDateTime(now) + '</span></div>';
  html += '<div class="receipt-row"><span>Kasir: ' + escHtml(currentUser.name) + '</span></div>';
  html += '<div class="receipt-divider"></div>';

  payload.items.forEach(item => {
    html += '<div class="receipt-item"><div class="item-name">' + escHtml(item.name) + '</div>';
    html += '<div class="item-detail"><span>' + item.qty + ' x ' + formatRp(item.price) + (item.discount > 0 ? ' disc ' + formatRp(item.discount) : '') + '</span><span>' + formatRp(item.price * item.qty - item.discount) + '</span></div></div>';
  });

  html += '<div class="receipt-divider"></div>';
  html += '<div class="receipt-row"><span>Subtotal</span><span>' + formatRp(payload.subtotal) + '</span></div>';
  if (payload.discount > 0) {
    html += '<div class="receipt-row"><span>Diskon</span><span>-' + formatRp(payload.discount) + '</span></div>';
  }
  if (payload.tax_amount > 0) {
    html += '<div class="receipt-row"><span>' + escHtml(payload.tax_name || 'Pajak') + ' (' + payload.tax_rate + '%)</span><span>' + formatRp(payload.tax_amount) + '</span></div>';
  }
  if (payload.service_charge > 0) {
    html += '<div class="receipt-row"><span>Service (' + payload.service_charge_rate + '%)</span><span>' + formatRp(payload.service_charge) + '</span></div>';
  }
  html += '<div class="receipt-divider"></div>';
  html += '<div class="receipt-row receipt-total"><span>TOTAL</span><span>' + formatRp(payload.total) + '</span></div>';
  html += '<div class="receipt-row"><span>Bayar (' + escHtml(payload.payment_method) + ')</span><span>' + formatRp(payload.payment) + '</span></div>';
  if (payload.change > 0) {
    html += '<div class="receipt-row"><span>Kembalian</span><span>' + formatRp(payload.change) + '</span></div>';
  }
  html += '<div class="receipt-divider"></div>';
  html += '<div class="receipt-footer">' + escHtml(appSettings.receipt_footer || 'Terima kasih telah berbelanja!') + '</div>';
  html += '</div></div>';
  html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Tutup</button><button class="btn btn-primary" onclick="printReceipt()">🖨️ Cetak</button></div>';

  openModal(html);
  document.querySelector('.modal-overlay').id = 'receiptModal';
}

function printReceipt() {
  const content = document.getElementById('receiptContent');
  if (!content) return;
  
  // Remove existing overlay if any
  closePrintOverlay();
  
  // Create fullscreen overlay (no new tab/iframe - works on Android)
  const overlay = document.createElement('div');
  overlay.id = 'printOverlay';
  overlay.innerHTML = 
    '<div class="print-toolbar">' +
      '<button class="print-btn-back" onclick="closePrintOverlay()">← Kembali</button>' +
      '<button class="print-btn-cetak" onclick="doPrint()">🖨️ Cetak</button>' +
    '</div>' +
    '<div class="print-receipt-body">' + content.innerHTML + '</div>';
  document.body.appendChild(overlay);
  document.body.classList.add('printing-mode');
}

function doPrint() {
  window.print();
}

function closePrintOverlay() {
  const overlay = document.getElementById('printOverlay');
  if (overlay) overlay.remove();
  document.body.classList.remove('printing-mode');
}

