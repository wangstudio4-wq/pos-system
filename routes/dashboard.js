// Dashboard routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============ DASHBOARD ============
router.get('/', authenticateToken, async (req, res) => {
  const safeQuery = async (sql, params) => {
    try { const [rows] = await pool.query(sql, params); return rows; }
    catch (e) { console.error('Dashboard query error:', e.message); return null; }
  };

  try {
    // Detect date column in transactions
    let dateCol = 'created_at';
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM transactions');
      const colNames = cols.map(c => c.Field);
      if (!colNames.includes('created_at')) {
        dateCol = colNames.includes('date') ? 'date' : colNames.includes('transaction_date') ? 'transaction_date' : 'id';
      }
    } catch (e) {}

    const dateFilter = dateCol === 'id' ? '1=1' : `DATE(${dateCol}) = CURDATE()`;
    const dateRange = dateCol === 'id' ? '1=1' : `${dateCol} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
    const orderBy = dateCol === 'id' ? 'id DESC' : `${dateCol} DESC`;

    // Today's stats
    const todaySales = await safeQuery(
      `SELECT COUNT(*) as transactions, COALESCE(SUM(total), 0) as revenue FROM transactions WHERE ${dateFilter}`
    );

    // Stock queries - try with min_stock first, fallback without
    let lowStock = await safeQuery(`SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND stock > 0`);
    if (!lowStock) lowStock = await safeQuery(`SELECT COUNT(*) as count FROM products WHERE stock <= 5 AND stock > 0`);
    if (!lowStock) lowStock = [{ count: 0 }];

    const outOfStock = await safeQuery(`SELECT COUNT(*) as count FROM products WHERE stock = 0`) || [{ count: 0 }];
    const totalProducts = await safeQuery('SELECT COUNT(*) as count FROM products') || [{ count: 0 }];

    const todayExpenses = await safeQuery(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date = CURDATE()`) || [{ total: 0 }];

    // Sales chart
    let salesChart = [];
    if (dateCol !== 'id') {
      salesChart = await safeQuery(
        `SELECT DATE(${dateCol}) as date, COUNT(*) as transactions, COALESCE(SUM(total), 0) as revenue
         FROM transactions WHERE ${dateRange} GROUP BY DATE(${dateCol}) ORDER BY date ASC`
      ) || [];
    }

    // Recent transactions - try full query, fallback to basic
    let recentTx = await safeQuery(
      `SELECT id, total, payment_method, user_name, customer_name, ${dateCol} as created_at FROM transactions ORDER BY ${orderBy} LIMIT 5`
    );
    if (!recentTx) {
      recentTx = await safeQuery(`SELECT id, total, ${dateCol} as created_at FROM transactions ORDER BY ${orderBy} LIMIT 5`) || [];
    }

    // Top products today
    let topToday = await safeQuery(
      `SELECT ti.product_name, SUM(ti.qty) as total_qty, SUM(ti.subtotal) as total_revenue
       FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
       WHERE ${dateFilter.replace(dateCol, 't.' + dateCol)}
       GROUP BY ti.product_name ORDER BY total_revenue DESC LIMIT 5`
    ) || [];

    // Current shift
    const currentShift = await safeQuery(
      'SELECT * FROM shifts WHERE user_id = ? AND status = "open" LIMIT 1', [req.user.id]
    );

    // Low stock products list
    let lowStockProducts = await safeQuery(
      'SELECT id, name, stock, min_stock FROM products WHERE stock <= min_stock ORDER BY stock ASC LIMIT 20'
    ) || [];

    res.json({
      today: {
        transactions: todaySales ? todaySales[0].transactions : 0,
        revenue: todaySales ? todaySales[0].revenue : 0,
        expenses: todayExpenses[0].total || 0,
        profit: (todaySales ? todaySales[0].revenue : 0) - (todayExpenses[0].total || 0)
      },
      stock: {
        total: totalProducts[0].count,
        low: lowStock[0].count,
        out: outOfStock[0].count
      },

      sales_chart: salesChart,
      recent_transactions: recentTx,
      top_products_today: topToday,
      current_shift: currentShift && currentShift.length > 0 ? currentShift[0] : null,
      low_stock_products: lowStockProducts
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Gagal memuat dashboard: ' + err.message });
  }
});

module.exports = router;
