// ============ EXPENSES ============
let expenseFilter = '';

async function renderExpenses() {
  const main = document.getElementById('mainContent');
  try {
    const today = new Date().toISOString().split('T')[0];
    const getSummaryTotal = (d) => d?.summary?.total_expenses || d?.summary?.total || d?.total_expenses || d?.total || 0;
    const [expData, monthSum, todaySum, weekSum] = await Promise.all([
      apiFetch('/api/expenses?month=' + today.substring(0,7)),
      apiFetch('/api/expenses/summary?period=month').catch(() => ({ total: 0 })),
      apiFetch('/api/expenses/summary?period=today').catch(() => ({ total: 0 })),
      apiFetch('/api/expenses/summary?period=week').catch(() => ({ total: 0 }))
    ]);
    const expenses = Array.isArray(expData) ? expData : (expData.expenses || []);

    let html = '<div class="page-header"><h1>💸 Pengeluaran</h1><p>Catat dan kelola pengeluaran toko</p></div>';

    // Summary cards
    html += '<div class="stat-grid">';
    html += '<div class="stat-card stat-red"><div class="stat-icon">📅</div><div class="stat-value">' + formatRp(getSummaryTotal(todaySum)) + '</div><div class="stat-label">Hari Ini</div></div>';
    html += '<div class="stat-card stat-blue"><div class="stat-icon">📆</div><div class="stat-value">' + formatRp(getSummaryTotal(weekSum)) + '</div><div class="stat-label">Minggu Ini</div></div>';
    html += '<div class="stat-card stat-purple"><div class="stat-icon">🗓️</div><div class="stat-value">' + formatRp(getSummaryTotal(monthSum)) + '</div><div class="stat-label">Bulan Ini</div></div>';
    html += '</div>';

    // Toolbar
    html += '<div class="toolbar">';
    const expCats = ['Semua','Operasional','Belanja','Gaji','Listrik/Air','Lainnya'];
    html += '<div class="expense-cats">';
    expCats.forEach(cat => {
      const active = (cat === 'Semua' && !expenseFilter) || (expenseFilter === cat);
      html += '<div class="category-pill' + (active ? ' active' : '') + '" onclick="filterExpenses(\'' + (cat === 'Semua' ? '' : cat) + '\')">' + escHtml(cat) + '</div>';
    });
    html += '</div><div class="spacer"></div><button class="btn btn-primary" onclick="showExpenseModal()">+ Tambah Pengeluaran</button></div>';

    // Table
    html += '<div class="card"><div class="overflow-x"><table id="expenseTable"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Deskripsi</th><th>Jumlah</th><th>Aksi</th></tr></thead><tbody>';
    const filtered = expenseFilter ? expenses.filter(e => e.category === expenseFilter) : expenses;
    if (filtered.length === 0) {
      html += '<tr><td colspan="5">' + emptyHtml('💸', 'Belum ada pengeluaran') + '</td></tr>';
    } else {
      filtered.forEach(e => {
        html += '<tr><td>' + formatDate(e.date || e.created_at) + '</td><td><span class="badge badge-gray">' + escHtml(e.category) + '</span></td>' +
          '<td>' + escHtml(e.description || '-') + '</td>' +
          '<td class="text-right"><strong style="color:var(--error)">' + formatRp(e.amount) + '</strong></td>' +
          '<td><button class="btn btn-sm btn-danger" onclick="deleteExpense(' + e.id + ')">🗑️</button></td></tr>';
      });
    }
    html += '</tbody></table></div></div>';
    main.innerHTML = html;
  } catch (err) { main.innerHTML = '<div class="alert-box alert-warning">Gagal memuat: ' + escHtml(err.message) + '</div>'; }
}

function filterExpenses(cat) {
  expenseFilter = cat;
  renderExpenses();
}

function showExpenseModal() {
  let html = '<div class="modal-header"><h3>➕ Tambah Pengeluaran</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
  html += '<div class="modal-body"><form id="expenseForm">';
  html += '<div class="form-group"><label>Kategori *</label><select id="eCategory"><option value="Operasional">Operasional</option><option value="Belanja">Belanja</option><option value="Gaji">Gaji</option><option value="Listrik/Air">Listrik/Air</option><option value="Lainnya">Lainnya</option></select></div>';
  html += '<div class="form-group"><label>Deskripsi</label><input id="eDesc" placeholder="Deskripsi pengeluaran"></div>';
  html += '<div class="form-group"><label>Jumlah (Rp) *</label><input id="eAmount" type="text" inputmode="numeric" oninput="formatMoneyInput(this)" required></div>';
  const today = new Date().toISOString().split('T')[0];
  html += '<div class="form-group"><label>Tanggal</label><input id="eDate" type="date" value="' + today + '"></div>';
  html += '</form></div>';
  html += '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveExpense()">Simpan</button></div>';
  openModal(html);
}

async function saveExpense() {
  const payload = {
    category: document.getElementById('eCategory').value,
    description: document.getElementById('eDesc').value,
    amount: parseMoneyValue('eAmount'),
    date: document.getElementById('eDate').value
  };
  if (!payload.amount) { showToast('Jumlah wajib diisi', 'error'); return; }
  try {
    await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Pengeluaran dicatat');
    closeModal(); renderExpenses();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteExpense(id) {
  if (!confirm('Hapus pengeluaran ini?')) return;
  try {
    await apiFetch('/api/expenses/' + id, { method: 'DELETE' });
    showToast('Pengeluaran dihapus'); renderExpenses();
  } catch (err) { showToast(err.message, 'error'); }
}

