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

// Serve PWA files
app.get('/manifest.json', (req, res) => {
  res.json({
    name: "KasirPro - Sistem POS",
    short_name: "KasirPro",
    description: "Aplikasi Point of Sale untuk toko kelontong",
    start_url: "/",
    display: "standalone",
    background_color: "#111D13",
    theme_color: "#415D43",
    orientation: "any",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  });
});

app.get('/sw.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(`const CACHE_NAME='kasirpro-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(['/','/manifest.json'])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.url.includes('/api/')){e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));return}e.respondWith(caches.match(e.request).then(c=>{const f=fetch(e.request).then(r=>{const cl=r.clone();caches.open(CACHE_NAME).then(ca=>ca.put(e.request,cl));return r}).catch(()=>c);return c||f}))});`);
});

app.get('/icons/:file', (req, res) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="80" fill="#415D43"/>
    <text x="256" y="340" text-anchor="middle" font-size="280" font-family="sans-serif" fill="white">🏪</text>
  </svg>`;
  res.set('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// ============ AUTH & USER ROUTES ============
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/shifts', shiftRoutes);

// ============ SETUP: Auto-init database ============
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

// Check setup status (no auth needed)
app.get('/api/setup/status', async (req, res) => {
  try {
    // Check if users table exists and has users
    let tablesReady = false;
    let hasUsers = false;
    try {
      const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM users');
      tablesReady = true;
      hasUsers = rows[0].cnt > 0;
    } catch (e) {
      tablesReady = false;
    }
    res.json({ tablesReady, hasUsers });
  } catch (err) {
    res.json({ tablesReady: false, hasUsers: false });
  }
});

// Public store info (for login page branding)
app.get('/api/store-info', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT store_name, store_logo_url FROM settings WHERE id = 1');
    res.json(rows[0] || { store_name: 'KasirPro', store_logo_url: null });
  } catch (err) {
    res.json({ store_name: 'KasirPro', store_logo_url: null });
  }
});

// Auto-init database tables
app.post('/api/setup/init', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    try {
      // Core tables
      await conn.query(`CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role ENUM('owner','admin','kasir') DEFAULT 'kasir',
        pin VARCHAR(255) DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(7) DEFAULT '#2563eb',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(15,2) NOT NULL,
        cost_price DECIMAL(15,2) DEFAULT 0,
        stock INT DEFAULT 0,
        category_id INT DEFAULT NULL,
        image_url VARCHAR(500) DEFAULT NULL,
        min_stock INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        email VARCHAR(100) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        points INT DEFAULT 0,
        total_transactions INT DEFAULT 0,
        total_spent DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        user_name VARCHAR(100) DEFAULT NULL,
        total DECIMAL(15,2) NOT NULL,
        payment_method VARCHAR(20) DEFAULT 'cash',
        customer_id INT DEFAULT NULL,
        customer_name VARCHAR(100) DEFAULT NULL,
        discount DECIMAL(15,2) DEFAULT 0,
        subtotal DECIMAL(15,2) DEFAULT 0,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS transaction_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(100) NOT NULL,
        price DECIMAL(15,2) NOT NULL,
        cost_price DECIMAL(15,2) DEFAULT 0,
        qty INT NOT NULL,
        subtotal DECIMAL(15,2) NOT NULL,
        discount DECIMAL(15,2) DEFAULT 0
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS shifts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        opening_cash DECIMAL(15,2) DEFAULT 0,
        closing_cash DECIMAL(15,2) DEFAULT NULL,
        expected_cash DECIMAL(15,2) DEFAULT NULL,
        total_sales DECIMAL(15,2) DEFAULT 0,
        total_transactions INT DEFAULT 0,
        notes TEXT DEFAULT NULL,
        status ENUM('open','closed') DEFAULT 'open',
        opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP DEFAULT NULL
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        user_id INT NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        date DATE DEFAULT (CURRENT_DATE),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY DEFAULT 1,
        store_name VARCHAR(100) DEFAULT 'KasirPro',
        store_address TEXT DEFAULT NULL,
        store_phone VARCHAR(20) DEFAULT NULL,
        tax_enabled TINYINT(1) DEFAULT 0,
        tax_name VARCHAR(50) DEFAULT 'PB1',
        tax_rate DECIMAL(5,2) DEFAULT 10.00,
        service_charge_enabled TINYINT(1) DEFAULT 0,
        service_charge_rate DECIMAL(5,2) DEFAULT 5.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CHECK (id = 1)
      )`);
      await conn.query(`INSERT IGNORE INTO settings (id) VALUES (1)`);

      // Default categories
      await conn.query(`INSERT IGNORE INTO categories (id, name, color) VALUES
        (1, 'Makanan', '#ef4444'),
        (2, 'Minuman', '#3b82f6'),
        (3, 'Snack', '#f59e0b'),
        (4, 'Lainnya', '#6b7280')`);

      conn.release();
      res.json({ success: true, message: 'Database berhasil diinisialisasi!' });
    } catch (e) {
      conn.release();
      throw e;
    }
  } catch (err) {
    console.error('Setup init error:', err);
    res.status(500).json({ error: 'Gagal inisialisasi database: ' + err.message });
  }
});

// Register first owner (only if no users exist)
app.post('/api/auth/register-owner', async (req, res) => {
  try {
    const { name, username, password, store_name } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Nama, username, dan password wajib diisi.' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password minimal 4 karakter.' });
    }

    // Check if any user exists
    const [existing] = await pool.query('SELECT COUNT(*) as cnt FROM users');
    if (existing[0].cnt > 0) {
      return res.status(400).json({ error: 'Owner sudah terdaftar. Silakan login.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, name, role, is_active) VALUES (?, ?, ?, ?, 1)',
      [username, hashedPassword, name, 'owner']
    );

    const token = jwt.sign(
      { id: result.insertId, username, role: 'owner', name },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      message: 'Registrasi berhasil! Selamat datang di KasirPro.',
      token,
      user: { id: result.insertId, username, name, role: 'owner' }
    });
  } catch (err) {
    console.error('Register owner error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username sudah dipakai.' });
    }
    res.status(500).json({ error: 'Gagal registrasi: ' + err.message });
  }
});

// ============ DEBUG: Check DB schema ============
app.get('/api/debug/schema', authenticateToken, async (req, res) => {
  try {
    const tables = ['users', 'products', 'transactions', 'transaction_items', 'categories', 'customers', 'shifts', 'expenses'];
    const schema = {};
    for (const table of tables) {
      try {
        const [cols] = await pool.query(`SHOW COLUMNS FROM ${table}`);
        schema[table] = cols.map(c => c.Field);
      } catch (e) {
        schema[table] = 'TABLE NOT FOUND';
      }
    }
    res.json(schema);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ AUTO MIGRATION ============
// Run migration on startup
async function runAutoMigrate() {
  const safeExec = async (label, sql) => {
    try { await pool.query(sql); console.log(`✅ ${label}`); }
    catch (e) { console.log(`⚠️ ${label}: ${e.message}`); }
  };

  await safeExec('Create categories', `CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#2563eb', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await safeExec('Create customers', `CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL, email VARCHAR(100) DEFAULT NULL,
    address TEXT DEFAULT NULL, points INT DEFAULT 0,
    total_transactions INT DEFAULT 0, total_spent DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
  await safeExec('Create shifts', `CREATE TABLE IF NOT EXISTS shifts (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
    user_name VARCHAR(100) NOT NULL, opening_cash DECIMAL(15,2) DEFAULT 0,
    closing_cash DECIMAL(15,2) DEFAULT NULL, expected_cash DECIMAL(15,2) DEFAULT NULL,
    total_sales DECIMAL(15,2) DEFAULT 0, total_transactions INT DEFAULT 0,
    notes TEXT DEFAULT NULL, status ENUM('open','closed') DEFAULT 'open',
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, closed_at TIMESTAMP DEFAULT NULL)`);
  await safeExec('Create expenses', `CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY, category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL, amount DECIMAL(15,2) NOT NULL,
    user_id INT NOT NULL, user_name VARCHAR(100) NOT NULL,
    date DATE DEFAULT (CURRENT_DATE), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await safeExec('products.category_id', `ALTER TABLE products ADD COLUMN category_id INT DEFAULT NULL`);
  await safeExec('products.image_url', `ALTER TABLE products ADD COLUMN image_url VARCHAR(500) DEFAULT NULL`);
  await safeExec('products.min_stock', `ALTER TABLE products ADD COLUMN min_stock INT DEFAULT 5`);
  await safeExec('products.cost_price', `ALTER TABLE products ADD COLUMN cost_price DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transaction_items.cost_price', `ALTER TABLE transaction_items ADD COLUMN cost_price DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transactions.payment_method', `ALTER TABLE transactions ADD COLUMN payment_method VARCHAR(20) DEFAULT 'cash'`);
  await safeExec('transactions.customer_id', `ALTER TABLE transactions ADD COLUMN customer_id INT DEFAULT NULL`);
  await safeExec('transactions.customer_name', `ALTER TABLE transactions ADD COLUMN customer_name VARCHAR(100) DEFAULT NULL`);
  await safeExec('transactions.discount', `ALTER TABLE transactions ADD COLUMN discount DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transactions.subtotal', `ALTER TABLE transactions ADD COLUMN subtotal DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transactions.notes', `ALTER TABLE transactions ADD COLUMN notes TEXT DEFAULT NULL`);
  await safeExec('transactions.user_name', `ALTER TABLE transactions ADD COLUMN user_name VARCHAR(100) DEFAULT NULL`);
  // Backfill NULL user_name from users table
  await safeExec('backfill.user_name', `UPDATE transactions t JOIN users u ON t.user_id = u.id SET t.user_name = COALESCE(u.name, u.username) WHERE (t.user_name IS NULL OR t.user_name = '') AND t.user_id IS NOT NULL`);
  await safeExec('transactions.created_at', `ALTER TABLE transactions ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await safeExec('transaction_items.discount', `ALTER TABLE transaction_items ADD COLUMN discount DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transactions.status', `ALTER TABLE transactions ADD COLUMN status VARCHAR(20) DEFAULT 'completed'`);
  await safeExec('transactions.void_reason', `ALTER TABLE transactions ADD COLUMN void_reason TEXT DEFAULT NULL`);
  await safeExec('transactions.voided_by', `ALTER TABLE transactions ADD COLUMN voided_by VARCHAR(100) DEFAULT NULL`);
  await safeExec('transactions.voided_at', `ALTER TABLE transactions ADD COLUMN voided_at TIMESTAMP NULL DEFAULT NULL`);
  await safeExec('transactions.tax_amount', `ALTER TABLE transactions ADD COLUMN tax_amount DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transactions.tax_name', `ALTER TABLE transactions ADD COLUMN tax_name VARCHAR(50) DEFAULT NULL`);
  await safeExec('transactions.tax_rate', `ALTER TABLE transactions ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0`);
  await safeExec('transactions.service_charge', `ALTER TABLE transactions ADD COLUMN service_charge DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transactions.service_charge_rate', `ALTER TABLE transactions ADD COLUMN service_charge_rate DECIMAL(5,2) DEFAULT 0`);
  await safeExec('Create settings', `CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY DEFAULT 1, store_name VARCHAR(100) DEFAULT 'KasirPro',
    store_address TEXT DEFAULT NULL, store_phone VARCHAR(20) DEFAULT NULL,
    tax_enabled TINYINT(1) DEFAULT 0, tax_name VARCHAR(50) DEFAULT 'PB1',
    tax_rate DECIMAL(5,2) DEFAULT 10.00, service_charge_enabled TINYINT(1) DEFAULT 0,
    service_charge_rate DECIMAL(5,2) DEFAULT 5.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
  await safeExec('Default settings', `INSERT IGNORE INTO settings (id) VALUES (1)`);
  await safeExec('settings.receipt_footer', `ALTER TABLE settings ADD COLUMN receipt_footer VARCHAR(255) DEFAULT 'Terima kasih telah berbelanja!'`);
  await safeExec('settings.store_logo_url', `ALTER TABLE settings ADD COLUMN store_logo_url VARCHAR(500) DEFAULT NULL`);
  await safeExec('Default categories', `INSERT IGNORE INTO categories (id, name, color) VALUES
    (1,'Makanan','#ef4444'),(2,'Minuman','#3b82f6'),(3,'Snack','#f59e0b'),(4,'Lainnya','#6b7280')`);
  // Fix: rename quantity → qty if old column exists
  await safeExec('transaction_items.quantity→qty', `ALTER TABLE transaction_items CHANGE COLUMN quantity qty INT NOT NULL`);
  // Add PIN column for kasir login
  await safeExec('users.pin', `ALTER TABLE users ADD COLUMN pin VARCHAR(255) DEFAULT NULL`);
  console.log('✅ Auto-migrate completed');
}
runAutoMigrate().catch(err => console.error('Migration error:', err));

app.get('/api/auto-migrate', authenticateToken, authorizeRole('owner'), async (req, res) => {
  const results = [];
  const safeExec = async (label, sql) => {
    try { await pool.query(sql); results.push(`✅ ${label}`); }
    catch (e) { results.push(`⚠️ ${label}: ${e.message}`); }
  };

  await safeExec('Create categories', `CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#2563eb', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await safeExec('Create customers', `CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL, email VARCHAR(100) DEFAULT NULL,
    address TEXT DEFAULT NULL, points INT DEFAULT 0,
    total_transactions INT DEFAULT 0, total_spent DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
  await safeExec('Create shifts', `CREATE TABLE IF NOT EXISTS shifts (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
    user_name VARCHAR(100) NOT NULL, opening_cash DECIMAL(15,2) DEFAULT 0,
    closing_cash DECIMAL(15,2) DEFAULT NULL, expected_cash DECIMAL(15,2) DEFAULT NULL,
    total_sales DECIMAL(15,2) DEFAULT 0, total_transactions INT DEFAULT 0,
    notes TEXT DEFAULT NULL, status ENUM('open','closed') DEFAULT 'open',
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, closed_at TIMESTAMP DEFAULT NULL)`);
  await safeExec('Create expenses', `CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY, category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL, amount DECIMAL(15,2) NOT NULL,
    user_id INT NOT NULL, user_name VARCHAR(100) NOT NULL,
    date DATE DEFAULT (CURRENT_DATE), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await safeExec('products.category_id', `ALTER TABLE products ADD COLUMN category_id INT DEFAULT NULL`);
  await safeExec('products.image_url', `ALTER TABLE products ADD COLUMN image_url VARCHAR(500) DEFAULT NULL`);
  await safeExec('products.min_stock', `ALTER TABLE products ADD COLUMN min_stock INT DEFAULT 5`);
  await safeExec('products.cost_price', `ALTER TABLE products ADD COLUMN cost_price DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transaction_items.cost_price', `ALTER TABLE transaction_items ADD COLUMN cost_price DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transactions.payment_method', `ALTER TABLE transactions ADD COLUMN payment_method VARCHAR(20) DEFAULT 'cash'`);
  await safeExec('transactions.customer_id', `ALTER TABLE transactions ADD COLUMN customer_id INT DEFAULT NULL`);
  await safeExec('transactions.customer_name', `ALTER TABLE transactions ADD COLUMN customer_name VARCHAR(100) DEFAULT NULL`);
  await safeExec('transactions.discount', `ALTER TABLE transactions ADD COLUMN discount DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transactions.subtotal', `ALTER TABLE transactions ADD COLUMN subtotal DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transactions.notes', `ALTER TABLE transactions ADD COLUMN notes TEXT DEFAULT NULL`);
  await safeExec('transactions.user_name', `ALTER TABLE transactions ADD COLUMN user_name VARCHAR(100) DEFAULT NULL`);
  // Backfill NULL user_name from users table
  await safeExec('backfill.user_name', `UPDATE transactions t JOIN users u ON t.user_id = u.id SET t.user_name = COALESCE(u.name, u.username) WHERE (t.user_name IS NULL OR t.user_name = '') AND t.user_id IS NOT NULL`);
  await safeExec('transactions.created_at', `ALTER TABLE transactions ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await safeExec('transaction_items.discount', `ALTER TABLE transaction_items ADD COLUMN discount DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transactions.status', `ALTER TABLE transactions ADD COLUMN status VARCHAR(20) DEFAULT 'completed'`);
  await safeExec('transactions.void_reason', `ALTER TABLE transactions ADD COLUMN void_reason TEXT DEFAULT NULL`);
  await safeExec('transactions.voided_by', `ALTER TABLE transactions ADD COLUMN voided_by VARCHAR(100) DEFAULT NULL`);
  await safeExec('transactions.voided_at', `ALTER TABLE transactions ADD COLUMN voided_at TIMESTAMP NULL DEFAULT NULL`);
  await safeExec('transactions.tax_amount', `ALTER TABLE transactions ADD COLUMN tax_amount DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transactions.tax_name', `ALTER TABLE transactions ADD COLUMN tax_name VARCHAR(50) DEFAULT NULL`);
  await safeExec('transactions.tax_rate', `ALTER TABLE transactions ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0`);
  await safeExec('transactions.service_charge', `ALTER TABLE transactions ADD COLUMN service_charge DECIMAL(15,2) DEFAULT 0`);
  await safeExec('transactions.service_charge_rate', `ALTER TABLE transactions ADD COLUMN service_charge_rate DECIMAL(5,2) DEFAULT 0`);
  await safeExec('Create settings', `CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY DEFAULT 1, store_name VARCHAR(100) DEFAULT 'KasirPro',
    store_address TEXT DEFAULT NULL, store_phone VARCHAR(20) DEFAULT NULL,
    tax_enabled TINYINT(1) DEFAULT 0, tax_name VARCHAR(50) DEFAULT 'PB1',
    tax_rate DECIMAL(5,2) DEFAULT 10.00, service_charge_enabled TINYINT(1) DEFAULT 0,
    service_charge_rate DECIMAL(5,2) DEFAULT 5.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
  await safeExec('Default settings', `INSERT IGNORE INTO settings (id) VALUES (1)`);
  await safeExec('settings.receipt_footer', `ALTER TABLE settings ADD COLUMN receipt_footer VARCHAR(255) DEFAULT 'Terima kasih telah berbelanja!'`);
  await safeExec('settings.store_logo_url', `ALTER TABLE settings ADD COLUMN store_logo_url VARCHAR(500) DEFAULT NULL`);
  await safeExec('Default categories', `INSERT IGNORE INTO categories (id, name, color) VALUES
    (1,'Makanan','#ef4444'),(2,'Minuman','#3b82f6'),(3,'Snack','#f59e0b'),(4,'Lainnya','#6b7280')`);
  // Fix: rename quantity → qty if old column exists
  await safeExec('transaction_items.quantity→qty', `ALTER TABLE transaction_items CHANGE COLUMN quantity qty INT NOT NULL`);
  // Add PIN column for kasir login
  await safeExec('users.pin', `ALTER TABLE users ADD COLUMN pin VARCHAR(255) DEFAULT NULL`);
  res.json({ results });
});

// ============ DASHBOARD ============
app.get('/api/dashboard', authenticateToken, async (req, res) => {
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
    const totalCustomers = await safeQuery('SELECT COUNT(*) as count FROM customers') || [{ count: 0 }];
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
      customers: totalCustomers[0].count,
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

// ============ PRODUCT ROUTES ============

// GET low stock products
app.get('/api/products/low-stock', authenticateToken, async (req, res) => {
  try {
    const products = await pool.query(
      'SELECT id, name, stock, min_stock, price, cost_price FROM products WHERE stock <= min_stock ORDER BY stock ASC'
    );
    res.json(products[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    const { barcode, name, price, cost_price, stock, category_id, min_stock } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nama dan harga produk wajib diisi.' });
    }

    const [result] = await pool.query(
      'INSERT INTO products (barcode, name, price, cost_price, stock, category_id, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [barcode || null, name, price, cost_price || 0, stock || 0, category_id || null, min_stock || 5]
    );

    res.status(201).json({
      message: 'Produk berhasil ditambahkan!',
      product: { id: result.insertId, barcode, name, price, cost_price: cost_price || 0, stock: stock || 0 }
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
    const { barcode, name, price, cost_price, stock, category_id, min_stock } = req.body;
    await pool.query(
      'UPDATE products SET barcode = ?, name = ?, price = ?, cost_price = ?, stock = ?, category_id = ?, min_stock = ? WHERE id = ?',
      [barcode || null, name, price, cost_price || 0, stock, category_id || null, min_stock || 5, req.params.id]
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

// ============ SETTINGS ============
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1');
    res.json(rows[0] || {});
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Gagal mengambil settings.' });
  }
});

app.put('/api/settings', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { store_name, store_address, store_phone, tax_enabled, tax_name, tax_rate, service_charge_enabled, service_charge_rate, receipt_footer, store_logo_url } = req.body;
    await pool.query(
      `UPDATE settings SET store_name=?, store_address=?, store_phone=?, tax_enabled=?, tax_name=?, tax_rate=?, service_charge_enabled=?, service_charge_rate=?, receipt_footer=?, store_logo_url=? WHERE id = 1`,
      [store_name || 'KasirPro', store_address || null, store_phone || null, tax_enabled ? 1 : 0, tax_name || 'PB1', tax_rate || 10, service_charge_enabled ? 1 : 0, service_charge_rate || 5, receipt_footer || 'Terima kasih telah berbelanja!', store_logo_url || null]
    );
    const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1');
    res.json({ message: 'Settings berhasil disimpan!', settings: rows[0] });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Gagal menyimpan settings.' });
  }
});

// POST new transaction (updated with payment method, customer, discount)
app.post('/api/transactions', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { items, subtotal, discount, total, payment, change, payment_method, customer_id, customer_name, notes, tax_amount, tax_name, tax_rate, service_charge, service_charge_rate } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || req.user.username;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang kosong.' });
    }

    const [txResult] = await conn.query(
      `INSERT INTO transactions (subtotal, discount, total, payment, \`change\`, payment_method, user_id, user_name, customer_id, customer_name, notes, tax_amount, tax_name, tax_rate, service_charge, service_charge_rate) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subtotal || total, discount || 0, total, payment, change, payment_method || 'cash', userId, userName, customer_id || null, customer_name || null, notes || null, tax_amount || 0, tax_name || null, tax_rate || 0, service_charge || 0, service_charge_rate || 0]
    );

    const txId = txResult.insertId;

    for (const item of items) {
      await conn.query(
        'INSERT INTO transaction_items (transaction_id, product_id, product_name, price, cost_price, qty, subtotal, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [txId, item.id, item.name, item.price, item.cost_price || 0, item.qty, item.price * item.qty, item.discount || 0]
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

// GET my transactions (for kasir - only their own)
app.get('/api/my-transactions', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    res.json({ transactions: rows });
  } catch (err) {
    console.error('Get my transactions error:', err);
    res.status(500).json({ error: 'Gagal mengambil data transaksi.' });
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

// VOID transaction
app.post('/api/transactions/:id/void', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Alasan void wajib diisi.' });

    const [tx] = await conn.query('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (tx.length === 0) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (tx[0].status === 'void') return res.status(400).json({ error: 'Transaksi sudah di-void.' });
    if (tx[0].status === 'refund') return res.status(400).json({ error: 'Transaksi sudah di-refund.' });

    // Restore stock
    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [req.params.id]);
    for (const item of items) {
      await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.qty || item.quantity, item.product_id]);
    }

    // Update customer stats
    if (tx[0].customer_id) {
      await conn.query('UPDATE customers SET total_transactions = total_transactions - 1, total_spent = total_spent - ? WHERE id = ?', [tx[0].total, tx[0].customer_id]);
    }

    await conn.query(
      'UPDATE transactions SET status = ?, void_reason = ?, voided_by = ?, voided_at = NOW() WHERE id = ?',
      ['void', reason, req.user.name || req.user.username, req.params.id]
    );

    await conn.commit();
    res.json({ message: 'Transaksi berhasil di-void.' });
  } catch (err) {
    await conn.rollback();
    console.error('Void error:', err);
    res.status(500).json({ error: 'Gagal void transaksi.' });
  } finally { conn.release(); }
});

// REFUND transaction
app.post('/api/transactions/:id/refund', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Alasan refund wajib diisi.' });

    const [tx] = await conn.query('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (tx.length === 0) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (tx[0].status === 'void') return res.status(400).json({ error: 'Transaksi sudah di-void.' });
    if (tx[0].status === 'refund') return res.status(400).json({ error: 'Transaksi sudah di-refund.' });

    // Restore stock
    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [req.params.id]);
    for (const item of items) {
      await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.qty || item.quantity, item.product_id]);
    }

    // Update customer stats
    if (tx[0].customer_id) {
      await conn.query('UPDATE customers SET total_transactions = total_transactions - 1, total_spent = total_spent - ? WHERE id = ?', [tx[0].total, tx[0].customer_id]);
    }

    await conn.query(
      'UPDATE transactions SET status = ?, void_reason = ?, voided_by = ?, voided_at = NOW() WHERE id = ?',
      ['refund', reason, req.user.name || req.user.username, req.params.id]
    );

    await conn.commit();
    res.json({ message: 'Transaksi berhasil di-refund.' });
  } catch (err) {
    await conn.rollback();
    console.error('Refund error:', err);
    res.status(500).json({ error: 'Gagal refund transaksi.' });
  } finally { conn.release(); }
});

// GET sales report
app.get('/api/reports/sales', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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

// ============ PROFIT-LOSS REPORT ============
app.get('/api/reports/profit-loss', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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
    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalExpenses;

    res.json({
      summary: {
        total_revenue: totalRevenue,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        total_transactions: revenue[0].total_transactions || 0,
        total_tax: Number(revenue[0].total_tax) || 0,
        total_service: Number(revenue[0].total_service) || 0,
        total_discount: Number(revenue[0].total_discount) || 0,
        margin_percent: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0
      },
      by_product: byProduct,
      expenses_by_category: expByCategory,
      daily_trend: dailyTrend
    });
  } catch (err) {
    console.error('Profit-loss report error:', err);
    res.status(500).json({ error: 'Gagal mengambil laporan laba rugi.' });
  }
});


module.exports = app;
