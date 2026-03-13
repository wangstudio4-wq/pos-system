// ============ NAVIGATION ============
const NAV_ITEMS = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard', roles: ['owner','admin'] },
  { id: 'pos', icon: '🛒', label: 'Kasir', roles: ['admin','kasir'] },
  { id: 'history', icon: '🧾', label: 'Histori Transaksi', roles: ['owner','kasir'] },
  { id: 'products', icon: '📦', label: 'Kelola Produk', roles: ['owner','admin'] },
  { id: 'categories', icon: '🏷️', label: 'Kategori', roles: ['owner','admin'] },
  { id: 'expenses', icon: '💸', label: 'Pengeluaran', roles: ['owner','admin'] },
  { id: 'shifts', icon: '⏰', label: 'Shift', roles: ['owner','admin','kasir'] },
  { id: 'reports', icon: '📈', label: 'Laporan', roles: ['owner','admin'] },
  { id: 'profitloss', icon: '💹', label: 'Laba Rugi', roles: ['owner','admin'] },
  { id: 'suppliers', icon: '🏭', label: 'Supplier', roles: ['owner','admin'] },
  { id: 'kasbon', icon: '📝', label: 'Kasbon', roles: ['owner','admin','kasir'] },
  { id: 'stockin', icon: '📥', label: 'Stok Masuk', roles: ['owner','admin'] },
  { id: 'stockopname', icon: '📋', label: 'Stok Opname', roles: ['owner','admin'] },
  { id: 'stockcard', icon: '📊', label: 'Kartu Stok', roles: ['owner','admin'] },
  { id: 'comparison', icon: '⚖️', label: 'Perbandingan Periode', roles: ['owner','admin'] },
  { id: 'slowmoving', icon: '🐌', label: 'Produk Slow Moving', roles: ['owner','admin'] },
  { id: 'expiredtracking', icon: '📅', label: 'Expired Tracking', roles: ['owner','admin'] },
  { id: 'restock', icon: '🔔', label: 'Restock Alert', roles: ['owner','admin'] },
  { id: 'members', icon: '👥', label: 'Member', roles: ['owner','admin','kasir'] },
  { id: 'rewards', icon: '🎁', label: 'Rewards', roles: ['owner','admin'] },
  { id: 'vipprices', icon: '👑', label: 'Harga VIP', roles: ['owner','admin'] },
  { id: 'importproducts', icon: '📤', label: 'Import Produk', roles: ['owner','admin'] },
  { id: 'users', icon: '👤', label: 'Kelola User', roles: ['owner'] },
  { id: 'settings', icon: '⚙️', label: 'Pengaturan', roles: ['owner'] },
  { id: 'password', icon: '🔑', label: 'Ganti Password', roles: ['owner','admin'] },
];

function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  const role = currentUser.role;
  nav.innerHTML = NAV_ITEMS.filter(n => n.roles.includes(role)).map(n =>
    '<div class="nav-item' + (n.id === currentPage ? ' active' : '') + '" onclick="navigateTo(\'' + n.id + '\')" data-page="' + n.id + '">' +
    '<span class="nav-icon">' + n.icon + '</span><span>' + escHtml(n.label) + '</span></div>'
  ).join('');

  document.getElementById('userAvatar').textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '?';
  document.getElementById('userName').textContent = currentUser.name || currentUser.username;
  const rb = document.getElementById('userRoleBadge');
  rb.textContent = currentUser.role;
  rb.className = 'role-badge role-' + currentUser.role;
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');

  const main = document.getElementById('mainContent');
  main.innerHTML = loadingHtml();

  const renderers = {
    dashboard: renderDashboard,
    pos: renderPOS,
    members: renderMembers,
    rewards: renderRewards,
    vipprices: renderVIPPrices,
    history: renderHistory,
    products: renderProducts,
    categories: renderCategories,
    expenses: renderExpenses,
    shifts: renderShifts,
    reports: renderReports,
    profitloss: renderProfitLoss,
    suppliers: renderSuppliers,
    kasbon: renderKasbon,
    stockin: renderStockIn,
    stockopname: renderStockOpname,
    stockcard: renderStockCard,
    comparison: renderComparison,
    slowmoving: renderSlowMoving,
    expiredtracking: renderExpiredTracking,
    restock: renderRestockAlert,
    importproducts: renderImportProducts,
    users: renderUsers,
    settings: renderSettings,
    password: renderPassword,
    changepin: renderChangePin,
  };
  if (renderers[page]) renderers[page]();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}

