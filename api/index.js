const express = require('express');
const cors = require('cors');

const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const authRoutes = require('../routes/auth');
const userRoutes = require('../routes/users');
const categoryRoutes = require('../routes/categories');
// const customerRoutes = require('../routes/customers'); // Removed - will be replaced by Member & Reward system
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
// app.use('/api/customers', customerRoutes); // Removed - will be replaced by Member & Reward system
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

      // Fase 2: Stock management tables
      await conn.query(`CREATE TABLE IF NOT EXISTS suppliers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        email VARCHAR(100) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS stock_purchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_number VARCHAR(50) DEFAULT NULL,
        supplier_id INT DEFAULT NULL,
        supplier_name VARCHAR(100) DEFAULT NULL,
        user_id INT NOT NULL,
        user_name VARCHAR(100) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        total_amount DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS stock_purchase_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(100) NOT NULL,
        qty INT NOT NULL,
        cost_price DECIMAL(15,2) DEFAULT 0,
        subtotal DECIMAL(15,2) DEFAULT 0
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS stock_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        product_name VARCHAR(100) DEFAULT NULL,
        type ENUM('purchase','sale','void','refund','opname','adjustment','manual') NOT NULL,
        qty INT NOT NULL,
        before_stock INT DEFAULT 0,
        after_stock INT DEFAULT 0,
        reference_type VARCHAR(50) DEFAULT NULL,
        reference_id INT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        user_id INT DEFAULT NULL,
        user_name VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS stock_opname (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        user_name VARCHAR(100) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        status ENUM('draft','completed') DEFAULT 'draft',
        total_items INT DEFAULT 0,
        total_difference INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL DEFAULT NULL
      )`);

      await conn.query(`CREATE TABLE IF NOT EXISTS stock_opname_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        opname_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(100) NOT NULL,
        system_stock INT DEFAULT 0,
        actual_stock INT DEFAULT 0,
        difference INT DEFAULT 0,
        notes TEXT DEFAULT NULL
      )`);

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
    const tables = ['users', 'products', 'transactions', 'transaction_items', 'categories', 'customers', 'shifts', 'expenses', 'suppliers', 'stock_purchases', 'stock_purchase_items', 'stock_movements', 'stock_opname', 'stock_opname_items'];
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
  await safeExec('products.barcode', `ALTER TABLE products ADD COLUMN barcode VARCHAR(50) DEFAULT NULL`);
  await safeExec('products.barcode_unique', `ALTER TABLE products ADD UNIQUE INDEX idx_barcode (barcode)`);
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
  await safeExec('users.fix_is_active', `UPDATE users SET is_active = 1 WHERE is_active IS NULL`);
  await safeExec('users.default_is_active', `ALTER TABLE users ALTER COLUMN is_active SET DEFAULT 1`);
  // Fase 2: Stock management tables
  await safeExec('Create suppliers', `CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL, email VARCHAR(100) DEFAULT NULL,
    address TEXT DEFAULT NULL, notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await safeExec('Create stock_purchases', `CREATE TABLE IF NOT EXISTS stock_purchases (
    id INT AUTO_INCREMENT PRIMARY KEY, invoice_number VARCHAR(50) DEFAULT NULL,
    supplier_id INT DEFAULT NULL, supplier_name VARCHAR(100) DEFAULT NULL,
    user_id INT NOT NULL, user_name VARCHAR(100) DEFAULT NULL,
    notes TEXT DEFAULT NULL, total_amount DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await safeExec('Create stock_purchase_items', `CREATE TABLE IF NOT EXISTS stock_purchase_items (
    id INT AUTO_INCREMENT PRIMARY KEY, purchase_id INT NOT NULL,
    product_id INT NOT NULL, product_name VARCHAR(100) NOT NULL,
    qty INT NOT NULL, cost_price DECIMAL(15,2) DEFAULT 0,
    subtotal DECIMAL(15,2) DEFAULT 0)`);
  await safeExec('Create stock_movements', `CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL,
    product_name VARCHAR(100) DEFAULT NULL,
    type ENUM('purchase','sale','void','refund','opname','adjustment','manual') NOT NULL,
    qty INT NOT NULL, before_stock INT DEFAULT 0, after_stock INT DEFAULT 0,
    reference_type VARCHAR(50) DEFAULT NULL, reference_id INT DEFAULT NULL,
    notes TEXT DEFAULT NULL, user_id INT DEFAULT NULL, user_name VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await safeExec('Create stock_opname', `CREATE TABLE IF NOT EXISTS stock_opname (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
    user_name VARCHAR(100) DEFAULT NULL, notes TEXT DEFAULT NULL,
    status ENUM('draft','completed') DEFAULT 'draft',
    total_items INT DEFAULT 0, total_difference INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL)`);
  await safeExec('Create stock_opname_items', `CREATE TABLE IF NOT EXISTS stock_opname_items (
    id INT AUTO_INCREMENT PRIMARY KEY, opname_id INT NOT NULL,
    product_id INT NOT NULL, product_name VARCHAR(100) NOT NULL,
    system_stock INT DEFAULT 0, actual_stock INT DEFAULT 0,
    difference INT DEFAULT 0, notes TEXT DEFAULT NULL)`);
  // Fase 2B: Multi-satuan
  await safeExec('products.unit', `ALTER TABLE products ADD COLUMN unit VARCHAR(20) DEFAULT 'pcs'`);
  await safeExec('products.purchase_unit', `ALTER TABLE products ADD COLUMN purchase_unit VARCHAR(20) DEFAULT NULL`);
  await safeExec('products.conversion_ratio', `ALTER TABLE products ADD COLUMN conversion_ratio DECIMAL(10,4) DEFAULT 1`);
  // Fase 2B: Harga Grosir
  await safeExec('Create price_tiers', `CREATE TABLE IF NOT EXISTS price_tiers (
    id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL,
    min_qty INT NOT NULL, price DECIMAL(15,2) NOT NULL,
    UNIQUE KEY unique_tier (product_id, min_qty))`);
  // Fase 2B: Kasbon
  await safeExec('Create debts', `CREATE TABLE IF NOT EXISTS debts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) DEFAULT NULL,
    transaction_id INT DEFAULT NULL,
    amount DECIMAL(15,2) NOT NULL,
    paid DECIMAL(15,2) DEFAULT 0,
    remaining DECIMAL(15,2) NOT NULL,
    status ENUM('unpaid','partial','paid') DEFAULT 'unpaid',
    notes TEXT DEFAULT NULL,
    user_id INT NOT NULL, user_name VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
  await safeExec('Create debt_payments', `CREATE TABLE IF NOT EXISTS debt_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    debt_id INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'Cash',
    notes TEXT DEFAULT NULL,
    user_id INT NOT NULL, user_name VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await safeExec('Create product_discounts', `CREATE TABLE IF NOT EXISTS product_discounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    discount_type ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
    discount_value DECIMAL(15,2) NOT NULL,
    min_qty INT DEFAULT 1,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  console.log('✅ Auto-migrate completed');
}
const migrationReady = runAutoMigrate().catch(err => console.error('Migration error:', err));
// Ensure migration completes before handling any request (critical for Vercel serverless)
app.use(async (req, res, next) => { await migrationReady; next(); });

// ============ SERVICE WORKER ============
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.send(`
const CACHE_NAME = 'kasirpro-v1';
const STATIC_ASSETS = ['/'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return resp;
    })).catch(() => caches.match('/'))
  );
});
  `);
});

// ============ OFFLINE SYNC ============
app.post('/api/sync/transactions', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { transactions: offlineTxs } = req.body;
    if (!Array.isArray(offlineTxs) || offlineTxs.length === 0) {
      return res.json({ synced: 0, results: [] });
    }
    const results = [];
    for (const tx of offlineTxs) {
      try {
        await conn.beginTransaction();
        const [txResult] = await conn.query(
          `INSERT INTO transactions (user_id, user_name, total, payment_method, customer_name, discount, subtotal, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [req.user.id, req.user.name || req.user.username, tx.total, tx.payment_method,
           tx.customer_name || 'Umum', tx.discount || 0, tx.subtotal || tx.total, tx.notes || '',
           tx.created_at || new Date()]
        );
        const txId = txResult.insertId;
        for (const item of (tx.items || [])) {
          await conn.query(
            `INSERT INTO transaction_items (transaction_id, product_id, product_name, price, cost_price, qty, subtotal, discount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [txId, item.id, item.name, item.price, item.cost_price || 0, item.qty,
             item.price * item.qty - (item.discount || 0), item.discount || 0]
          );
          await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.qty, item.id]);
        }
        if (tx.payment_method === 'Hutang' && tx.customer_name) {
          await conn.query(
            `INSERT INTO debts (customer_name, customer_phone, transaction_id, total_amount, remaining_amount, status)
             VALUES (?, ?, ?, ?, ?, 'unpaid')`,
            [tx.customer_name, tx.customer_phone || null, txId, tx.total, tx.total]
          );
        }
        await conn.commit();
        results.push({ offline_id: tx.offline_id, server_id: txId, status: 'ok' });
      } catch (itemErr) {
        await conn.rollback();
        results.push({ offline_id: tx.offline_id, status: 'error', error: itemErr.message });
      }
    }
    res.json({ synced: results.filter(r => r.status === 'ok').length, results });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sync gagal' });
  } finally {
    conn.release();
  }
});

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
  await safeExec('products.barcode', `ALTER TABLE products ADD COLUMN barcode VARCHAR(50) DEFAULT NULL`);
  await safeExec('products.barcode_unique', `ALTER TABLE products ADD UNIQUE INDEX idx_barcode (barcode)`);
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
  await safeExec('users.fix_is_active', `UPDATE users SET is_active = 1 WHERE is_active IS NULL`);
  await safeExec('users.default_is_active', `ALTER TABLE users ALTER COLUMN is_active SET DEFAULT 1`);
  // Fase 2: Stock management tables
  await safeExec('Create suppliers', `CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL, email VARCHAR(100) DEFAULT NULL,
    address TEXT DEFAULT NULL, notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await safeExec('Create stock_purchases', `CREATE TABLE IF NOT EXISTS stock_purchases (
    id INT AUTO_INCREMENT PRIMARY KEY, invoice_number VARCHAR(50) DEFAULT NULL,
    supplier_id INT DEFAULT NULL, supplier_name VARCHAR(100) DEFAULT NULL,
    user_id INT NOT NULL, user_name VARCHAR(100) DEFAULT NULL,
    notes TEXT DEFAULT NULL, total_amount DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await safeExec('Create stock_purchase_items', `CREATE TABLE IF NOT EXISTS stock_purchase_items (
    id INT AUTO_INCREMENT PRIMARY KEY, purchase_id INT NOT NULL,
    product_id INT NOT NULL, product_name VARCHAR(100) NOT NULL,
    qty INT NOT NULL, cost_price DECIMAL(15,2) DEFAULT 0,
    subtotal DECIMAL(15,2) DEFAULT 0)`);
  await safeExec('Create stock_movements', `CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL,
    product_name VARCHAR(100) DEFAULT NULL,
    type ENUM('purchase','sale','void','refund','opname','adjustment','manual') NOT NULL,
    qty INT NOT NULL, before_stock INT DEFAULT 0, after_stock INT DEFAULT 0,
    reference_type VARCHAR(50) DEFAULT NULL, reference_id INT DEFAULT NULL,
    notes TEXT DEFAULT NULL, user_id INT DEFAULT NULL, user_name VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await safeExec('Create stock_opname', `CREATE TABLE IF NOT EXISTS stock_opname (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
    user_name VARCHAR(100) DEFAULT NULL, notes TEXT DEFAULT NULL,
    status ENUM('draft','completed') DEFAULT 'draft',
    total_items INT DEFAULT 0, total_difference INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL)`);
  await safeExec('Create stock_opname_items', `CREATE TABLE IF NOT EXISTS stock_opname_items (
    id INT AUTO_INCREMENT PRIMARY KEY, opname_id INT NOT NULL,
    product_id INT NOT NULL, product_name VARCHAR(100) NOT NULL,
    system_stock INT DEFAULT 0, actual_stock INT DEFAULT 0,
    difference INT DEFAULT 0, notes TEXT DEFAULT NULL)`);
  // Fase 2B: Multi-satuan
  await safeExec('products.unit', `ALTER TABLE products ADD COLUMN unit VARCHAR(20) DEFAULT 'pcs'`);
  await safeExec('products.purchase_unit', `ALTER TABLE products ADD COLUMN purchase_unit VARCHAR(20) DEFAULT NULL`);
  await safeExec('products.conversion_ratio', `ALTER TABLE products ADD COLUMN conversion_ratio DECIMAL(10,4) DEFAULT 1`);
  // Fase 2B: Harga Grosir
  await safeExec('Create price_tiers', `CREATE TABLE IF NOT EXISTS price_tiers (
    id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL,
    min_qty INT NOT NULL, price DECIMAL(15,2) NOT NULL,
    UNIQUE KEY unique_tier (product_id, min_qty))`);
  // Fase 2B: Kasbon
  await safeExec('Create debts', `CREATE TABLE IF NOT EXISTS debts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) DEFAULT NULL,
    transaction_id INT DEFAULT NULL,
    amount DECIMAL(15,2) NOT NULL,
    paid DECIMAL(15,2) DEFAULT 0,
    remaining DECIMAL(15,2) NOT NULL,
    status ENUM('unpaid','partial','paid') DEFAULT 'unpaid',
    notes TEXT DEFAULT NULL,
    user_id INT NOT NULL, user_name VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
  await safeExec('Create debt_payments', `CREATE TABLE IF NOT EXISTS debt_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    debt_id INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'Cash',
    notes TEXT DEFAULT NULL,
    user_id INT NOT NULL, user_name VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await safeExec('Create product_discounts', `CREATE TABLE IF NOT EXISTS product_discounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    discount_type ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
    discount_value DECIMAL(15,2) NOT NULL,
    min_qty INT DEFAULT 1,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
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
app.get('/api/products/expiring', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const [rows] = await pool.query(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.expire_date IS NOT NULL
         AND p.expire_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY p.expire_date ASC`,
      [days]
    );
    // Classify urgency
    const today = new Date();
    const result = rows.map(p => {
      const exp = new Date(p.expire_date);
      const diffMs = exp - today;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      let urgency = 'perhatian';
      if (diffDays <= 0) urgency = 'expired';
      else if (diffDays <= 7) urgency = 'kritis';
      else if (diffDays <= 14) urgency = 'segera';
      return { ...p, days_until_expire: diffDays, urgency };
    });
    res.json(result);
  } catch (err) {
    console.error('Expiring products error:', err);
    res.status(500).json({ error: err.message });
  }
});

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
    const { barcode, name, price, cost_price, stock, category_id, min_stock, unit, purchase_unit, conversion_ratio, expire_date } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nama dan harga produk wajib diisi.' });
    }

    const [result] = await pool.query(
      'INSERT INTO products (barcode, name, price, cost_price, stock, category_id, min_stock, unit, purchase_unit, conversion_ratio, expire_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [barcode || null, name, price, cost_price || 0, stock || 0, category_id || null, min_stock || 5, unit || 'pcs', purchase_unit || null, conversion_ratio || 1, expire_date || null]
    );

    res.status(201).json({
      message: 'Produk berhasil ditambahkan!',
      product: { id: result.insertId, barcode, name, price, cost_price: cost_price || 0, stock: stock || 0, unit: unit || 'pcs', purchase_unit, conversion_ratio: conversion_ratio || 1 }
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
    const { barcode, name, price, cost_price, stock, category_id, min_stock, unit, purchase_unit, conversion_ratio, expire_date } = req.body;
    await pool.query(
      'UPDATE products SET barcode = ?, name = ?, price = ?, cost_price = ?, stock = ?, category_id = ?, min_stock = ?, unit = ?, purchase_unit = ?, conversion_ratio = ?, expire_date = ? WHERE id = ?',
      [barcode || null, name, price, cost_price || 0, stock, category_id || null, min_stock || 5, unit || 'pcs', purchase_unit || null, conversion_ratio || 1, expire_date || null, req.params.id]
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

// ============ PRICE TIERS (HARGA GROSIR) ============

// GET price tiers for a product
app.get('/api/products/:id/price-tiers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM price_tiers WHERE product_id = ? ORDER BY min_qty ASC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all price tiers (for POS - bulk load)
app.get('/api/price-tiers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM price_tiers ORDER BY product_id, min_qty ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST save price tiers for a product (replace all)
app.post('/api/products/:id/price-tiers', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { tiers } = req.body; // Array of { min_qty, price }
    await conn.query('DELETE FROM price_tiers WHERE product_id = ?', [req.params.id]);
    if (tiers && tiers.length > 0) {
      for (const t of tiers) {
        if (t.min_qty > 0 && t.price > 0) {
          await conn.query('INSERT INTO price_tiers (product_id, min_qty, price) VALUES (?, ?, ?)', [req.params.id, t.min_qty, t.price]);
        }
      }
    }
    await conn.commit();
    const [rows] = await pool.query('SELECT * FROM price_tiers WHERE product_id = ? ORDER BY min_qty ASC', [req.params.id]);
    res.json({ message: 'Harga grosir berhasil disimpan!', tiers: rows });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ============ PRODUCT DISCOUNTS ============

app.get('/api/product-discounts', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pd.*, p.name as product_name 
       FROM product_discounts pd 
       LEFT JOIN products p ON pd.product_id = p.id 
       ORDER BY pd.created_at DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/product-discounts/active', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pd.*, p.name as product_name 
       FROM product_discounts pd 
       LEFT JOIN products p ON pd.product_id = p.id 
       WHERE pd.is_active = 1 
       AND (pd.start_date IS NULL OR pd.start_date <= CURDATE()) 
       AND (pd.end_date IS NULL OR pd.end_date >= CURDATE())
       ORDER BY pd.product_id, pd.min_qty DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/product-discounts', authenticateToken, authorizeRole('owner','admin'), async (req, res) => {
  try {
    const { product_id, name, discount_type, discount_value, min_qty, start_date, end_date } = req.body;
    if (!product_id || !name || !discount_value) return res.status(400).json({ error: 'Data diskon tidak lengkap' });
    const [result] = await pool.query(
      'INSERT INTO product_discounts (product_id, name, discount_type, discount_value, min_qty, start_date, end_date) VALUES (?,?,?,?,?,?,?)',
      [product_id, name, discount_type || 'percentage', discount_value, min_qty || 1, start_date || null, end_date || null]
    );
    res.json({ id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/product-discounts/:id', authenticateToken, authorizeRole('owner','admin'), async (req, res) => {
  try {
    const { name, discount_type, discount_value, min_qty, start_date, end_date, is_active } = req.body;
    await pool.query(
      'UPDATE product_discounts SET name=?, discount_type=?, discount_value=?, min_qty=?, start_date=?, end_date=?, is_active=? WHERE id=?',
      [name, discount_type, discount_value, min_qty || 1, start_date || null, end_date || null, is_active !== undefined ? is_active : 1, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/product-discounts/:id', authenticateToken, authorizeRole('owner','admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM product_discounts WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ KASBON (HUTANG) ============

// GET all debts (with filters)
app.get('/api/debts', authenticateToken, async (req, res) => {
  try {
    const { status, customer_name } = req.query;
    let query = 'SELECT * FROM debts';
    let conditions = [];
    let params = [];
    if (status && status !== 'all') { conditions.push('status = ?'); params.push(status); }
    if (customer_name) { conditions.push('customer_name LIKE ?'); params.push('%' + customer_name + '%'); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(query, params);
    
    // Also get summary
    const [summary] = await pool.query(`SELECT 
      COUNT(*) as total_debts,
      COALESCE(SUM(amount), 0) as total_amount,
      COALESCE(SUM(paid), 0) as total_paid,
      COALESCE(SUM(remaining), 0) as total_remaining,
      COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_count,
      COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_count,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
      FROM debts`);
    
    res.json({ debts: rows, summary: summary[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET debt detail with payments
app.get('/api/debts/:id', authenticateToken, async (req, res) => {
  try {
    const [debt] = await pool.query('SELECT * FROM debts WHERE id = ?', [req.params.id]);
    if (debt.length === 0) return res.status(404).json({ error: 'Kasbon tidak ditemukan.' });
    const [payments] = await pool.query('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY created_at DESC', [req.params.id]);
    // Get transaction items if linked
    let items = [];
    if (debt[0].transaction_id) {
      const [txItems] = await pool.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [debt[0].transaction_id]);
      items = txItems;
    }
    res.json({ debt: debt[0], payments, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST pay debt
app.post('/api/debts/:id/pay', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { amount, payment_method, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Jumlah bayar harus lebih dari 0.' });
    
    const [debt] = await conn.query('SELECT * FROM debts WHERE id = ?', [req.params.id]);
    if (debt.length === 0) return res.status(404).json({ error: 'Kasbon tidak ditemukan.' });
    if (debt[0].status === 'paid') return res.status(400).json({ error: 'Kasbon sudah lunas.' });
    
    const payAmount = Math.min(amount, debt[0].remaining);
    const newPaid = Number(debt[0].paid) + payAmount;
    const newRemaining = Number(debt[0].amount) - newPaid;
    const newStatus = newRemaining <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
    
    await conn.query('INSERT INTO debt_payments (debt_id, amount, payment_method, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, payAmount, payment_method || 'Cash', notes || null, req.user.id, req.user.name || req.user.username]);
    
    await conn.query('UPDATE debts SET paid = ?, remaining = ?, status = ? WHERE id = ?',
      [newPaid, Math.max(newRemaining, 0), newStatus, req.params.id]);
    
    await conn.commit();
    res.json({ message: newStatus === 'paid' ? 'Kasbon LUNAS! 🎉' : 'Pembayaran berhasil dicatat.', paid: payAmount, remaining: Math.max(newRemaining, 0), status: newStatus });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// GET customer suggestions for kasbon (autocomplete)
app.get('/api/kasbon-customers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT customer_name as name, customer_phone as phone, 
      COUNT(*) as total_debts, COALESCE(SUM(remaining), 0) as total_remaining
      FROM debts GROUP BY customer_name, customer_phone ORDER BY customer_name`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

      // Record stock movement for sale
      try {
        const [prodStock] = await conn.query('SELECT stock FROM products WHERE id = ?', [item.id]);
        const afterStock = prodStock.length > 0 ? prodStock[0].stock : 0;
        await conn.query(
          'INSERT INTO stock_movements (product_id, product_name, type, qty, before_stock, after_stock, reference_type, reference_id, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [item.id, item.name, 'sale', -item.qty, afterStock + item.qty, afterStock, 'transactions', txId, 'Penjualan', userId, userName]
        );
      } catch (e) { console.log('Stock movement log failed:', e.message); }
    }

    // Create kasbon/debt record if payment method is Hutang
    if ((payment_method || '').toLowerCase() === 'hutang') {
      await conn.query(
        'INSERT INTO debts (customer_name, customer_phone, transaction_id, amount, paid, remaining, status, notes, user_id, user_name) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)',
        [customer_name || 'Tanpa Nama', req.body.customer_phone || null, txId, total, total, 'unpaid', notes || null, userId, userName]
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
    const { date, start_date, end_date, user_id } = req.query;
    let query = 'SELECT * FROM transactions';
    let conditions = [];
    let params = [];

    if (date) {
      conditions.push('DATE(created_at) = ?');
      params.push(date);
    } else if (start_date && end_date) {
      conditions.push('DATE(created_at) BETWEEN ? AND ?');
      params.push(start_date, end_date);
    }

    if (user_id) {
      conditions.push('user_id = ?');
      params.push(user_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
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

      // Record stock movement for void
      try {
        const [prodStock] = await conn.query('SELECT stock FROM products WHERE id = ?', [item.product_id]);
        const afterStock = prodStock.length > 0 ? prodStock[0].stock : 0;
        await conn.query(
          'INSERT INTO stock_movements (product_id, product_name, type, qty, before_stock, after_stock, reference_type, reference_id, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [item.product_id, item.product_name, 'void', item.qty || item.quantity, afterStock - (item.qty || item.quantity), afterStock, 'transactions', req.params.id, 'Void transaksi', req.user.id, req.user.name || req.user.username]
        );
      } catch (e) { console.log('Stock movement log failed:', e.message); }
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

      // Record stock movement for refund
      try {
        const [prodStock] = await conn.query('SELECT stock FROM products WHERE id = ?', [item.product_id]);
        const afterStock = prodStock.length > 0 ? prodStock[0].stock : 0;
        await conn.query(
          'INSERT INTO stock_movements (product_id, product_name, type, qty, before_stock, after_stock, reference_type, reference_id, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [item.product_id, item.product_name, 'refund', item.qty || item.quantity, afterStock - (item.qty || item.quantity), afterStock, 'transactions', req.params.id, 'Refund transaksi', req.user.id, req.user.name || req.user.username]
        );
      } catch (e) { console.log('Stock movement log failed:', e.message); }
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

// ============ PERIOD COMPARISON ============
app.get('/api/reports/comparison', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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
app.get('/api/reports/slow-moving', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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
app.get('/api/reports/restock-alert', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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


// ============ SUPPLIER ROUTES ============
// GET all suppliers
app.get('/api/suppliers', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data supplier.' });
  }
});

// POST new supplier
app.post('/api/suppliers', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nama supplier wajib diisi.' });
    const [result] = await pool.query(
      'INSERT INTO suppliers (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?)',
      [name, phone || null, email || null, address || null, notes || null]
    );
    res.status(201).json({ message: 'Supplier berhasil ditambahkan!', supplier: { id: result.insertId, name } });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambahkan supplier.' });
  }
});

// PUT update supplier
app.put('/api/suppliers/:id', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    await pool.query(
      'UPDATE suppliers SET name=?, phone=?, email=?, address=?, notes=? WHERE id=?',
      [name, phone || null, email || null, address || null, notes || null, req.params.id]
    );
    res.json({ message: 'Supplier berhasil diupdate!' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal update supplier.' });
  }
});

// DELETE supplier
app.delete('/api/suppliers/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Supplier berhasil dihapus!' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus supplier.' });
  }
});

// ============ STOCK PURCHASE (STOK MASUK) ============
// GET all purchases
app.get('/api/stock-purchases', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { start_date, end_date, supplier_id } = req.query;
    let query = 'SELECT * FROM stock_purchases';
    let conditions = [];
    let params = [];
    if (start_date && end_date) {
      conditions.push('DATE(created_at) BETWEEN ? AND ?');
      params.push(start_date, end_date);
    }
    if (supplier_id) {
      conditions.push('supplier_id = ?');
      params.push(supplier_id);
    }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data pembelian.' });
  }
});

// GET purchase detail
app.get('/api/stock-purchases/:id', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const [purchase] = await pool.query('SELECT * FROM stock_purchases WHERE id = ?', [req.params.id]);
    if (purchase.length === 0) return res.status(404).json({ error: 'Pembelian tidak ditemukan.' });
    const [items] = await pool.query('SELECT * FROM stock_purchase_items WHERE purchase_id = ?', [req.params.id]);
    res.json({ purchase: purchase[0], items });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil detail pembelian.' });
  }
});

// POST new purchase (creates purchase + adds stock + records movements)
app.post('/api/stock-purchases', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { invoice_number, supplier_id, supplier_name, items, notes } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || req.user.username;

    if (!items || items.length === 0) return res.status(400).json({ error: 'Item pembelian kosong.' });

    const totalAmount = items.reduce((sum, i) => sum + (i.qty * (i.cost_price || 0)), 0);

    const [purchaseResult] = await conn.query(
      'INSERT INTO stock_purchases (invoice_number, supplier_id, supplier_name, user_id, user_name, notes, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [invoice_number || null, supplier_id || null, supplier_name || null, userId, userName, notes || null, totalAmount]
    );
    const purchaseId = purchaseResult.insertId;

    for (const item of items) {
      await conn.query(
        'INSERT INTO stock_purchase_items (purchase_id, product_id, product_name, qty, cost_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        [purchaseId, item.product_id, item.product_name, item.qty, item.cost_price || 0, item.qty * (item.cost_price || 0)]
      );

      // Get current stock
      const [prod] = await conn.query('SELECT stock FROM products WHERE id = ?', [item.product_id]);
      const beforeStock = prod.length > 0 ? prod[0].stock : 0;
      const afterStock = beforeStock + item.qty;

      // Update product stock and optionally cost_price
      if (item.cost_price && item.cost_price > 0) {
        await conn.query('UPDATE products SET stock = ?, cost_price = ? WHERE id = ?', [afterStock, item.cost_price, item.product_id]);
      } else {
        await conn.query('UPDATE products SET stock = ? WHERE id = ?', [afterStock, item.product_id]);
      }

      // Record stock movement
      await conn.query(
        'INSERT INTO stock_movements (product_id, product_name, type, qty, before_stock, after_stock, reference_type, reference_id, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item.product_id, item.product_name, 'purchase', item.qty, beforeStock, afterStock, 'stock_purchases', purchaseId, 'Pembelian stok', userId, userName]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'Pembelian stok berhasil dicatat!', purchase: { id: purchaseId, total_amount: totalAmount } });
  } catch (err) {
    await conn.rollback();
    console.error('Stock purchase error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pembelian stok.' });
  } finally { conn.release(); }
});

// DELETE purchase (restores stock)
app.delete('/api/stock-purchases/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [items] = await conn.query('SELECT * FROM stock_purchase_items WHERE purchase_id = ?', [req.params.id]);
    const userName = req.user.name || req.user.username;

    for (const item of items) {
      const [prod] = await conn.query('SELECT stock FROM products WHERE id = ?', [item.product_id]);
      const beforeStock = prod.length > 0 ? prod[0].stock : 0;
      const afterStock = Math.max(0, beforeStock - item.qty);
      await conn.query('UPDATE products SET stock = ? WHERE id = ?', [afterStock, item.product_id]);
      await conn.query(
        'INSERT INTO stock_movements (product_id, product_name, type, qty, before_stock, after_stock, reference_type, reference_id, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item.product_id, item.product_name, 'adjustment', -item.qty, beforeStock, afterStock, 'stock_purchases', req.params.id, 'Hapus pembelian stok', req.user.id, userName]
      );
    }

    await conn.query('DELETE FROM stock_purchase_items WHERE purchase_id = ?', [req.params.id]);
    await conn.query('DELETE FROM stock_purchases WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ message: 'Pembelian berhasil dihapus dan stok dikembalikan.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Gagal menghapus pembelian.' });
  } finally { conn.release(); }
});

// ============ STOCK OPNAME ============
// GET all opname
app.get('/api/stock-opname', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM stock_opname ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data opname.' });
  }
});

// GET opname detail
app.get('/api/stock-opname/:id', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const [opname] = await pool.query('SELECT * FROM stock_opname WHERE id = ?', [req.params.id]);
    if (opname.length === 0) return res.status(404).json({ error: 'Opname tidak ditemukan.' });
    const [items] = await pool.query('SELECT * FROM stock_opname_items WHERE opname_id = ?', [req.params.id]);
    res.json({ opname: opname[0], items });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil detail opname.' });
  }
});

// POST new opname (draft - loads all products with current stock)
app.post('/api/stock-opname', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const userName = req.user.name || req.user.username;
    const { notes } = req.body;
    const [result] = await pool.query(
      'INSERT INTO stock_opname (user_id, user_name, notes) VALUES (?, ?, ?)',
      [req.user.id, userName, notes || null]
    );
    const opnameId = result.insertId;

    // Load all products as opname items
    const [products] = await pool.query('SELECT id, name, stock FROM products ORDER BY name ASC');
    for (const p of products) {
      await pool.query(
        'INSERT INTO stock_opname_items (opname_id, product_id, product_name, system_stock, actual_stock, difference) VALUES (?, ?, ?, ?, ?, 0)',
        [opnameId, p.id, p.name, p.stock, p.stock]
      );
    }

    res.status(201).json({ message: 'Opname baru dibuat!', opname: { id: opnameId } });
  } catch (err) {
    console.error('Create opname error:', err);
    res.status(500).json({ error: 'Gagal membuat opname.' });
  }
});

// PUT update opname items (save actual stock counts)
app.put('/api/stock-opname/:id/items', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Data item tidak valid.' });
    for (const item of items) {
      const diff = (item.actual_stock || 0) - (item.system_stock || 0);
      await pool.query(
        'UPDATE stock_opname_items SET actual_stock = ?, difference = ?, notes = ? WHERE id = ?',
        [item.actual_stock || 0, diff, item.notes || null, item.id]
      );
    }
    res.json({ message: 'Data opname berhasil disimpan!' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan data opname.' });
  }
});

// POST complete opname (apply stock adjustments)
app.post('/api/stock-opname/:id/complete', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const userName = req.user.name || req.user.username;

    const [opname] = await conn.query('SELECT * FROM stock_opname WHERE id = ?', [req.params.id]);
    if (opname.length === 0) return res.status(404).json({ error: 'Opname tidak ditemukan.' });
    if (opname[0].status === 'completed') return res.status(400).json({ error: 'Opname sudah diselesaikan.' });

    const [items] = await conn.query('SELECT * FROM stock_opname_items WHERE opname_id = ?', [req.params.id]);

    let totalDiff = 0;
    for (const item of items) {
      if (item.difference !== 0) {
        totalDiff += Math.abs(item.difference);
        // Record movement
        await conn.query(
          'INSERT INTO stock_movements (product_id, product_name, type, qty, before_stock, after_stock, reference_type, reference_id, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [item.product_id, item.product_name, 'opname', item.difference, item.system_stock, item.actual_stock, 'stock_opname', req.params.id, item.notes || 'Penyesuaian opname', req.user.id, userName]
        );
        // Update product stock
        await conn.query('UPDATE products SET stock = ? WHERE id = ?', [item.actual_stock, item.product_id]);
      }
    }

    await conn.query(
      'UPDATE stock_opname SET status = ?, total_items = ?, total_difference = ?, completed_at = NOW() WHERE id = ?',
      ['completed', items.length, totalDiff, req.params.id]
    );

    await conn.commit();
    res.json({ message: 'Opname selesai! Stok telah disesuaikan.' });
  } catch (err) {
    await conn.rollback();
    console.error('Complete opname error:', err);
    res.status(500).json({ error: 'Gagal menyelesaikan opname.' });
  } finally { conn.release(); }
});

// DELETE opname (only draft)
app.delete('/api/stock-opname/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    const [opname] = await pool.query('SELECT status FROM stock_opname WHERE id = ?', [req.params.id]);
    if (opname.length === 0) return res.status(404).json({ error: 'Opname tidak ditemukan.' });
    if (opname[0].status === 'completed') return res.status(400).json({ error: 'Opname yang sudah selesai tidak bisa dihapus.' });
    await pool.query('DELETE FROM stock_opname_items WHERE opname_id = ?', [req.params.id]);
    await pool.query('DELETE FROM stock_opname WHERE id = ?', [req.params.id]);
    res.json({ message: 'Opname berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus opname.' });
  }
});

// ============ STOCK MOVEMENTS (KARTU STOK) ============
app.get('/api/stock-movements', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { product_id, start_date, end_date, type } = req.query;
    let query = 'SELECT * FROM stock_movements';
    let conditions = [];
    let params = [];
    if (product_id) { conditions.push('product_id = ?'); params.push(product_id); }
    if (start_date && end_date) { conditions.push('DATE(created_at) BETWEEN ? AND ?'); params.push(start_date, end_date); }
    if (type) { conditions.push('type = ?'); params.push(type); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC LIMIT 500';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil kartu stok.' });
  }
});

// ============ IMPORT PRODUCTS (EXCEL/CSV) ============
app.post('/api/products/import', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { products } = req.body; // Array of { name, barcode, price, cost_price, stock, min_stock, category_name }
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Data produk kosong.' });
    }

    // Get categories for matching
    const [categories] = await pool.query('SELECT id, name FROM categories');
    const catMap = {};
    categories.forEach(c => { catMap[c.name.toLowerCase()] = c.id; });

    let imported = 0;
    let skipped = 0;
    let errors = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.name) { skipped++; errors.push(`Baris ${i+1}: Nama kosong`); continue; }
      try {
        const categoryId = p.category_name ? (catMap[p.category_name.toLowerCase()] || null) : null;
        await pool.query(
          'INSERT INTO products (barcode, name, price, cost_price, stock, min_stock, category_id, unit, purchase_unit, conversion_ratio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [p.barcode || null, p.name, p.price || 0, p.cost_price || 0, p.stock || 0, p.min_stock || 5, categoryId, p.unit || 'pcs', p.purchase_unit || null, p.conversion_ratio || 1]
        );
        imported++;
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          skipped++;
          errors.push(`Baris ${i+1}: Barcode "${p.barcode}" sudah ada`);
        } else {
          skipped++;
          errors.push(`Baris ${i+1}: ${e.message}`);
        }
      }
    }

    res.json({ message: `Import selesai: ${imported} berhasil, ${skipped} dilewati.`, imported, skipped, errors });
  } catch (err) {
    console.error('Import products error:', err);
    res.status(500).json({ error: 'Gagal import produk.' });
  }
});

module.exports = app;
