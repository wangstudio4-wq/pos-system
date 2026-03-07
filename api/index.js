const express = require('express');
const cors = require('cors');

const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const authRoutes = require('../routes/auth');
const userRoutes = require('../routes/users');
const categoryRoutes = require('../routes/categories');
const customerRoutes = require('../routes/customers');
const expenseRoutes = require('../routes/expenses');
const shiftRoutes = require('../routes/shifts');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ============ AUTH & USER ROUTES ============
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/shifts', shiftRoutes);

// ============ DASHBOARD ============
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const role = req.user.role;

    // Today's stats
    const [todaySales] = await pool.query(
      `SELECT COUNT(*) as transactions, COALESCE(SUM(total), 0) as revenue 
       FROM transactions WHERE DATE(created_at) = CURDATE()`
    );

    // Products with low stock
    const [lowStock] = await pool.query(
      `SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND stock > 0`
    );

    const [outOfStock] = await pool.query(
      `SELECT COUNT(*) as count FROM products WHERE stock = 0`
    );

    // Total products
    const [totalProducts] = await pool.query('SELECT COUNT(*) as count FROM products');

    // Total customers
    const [totalCustomers] = await pool.query('SELECT COUNT(*) as count FROM customers');

    // Today's expenses
    const [todayExpenses] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date = CURDATE()`
    );

    // Sales chart (last 7 days)
    const [salesChart] = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as transactions, COALESCE(SUM(total), 0) as revenue
       FROM transactions 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at) ORDER BY date ASC`
    );

    // Recent transactions (last 5)
    const [recentTx] = await pool.query(
      `SELECT id, total, payment_method, user_name, customer_name, created_at 
       FROM transactions ORDER BY created_at DESC LIMIT 5`
    );

    // Top products today
    const [topToday] = await pool.query(
      `SELECT ti.product_name, SUM(ti.qty) as total_qty, SUM(ti.subtotal) as total_sales
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE DATE(t.created_at) = CURDATE()
       GROUP BY ti.product_name ORDER BY total_sales DESC LIMIT 5`
    );

    // Current shift for this user
    const [currentShift] = await pool.query(
      'SELECT * FROM shifts WHERE user_id = ? AND status = "open" LIMIT 1',
      [req.user.id]
    );

    res.json({
      today: {
        transactions: todaySales[0].transactions,
        revenue: todaySales[0].revenue,
        expenses: todayExpenses[0].total,
        profit: todaySales[0].revenue - todayExpenses[0].total
      },
      stock: {
        total: totalProducts[0].count,
        low: lowStock[0].count,
        out: outOfStock[0].count
      },
      customers: totalCustomers[0].count,
      sales_chart: salesChart,
      recent_transactions: recentTx,
      top_products_today: topToday,
      current_shift: currentShift.length > 0 ? currentShift[0] : null
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Gagal memuat dashboard.' });
  }
});

// ============ PRODUCT ROUTES ============

// GET all products (with category)
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.name as category_name, c.color as category_color 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       ORDER BY p.name ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Gagal mengambil data produk.' });
  }
});

// POST new product
app.post('/api/products', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { barcode, name, price, stock, category_id, min_stock } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nama dan harga produk wajib diisi.' });
    }

    const [result] = await pool.query(
      'INSERT INTO products (barcode, name, price, stock, category_id, min_stock) VALUES (?, ?, ?, ?, ?, ?)',
      [barcode || null, name, price, stock || 0, category_id || null, min_stock || 5]
    );

    res.status(201).json({
      message: 'Produk berhasil ditambahkan!',
      product: { id: result.insertId, barcode, name, price, stock: stock || 0 }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Barcode sudah digunakan produk lain.' });
    }
    console.error('Add product error:', err);
    res.status(500).json({ error: 'Gagal menambahkan produk.' });
  }
});

// PUT update product
app.put('/api/products/:id', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { barcode, name, price, stock, category_id, min_stock } = req.body;
    await pool.query(
      'UPDATE products SET barcode = ?, name = ?, price = ?, stock = ?, category_id = ?, min_stock = ? WHERE id = ?',
      [barcode || null, name, price, stock, category_id || null, min_stock || 5, req.params.id]
    );
    res.json({ message: 'Produk berhasil diupdate!' });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Gagal update produk.' });
  }
});

// DELETE product
app.delete('/api/products/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Produk berhasil dihapus!' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Gagal menghapus produk.' });
  }
});

// GET product by barcode
app.get('/api/products/barcode/:barcode', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.name as category_name FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.barcode = ?`, [req.params.barcode]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Get product by barcode error:', err);
    res.status(500).json({ error: 'Gagal mencari produk.' });
  }
});

// ============ TRANSACTION ROUTES ============

// POST new transaction (updated with payment method, customer, discount)
app.post('/api/transactions', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { items, subtotal, discount, total, payment, change, payment_method, customer_id, customer_name, notes } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || req.user.username;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang kosong.' });
    }

    const [txResult] = await conn.query(
      `INSERT INTO transactions (subtotal, discount, total, payment, \`change\`, payment_method, user_id, user_name, customer_id, customer_name, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subtotal || total, discount || 0, total, payment, change, payment_method || 'cash', userId, userName, customer_id || null, customer_name || null, notes || null]
    );

    const txId = txResult.insertId;

    for (const item of items) {
      await conn.query(
        'INSERT INTO transaction_items (transaction_id, product_id, product_name, price, qty, subtotal, discount) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [txId, item.id, item.name, item.price, item.qty, item.price * item.qty, item.discount || 0]
      );

      await conn.query(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [item.qty, item.id, item.qty]
      );
    }

    // Update customer stats if customer selected
    if (customer_id) {
      await conn.query(
        'UPDATE customers SET total_transactions = total_transactions + 1, total_spent = total_spent + ? WHERE id = ?',
        [total, customer_id]
      );
    }

    await conn.commit();

    res.status(201).json({
      message: 'Transaksi berhasil!',
      transaction: { id: txId, total, payment, change, payment_method: payment_method || 'cash', cashier: userName }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Transaction error:', err);
    res.status(500).json({ error: 'Gagal menyimpan transaksi.' });
  } finally {
    conn.release();
  }
});

// GET transactions
app.get('/api/transactions', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { date, start_date, end_date } = req.query;
    let query = 'SELECT * FROM transactions';
    let params = [];

    if (date) {
      query += ' WHERE DATE(created_at) = ?';
      params.push(date);
    } else if (start_date && end_date) {
      query += ' WHERE DATE(created_at) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: 'Gagal mengambil data transaksi.' });
  }
});

// GET transaction detail
app.get('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const [tx] = await pool.query('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (tx.length === 0) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    }

    const [items] = await pool.query(
      'SELECT * FROM transaction_items WHERE transaction_id = ?',
      [req.params.id]
    );

    res.json({ transaction: tx[0], items });
  } catch (err) {
    console.error('Get transaction detail error:', err);
    res.status(500).json({ error: 'Gagal mengambil detail transaksi.' });
  }
});

// GET sales report
app.get('/api/reports/sales', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { period } = req.query;

    let dateFilter = '';
    if (period === 'today') {
      dateFilter = 'WHERE DATE(created_at) = CURDATE()';
    } else if (period === 'week') {
      dateFilter = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      dateFilter = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    const [salesSummary] = await pool.query(
      `SELECT COUNT(*) as total_transactions, COALESCE(SUM(total), 0) as total_revenue,
       COALESCE(SUM(discount), 0) as total_discount
       FROM transactions ${dateFilter}`
    );

    const [perCashier] = await pool.query(
      `SELECT user_name, COUNT(*) as transactions, COALESCE(SUM(total), 0) as revenue 
       FROM transactions ${dateFilter} 
       GROUP BY user_name ORDER BY revenue DESC`
    );

    const [topProducts] = await pool.query(
      `SELECT ti.product_name, SUM(ti.qty) as total_qty, SUM(ti.subtotal) as total_sales
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       ${dateFilter.replace('created_at', 't.created_at')}
       GROUP BY ti.product_name ORDER BY total_sales DESC LIMIT 10`
    );

    // Payment method breakdown
    const [byPayment] = await pool.query(
      `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as total
       FROM transactions ${dateFilter}
       GROUP BY payment_method ORDER BY total DESC`
    );

    res.json({
      summary: salesSummary[0],
      per_cashier: perCashier,
      top_products: topProducts,
      by_payment: byPayment
    });
  } catch (err) {
    console.error('Sales report error:', err);
    res.status(500).json({ error: 'Gagal mengambil laporan.' });
  }
});

module.exports = app;
