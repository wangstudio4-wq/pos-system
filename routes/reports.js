// Report routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.get('/sales', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { period, start_date, end_date } = req.query;

    let dateFilter = '';
    let dateParams = [];
    if (start_date && end_date) {
      dateFilter = 'WHERE created_at >= ? AND created_at <= ?';
      dateParams = [start_date + ' 00:00:00', end_date + ' 23:59:59'];
    } else if (period === 'today') {
      dateFilter = 'WHERE DATE(created_at) = CURDATE()';
    } else if (period === 'week') {
      dateFilter = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      dateFilter = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    const tDateFilter = dateFilter.replace(/created_at/g, 't.created_at');

    const [salesSummary] = await pool.query(
      `SELECT COUNT(*) as total_transactions, COALESCE(SUM(total), 0) as total_revenue,
       COALESCE(SUM(discount), 0) as total_discount
       FROM transactions ${dateFilter}`, dateParams
    );

    const [perCashier] = await pool.query(
      `SELECT CASE WHEN user_name IS NULL OR user_name = '' THEN 'Kasir' ELSE user_name END as user_name, COUNT(*) as transactions, COALESCE(SUM(total), 0) as revenue 
       FROM transactions ${dateFilter} 
       GROUP BY CASE WHEN user_name IS NULL OR user_name = '' THEN 'Kasir' ELSE user_name END ORDER BY revenue DESC`, dateParams
    );

    const [topProducts] = await pool.query(
      `SELECT ti.product_name, SUM(ti.qty) as total_qty, SUM(ti.subtotal) as total_revenue
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       ${tDateFilter}
       GROUP BY ti.product_name ORDER BY total_revenue DESC LIMIT 10`, dateParams
    );

    // Payment method breakdown
    const [byPayment] = await pool.query(
      `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as total
       FROM transactions ${dateFilter}
       GROUP BY payment_method ORDER BY total DESC`, dateParams
    );

    // Average transaction
    const avgTx = salesSummary[0].total_transactions > 0 
      ? Math.round(salesSummary[0].total_revenue / salesSummary[0].total_transactions) 
      : 0;
    salesSummary[0].avg_transaction = avgTx;

    // Sales by category
    const [byCategory] = await pool.query(
      `SELECT COALESCE(c.name, 'Tanpa Kategori') as category_name, 
              COALESCE(c.color, '#6b7280') as category_color,
              COUNT(DISTINCT t.id) as transactions,
              SUM(ti.qty) as total_qty, 
              COALESCE(SUM(ti.subtotal), 0) as total_revenue
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       LEFT JOIN products p ON ti.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       ${tDateFilter}
       GROUP BY c.id, c.name, c.color ORDER BY total_revenue DESC`, dateParams
    );

    // Sales by shift
    const [byShift] = await pool.query(
      `SELECT s.id as shift_id, s.user_name, 
              DATE_FORMAT(s.opened_at, '%d/%m/%Y %H:%i') as opened_at,
              DATE_FORMAT(s.closed_at, '%d/%m/%Y %H:%i') as closed_at,
              s.status,
              COUNT(t.id) as transactions,
              COALESCE(SUM(t.total), 0) as revenue
       FROM shifts s
       LEFT JOIN transactions t ON t.user_id = s.user_id 
         AND t.created_at >= s.opened_at 
         AND (s.closed_at IS NULL OR t.created_at <= s.closed_at)
         AND (t.status IS NULL OR t.status = 'completed')
       ${dateFilter ? 'WHERE ' + dateFilter.replace('WHERE ', '').replace(/created_at/g, 's.opened_at') : ''}
       GROUP BY s.id ORDER BY s.opened_at DESC LIMIT 20`, dateParams
    );

    // Hourly sales
    const [byHour] = await pool.query(
      `SELECT HOUR(created_at) as hour, 
              COUNT(*) as transactions,
              COALESCE(SUM(total), 0) as revenue
       FROM transactions ${dateFilter}
       GROUP BY HOUR(created_at) ORDER BY hour ASC`, dateParams
    );

    res.json({
      summary: salesSummary[0],
      per_cashier: perCashier,
      top_products: topProducts,
      by_payment: byPayment,
      by_category: byCategory,
      by_shift: byShift,
      by_hour: byHour
    });
  } catch (err) {
    console.error('Sales report error:', err);
    res.status(500).json({ error: 'Gagal mengambil laporan.' });
  }
});

// ============ PERIOD COMPARISON ============
router.get('/comparison', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { start_a, end_a, start_b, end_b } = req.query;
    if (!start_a || !end_a || !start_b || !end_b) {
      return res.status(400).json({ error: 'Semua tanggal harus diisi' });
    }

    async function getPeriodData(start, end) {
      const params = [start + ' 00:00:00', end + ' 23:59:59'];
      const dateFilter = 'WHERE created_at >= ? AND created_at <= ?';
      const tDateFilter = 'WHERE t.created_at >= ? AND t.created_at <= ?';

      const [summary] = await pool.query(
        `SELECT COUNT(*) as total_transactions, COALESCE(SUM(total), 0) as total_revenue,
         COALESCE(AVG(total), 0) as avg_transaction, COALESCE(SUM(discount), 0) as total_discount
         FROM transactions ${dateFilter}`, params
      );

      const [topProducts] = await pool.query(
        `SELECT ti.product_name, SUM(ti.qty) as total_qty, COALESCE(SUM(ti.subtotal), 0) as total_revenue
         FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
         ${tDateFilter} GROUP BY ti.product_name ORDER BY total_revenue DESC LIMIT 10`, params
      );

      const [byPayment] = await pool.query(
        `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as total
         FROM transactions ${dateFilter} GROUP BY payment_method ORDER BY total DESC`, params
      );

      const [byCategory] = await pool.query(
        `SELECT COALESCE(c.name, 'Tanpa Kategori') as category_name,
                SUM(ti.qty) as total_qty, COALESCE(SUM(ti.subtotal), 0) as total_revenue
         FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
         LEFT JOIN products p ON ti.product_id = p.id LEFT JOIN categories c ON p.category_id = c.id
         ${tDateFilter} GROUP BY c.id, c.name ORDER BY total_revenue DESC`, params
      );

      return {
        summary: summary[0],
        top_products: topProducts,
        by_payment: byPayment,
        by_category: byCategory
      };
    }

    const [periodA, periodB] = await Promise.all([
      getPeriodData(start_a, end_a),
      getPeriodData(start_b, end_b)
    ]);

    res.json({ period_a: periodA, period_b: periodB });
  } catch (err) {
    console.error('Comparison report error:', err);
    res.status(500).json({ error: 'Gagal mengambil data perbandingan.' });
  }
});

// ============ SLOW MOVING PRODUCTS ============
router.get('/slow-moving', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString().slice(0, 10) + ' 00:00:00';

    const [withSales] = await pool.query(
      `SELECT p.id, p.name, p.stock, p.price, p.cost_price, p.unit,
              COALESCE(c.name, 'Tanpa Kategori') as category_name,
              COALESCE(SUM(ti.qty), 0) as total_sold,
              COALESCE(SUM(ti.subtotal), 0) as total_revenue,
              MAX(t.created_at) as last_sold_at
       FROM products p
       LEFT JOIN transaction_items ti ON ti.product_id = p.id
       LEFT JOIN transactions t ON ti.transaction_id = t.id AND t.created_at >= ?
       LEFT JOIN categories c ON p.category_id = c.id
       GROUP BY p.id
       ORDER BY total_sold ASC, p.stock DESC`,
      [cutoff]
    );

    const products = withSales.map(p => {
      const capitalTied = (Number(p.stock) || 0) * (Number(p.cost_price) || 0);
      const avgDailySales = (Number(p.total_sold) || 0) / days;
      const daysOfStock = avgDailySales > 0 ? Math.round(Number(p.stock) / avgDailySales) : 999;
      return {
        ...p,
        capital_tied: capitalTied,
        avg_daily_sales: Math.round(avgDailySales * 100) / 100,
        days_of_stock: daysOfStock
      };
    });

    const totalCapitalTied = products.reduce((s, p) => s + p.capital_tied, 0);
    const zeroSales = products.filter(p => Number(p.total_sold) === 0).length;
    const slowProducts = products.filter(p => Number(p.total_sold) > 0 && Number(p.total_sold) <= 5).length;

    res.json({
      days,
      summary: {
        total_products: products.length,
        zero_sales: zeroSales,
        slow_products: slowProducts,
        total_capital_tied: totalCapitalTied
      },
      products
    });
  } catch (err) {
    console.error('Slow moving report error:', err);
    res.status(500).json({ error: 'Gagal mengambil data produk slow moving.' });
  }
});

// ============ AUTO RESTOCK ALERT ============
router.get('/restock-alert', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString().slice(0, 10) + ' 00:00:00';

    const [products] = await pool.query(
      `SELECT p.id, p.name, p.stock, p.price, p.cost_price, p.unit, p.min_stock,
              COALESCE(c.name, 'Tanpa Kategori') as category_name,
              COALESCE(SUM(ti.qty), 0) as total_sold
       FROM products p
       LEFT JOIN transaction_items ti ON ti.product_id = p.id
       LEFT JOIN transactions t ON ti.transaction_id = t.id AND t.created_at >= ? AND (t.status IS NULL OR t.status = 'completed')
       LEFT JOIN categories c ON p.category_id = c.id
       GROUP BY p.id
       ORDER BY p.name ASC`,
      [cutoff]
    );

    const result = products.map(p => {
      const avgDailySales = (Number(p.total_sold) || 0) / days;
      const daysUntilStockout = avgDailySales > 0 ? Math.floor(Number(p.stock) / avgDailySales) : 9999;
      let urgency = 'aman';
      if (Number(p.stock) === 0) urgency = 'habis';
      else if (daysUntilStockout <= 3) urgency = 'kritis';
      else if (daysUntilStockout <= 7) urgency = 'segera';
      else if (daysUntilStockout <= 14) urgency = 'perhatian';
      return {
        id: p.id,
        name: p.name,
        stock: p.stock,
        unit: p.unit,
        min_stock: p.min_stock,
        category_name: p.category_name,
        cost_price: p.cost_price,
        price: p.price,
        total_sold: p.total_sold,
        avg_daily_sales: Math.round(avgDailySales * 100) / 100,
        days_until_stockout: daysUntilStockout,
        urgency
      };
    }).filter(p => p.urgency !== 'aman');

    result.sort((a, b) => {
      const order = { habis: 0, kritis: 1, segera: 2, perhatian: 3 };
      return (order[a.urgency] || 99) - (order[b.urgency] || 99) || a.days_until_stockout - b.days_until_stockout;
    });

    res.json({
      days,
      total_alerts: result.length,
      habis: result.filter(p => p.urgency === 'habis').length,
      kritis: result.filter(p => p.urgency === 'kritis').length,
      segera: result.filter(p => p.urgency === 'segera').length,
      perhatian: result.filter(p => p.urgency === 'perhatian').length,
      products: result
    });
  } catch (err) {
    console.error('Restock alert error:', err);
    res.status(500).json({ error: 'Gagal mengambil data restock alert.' });
  }
});

// ============ PROFIT-LOSS REPORT ============
router.get('/profit-loss', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { period, start_date, end_date } = req.query;
    
    let dateFilter = '';
    let expDateFilter = '';
    if (start_date && end_date) {
      dateFilter = `AND t.created_at >= '${start_date} 00:00:00' AND t.created_at <= '${end_date} 23:59:59'`;
      expDateFilter = `AND date >= '${start_date}' AND date <= '${end_date}'`;
    } else if (period === 'today') {
      dateFilter = 'AND DATE(t.created_at) = CURDATE()';
      expDateFilter = 'AND date = CURDATE()';
    } else if (period === 'week') {
      dateFilter = 'AND t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
      expDateFilter = 'AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      dateFilter = 'AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
      expDateFilter = 'AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    // Revenue & COGS from completed transactions
    const [revenue] = await pool.query(
      `SELECT COALESCE(SUM(t.total), 0) as total_revenue,
              COALESCE(SUM(t.tax_amount), 0) as total_tax,
              COALESCE(SUM(t.service_charge), 0) as total_service,
              COALESCE(SUM(t.discount), 0) as total_discount,
              COUNT(*) as total_transactions
       FROM transactions t 
       WHERE (t.status IS NULL OR t.status = 'completed') ${dateFilter}`
    );

    // HPP (Harga Pokok Penjualan / COGS)
    const [cogs] = await pool.query(
      `SELECT COALESCE(SUM(ti.cost_price * ti.qty), 0) as total_cogs
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE (t.status IS NULL OR t.status = 'completed') ${dateFilter}`
    );

    // Expenses
    const [expenses] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_expenses
       FROM expenses WHERE 1=1 ${expDateFilter}`
    );

    // Breakdown by product
    const [byProduct] = await pool.query(
      `SELECT ti.product_name, 
              SUM(ti.qty) as total_qty,
              SUM(ti.subtotal) as total_revenue,
              SUM(ti.cost_price * ti.qty) as total_cost,
              SUM(ti.subtotal) - SUM(ti.cost_price * ti.qty) as profit
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE (t.status IS NULL OR t.status = 'completed') ${dateFilter}
       GROUP BY ti.product_name 
       ORDER BY profit DESC`
    );

    // Expenses by category
    const [expByCategory] = await pool.query(
      `SELECT category, COALESCE(SUM(amount), 0) as total
       FROM expenses WHERE 1=1 ${expDateFilter}
       GROUP BY category ORDER BY total DESC`
    );

    // Stock Purchases (Pembelian Stok dari supplier)
    let spDateFilter = '';
    if (start_date && end_date) {
      spDateFilter = `AND sp.created_at >= '${start_date} 00:00:00' AND sp.created_at <= '${end_date} 23:59:59'`;
    } else if (period === 'today') {
      spDateFilter = 'AND DATE(sp.created_at) = CURDATE()';
    } else if (period === 'week') {
      spDateFilter = 'AND sp.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      spDateFilter = 'AND sp.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    const [stockPurchases] = await pool.query(
      `SELECT COALESCE(SUM(sp.total_amount), 0) as total_purchases
       FROM stock_purchases sp WHERE 1=1 ${spDateFilter}`
    );

    const [purchasesBySupplier] = await pool.query(
      `SELECT sp.supplier_name, COUNT(*) as total_invoices, COALESCE(SUM(sp.total_amount), 0) as total
       FROM stock_purchases sp WHERE 1=1 ${spDateFilter}
       GROUP BY sp.supplier_name ORDER BY total DESC`
    );

    // Daily trend (last 30 days or period)
    const [dailyTrend] = await pool.query(
      `SELECT DATE(t.created_at) as date,
              COALESCE(SUM(t.total), 0) as revenue,
              COALESCE(SUM(ti_agg.cogs), 0) as cogs
       FROM transactions t
       LEFT JOIN (
         SELECT transaction_id, SUM(cost_price * qty) as cogs
         FROM transaction_items GROUP BY transaction_id
       ) ti_agg ON ti_agg.transaction_id = t.id
       WHERE (t.status IS NULL OR t.status = 'completed') ${dateFilter}
       GROUP BY DATE(t.created_at)
       ORDER BY date DESC LIMIT 30`
    );

    const totalRevenue = Number(revenue[0].total_revenue) || 0;
    const totalCogs = Number(cogs[0].total_cogs) || 0;
    const totalExpenses = Number(expenses[0].total_expenses) || 0;
    const totalStockPurchases = Number(stockPurchases[0].total_purchases) || 0;
    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalExpenses;
    const cashIn = totalRevenue;
    const cashOut = totalStockPurchases + totalExpenses;
    const netCashFlow = cashIn - cashOut;

    res.json({
      summary: {
        total_revenue: totalRevenue,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        total_expenses: totalExpenses,
        total_stock_purchases: totalStockPurchases,
        net_profit: netProfit,
        net_cash_flow: netCashFlow,
        cash_in: cashIn,
        cash_out: cashOut,
        total_transactions: revenue[0].total_transactions || 0,
        total_tax: Number(revenue[0].total_tax) || 0,
        total_service: Number(revenue[0].total_service) || 0,
        total_discount: Number(revenue[0].total_discount) || 0,
        margin_percent: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0
      },
      by_product: byProduct,
      expenses_by_category: expByCategory,
      purchases_by_supplier: purchasesBySupplier,
      daily_trend: dailyTrend
    });
  } catch (err) {
    console.error('Profit-loss report error:', err);
    res.status(500).json({ error: 'Gagal mengambil laporan laba rugi.' });
  }
});

module.exports = router;
