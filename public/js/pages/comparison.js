// ============ PERBANDINGAN PERIODE ============
var compPeriodA = { start: '', end: '' };
var compPeriodB = { start: '', end: '' };
var compPresetA = 'this_week';
var compPresetB = 'last_week';

function getPresetDates(preset) {
  var now = new Date();
  var today = now.toISOString().slice(0,10);
  var d = new Date(now);
  if (preset === 'today') return { start: today, end: today };
  if (preset === 'yesterday') { d.setDate(d.getDate()-1); var y = d.toISOString().slice(0,10); return { start: y, end: y }; }
  if (preset === 'this_week') { var day = now.getDay(); var diff = day === 0 ? 6 : day - 1; d.setDate(now.getDate() - diff); return { start: d.toISOString().slice(0,10), end: today }; }
  if (preset === 'last_week') { var day2 = now.getDay(); var diff2 = day2 === 0 ? 6 : day2 - 1; d.setDate(now.getDate() - diff2 - 7); var s = d.toISOString().slice(0,10); d.setDate(d.getDate() + 6); return { start: s, end: d.toISOString().slice(0,10) }; }
  if (preset === 'this_month') { return { start: today.slice(0,8) + '01', end: today }; }
  if (preset === 'last_month') { d.setDate(0); var e = d.toISOString().slice(0,10); d.setDate(1); return { start: d.toISOString().slice(0,10), end: e }; }
  return { start: '', end: '' };
}

function setCompPreset(period, preset) {
  if (period === 'A') { compPresetA = preset; compPeriodA = getPresetDates(preset); }
  else { compPresetB = preset; compPeriodB = getPresetDates(preset); }
  renderComparison();
}

function applyCompCustomDate(period) {
  if (period === 'A') {
    var s = document.getElementById('compStartA'); var e = document.getElementById('compEndA');
    if (s && e && s.value && e.value) { compPeriodA = { start: s.value, end: e.value }; compPresetA = 'custom'; }
  } else {
    var s2 = document.getElementById('compStartB'); var e2 = document.getElementById('compEndB');
    if (s2 && e2 && s2.value && e2.value) { compPeriodB = { start: s2.value, end: e2.value }; compPresetB = 'custom'; }
  }
  renderComparison();
}

async function renderComparison() {
  var main = document.getElementById('mainContent');
  
  if (!compPeriodA.start) compPeriodA = getPresetDates(compPresetA);
  if (!compPeriodB.start) compPeriodB = getPresetDates(compPresetB);

  var html = '<div class="page-header"><h1>\u2696\uFE0F Perbandingan Periode</h1><p>Bandingkan performa penjualan antar periode</p></div>';

  var presets = [['today','Hari Ini'],['yesterday','Kemarin'],['this_week','Minggu Ini'],['last_week','Minggu Lalu'],['this_month','Bulan Ini'],['last_month','Bulan Lalu'],['custom','Custom']];
  
  var periods = ['A','B'];
  for (var idx = 0; idx < periods.length; idx++) {
    var p = periods[idx];
    var preset = p === 'A' ? compPresetA : compPresetB;
    var dates = p === 'A' ? compPeriodA : compPeriodB;
    var color = idx === 0 ? '#3b82f6' : '#8b5cf6';
    html += '<div class="card mb-3" style="border-left:4px solid ' + color + '">';
    html += '<div style="padding:12px 16px;font-weight:700;color:' + color + '">Periode ' + p + ': ' + (dates.start || '?') + ' s/d ' + (dates.end || '?') + '</div>';
    html += '<div style="padding:0 16px 12px;display:flex;flex-wrap:wrap;gap:6px">';
    for (var pi = 0; pi < presets.length; pi++) {
      var pr = presets[pi];
      html += '<div class="category-pill' + (preset === pr[0] ? ' active' : '') + '" onclick="setCompPreset(\'' + p + '\',\'' + pr[0] + '\')">' + pr[1] + '</div>';
    }
    html += '</div>';
    if (preset === 'custom') {
      html += '<div style="padding:0 16px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:8px">';
      html += '<input type="date" id="compStart' + p + '" value="' + dates.start + '" style="padding:6px 10px;border:2px solid var(--border);border-radius:8px;font-size:13px">';
      html += '<span>s/d</span>';
      html += '<input type="date" id="compEnd' + p + '" value="' + dates.end + '" style="padding:6px 10px;border:2px solid var(--border);border-radius:8px;font-size:13px">';
      html += '<button class="btn btn-primary" onclick="applyCompCustomDate(\'' + p + '\')" style="padding:6px 16px;font-size:13px">Terapkan</button>';
      html += '</div>';
    }
    html += '</div>';
  }

  if (compPeriodA.start && compPeriodA.end && compPeriodB.start && compPeriodB.end) {
    try {
      var data = await apiFetch('/api/reports/comparison?start_a=' + compPeriodA.start + '&end_a=' + compPeriodA.end + '&start_b=' + compPeriodB.start + '&end_b=' + compPeriodB.end);
      var a = data.period_a.summary;
      var b = data.period_b.summary;

      function pctChange(newVal, oldVal) {
        if (Number(oldVal) === 0) return Number(newVal) > 0 ? 100 : 0;
        return Math.round((Number(newVal) - Number(oldVal)) / Number(oldVal) * 100);
      }
      function changeIndicator(pct) {
        if (pct > 0) return '<span style="color:#10b981;font-weight:700">\u25B2 +' + pct + '%</span>';
        if (pct < 0) return '<span style="color:#ef4444;font-weight:700">\u25BC ' + pct + '%</span>';
        return '<span style="color:#94a3b8;font-weight:700">= 0%</span>';
      }

      html += '<div class="stat-grid">';
      var metrics = [
        { label: '\uD83D\uDCB0 Pendapatan', valA: a.total_revenue, valB: b.total_revenue, isMoney: true },
        { label: '\uD83E\uDDFE Transaksi', valA: a.total_transactions, valB: b.total_transactions, isMoney: false },
        { label: '\uD83D\uDCCA Rata-rata', valA: a.avg_transaction, valB: b.avg_transaction, isMoney: true }
      ];
      for (var mi = 0; mi < metrics.length; mi++) {
        var m = metrics[mi];
        var pct = pctChange(m.valA, m.valB);
        html += '<div class="stat-card"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">' + m.label + '</div>';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px">';
        html += '<div style="text-align:center"><div style="font-size:10px;color:#3b82f6;font-weight:600">PERIODE A</div><div style="font-size:18px;font-weight:800">' + (m.isMoney ? formatRp(m.valA) : (m.valA || 0)) + '</div></div>';
        html += '<div style="text-align:center"><div style="font-size:10px;color:#94a3b8">VS</div>' + changeIndicator(pct) + '</div>';
        html += '<div style="text-align:center"><div style="font-size:10px;color:#8b5cf6;font-weight:600">PERIODE B</div><div style="font-size:18px;font-weight:800">' + (m.isMoney ? formatRp(m.valB) : (m.valB || 0)) + '</div></div>';
        html += '</div></div>';
      }
      html += '</div>';

      html += '<div class="dash-grid mt-4">';
      var pLabels = ['A','B'];
      for (var ti = 0; ti < pLabels.length; ti++) {
        var tp = pLabels[ti];
        var pd = ti === 0 ? data.period_a : data.period_b;
        var tcolor = ti === 0 ? '#3b82f6' : '#8b5cf6';
        html += '<div class="card"><div class="card-header"><h3 style="color:' + tcolor + '">\uD83C\uDFC6 Top Produk Periode ' + tp + '</h3></div>';
        if (pd.top_products && pd.top_products.length > 0) {
          html += '<div class="overflow-x"><table><thead><tr><th>#</th><th>Produk</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>';
          for (var tpi = 0; tpi < pd.top_products.length; tpi++) {
            var tpr = pd.top_products[tpi];
            html += '<tr><td>' + (tpi+1) + '</td><td><strong>' + escHtml(tpr.product_name) + '</strong></td><td>' + (tpr.total_qty||0) + '</td><td>' + formatRp(tpr.total_revenue) + '</td></tr>';
          }
          html += '</tbody></table></div>';
        } else { html += emptyHtml('\uD83C\uDFC6', 'Tidak ada data'); }
        html += '</div>';
      }
      html += '</div>';

      html += '<div class="dash-grid mt-4">';
      for (var pyi = 0; pyi < pLabels.length; pyi++) {
        var pyp = pLabels[pyi];
        var pyd = pyi === 0 ? data.period_a : data.period_b;
        var pycolor = pyi === 0 ? '#3b82f6' : '#8b5cf6';
        html += '<div class="card"><div class="card-header"><h3 style="color:' + pycolor + '">\uD83D\uDCB3 Metode Bayar Periode ' + pyp + '</h3></div>';
        if (pyd.by_payment && pyd.by_payment.length > 0) {
          html += '<div class="overflow-x"><table><thead><tr><th>Metode</th><th>Jumlah</th><th>Total</th></tr></thead><tbody>';
          for (var pmi = 0; pmi < pyd.by_payment.length; pmi++) {
            var pm = pyd.by_payment[pmi];
            html += '<tr><td>' + payMethodBadge(pm.payment_method) + '</td><td>' + (pm.count||0) + '</td><td>' + formatRp(pm.total) + '</td></tr>';
          }
          html += '</tbody></table></div>';
        } else { html += emptyHtml('\uD83D\uDCB3', 'Tidak ada data'); }
        html += '</div>';
      }
      html += '</div>';

    } catch (err) {
      html += '<div class="alert-box alert-warning">Gagal memuat data: ' + escHtml(err.message) + '</div>';
    }
  } else {
    html += '<div class="card" style="text-align:center;padding:40px">' + emptyHtml('\u2696\uFE0F', 'Pilih kedua periode untuk memulai perbandingan') + '</div>';
  }

  main.innerHTML = html;
}

