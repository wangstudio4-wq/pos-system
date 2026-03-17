// Auto-migration logic (extracted from api/index.js)
const pool = require('./db');

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
  // Fase 3: Expired Date
  await safeExec('products.expire_date', `ALTER TABLE products ADD COLUMN expire_date DATE DEFAULT NULL`);
  // Fase 2B: Harga Grosir
  // Phase 4: Member & Reward System
  await safeExec('Create member_levels', `CREATE TABLE IF NOT EXISTS member_levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    min_points INT DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    color VARCHAR(7) DEFAULT '#3b82f6',
    icon VARCHAR(10) DEFAULT '🥉',
    sort_order INT DEFAULT 0
  )`);
  await safeExec('Seed member_levels', `INSERT IGNORE INTO member_levels (id, name, min_points, discount_percent, color, icon, sort_order) VALUES
    (1, 'Bronze', 0, 0, '#cd7f32', '🥉', 1),
    (2, 'Silver', 500, 2, '#c0c0c0', '🥈', 2),
    (3, 'Gold', 2000, 5, '#ffd700', '🥇', 3),
    (4, 'Platinum', 5000, 8, '#e5e4e2', '💎', 4)`);
  await safeExec('Create rewards', `CREATE TABLE IF NOT EXISTS rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    points_cost INT NOT NULL DEFAULT 100,
    reward_type ENUM('discount_percent','discount_fixed','free_product','voucher') DEFAULT 'discount_fixed',
    reward_value DECIMAL(15,2) DEFAULT 0,
    stock INT DEFAULT -1,
    is_active TINYINT DEFAULT 1,
    image_url VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await safeExec('Create point_history', `CREATE TABLE IF NOT EXISTS point_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    type ENUM('earn','redeem','adjust','bonus') NOT NULL,
    points INT NOT NULL,
    balance_after INT DEFAULT 0,
    reference_type VARCHAR(50) DEFAULT NULL,
    reference_id INT DEFAULT NULL,
    description TEXT DEFAULT NULL,
    created_by VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer (customer_id),
    INDEX idx_type (type)
  )`);
  await safeExec('customers.member_code', `ALTER TABLE customers ADD COLUMN member_code VARCHAR(20) DEFAULT NULL`);
  await safeExec('customers.member_code_unique', `ALTER TABLE customers ADD UNIQUE INDEX idx_member_code (member_code)`);
  await safeExec('customers.level_id', `ALTER TABLE customers ADD COLUMN level_id INT DEFAULT 1`);
  await safeExec('customers.member_since', `ALTER TABLE customers ADD COLUMN member_since DATE DEFAULT (CURRENT_DATE)`);
  await safeExec('customers.is_active', `ALTER TABLE customers ADD COLUMN is_active TINYINT DEFAULT 1`);
  await safeExec('customers.notes', `ALTER TABLE customers ADD COLUMN notes TEXT DEFAULT NULL`);
  // Point settings in settings table
  await safeExec('settings.points_enabled', "ALTER TABLE settings ADD COLUMN points_enabled TINYINT(1) DEFAULT 1");
  await safeExec('settings.points_per_amount', "ALTER TABLE settings ADD COLUMN points_per_amount INT DEFAULT 10000");
  await safeExec('settings.points_earn_ratio', "ALTER TABLE settings ADD COLUMN points_earn_ratio INT DEFAULT 1");

  await safeExec('Create price_tiers', `CREATE TABLE IF NOT EXISTS price_tiers (
    id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL,
    min_qty INT NOT NULL, price DECIMAL(15,2) NOT NULL,
    UNIQUE KEY unique_tier (product_id, min_qty))`);
  // Fase 4.2: Harga VIP / Spesial per Level & Customer
  await safeExec('Create special_prices', `CREATE TABLE IF NOT EXISTS special_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    level_id INT DEFAULT NULL,
    customer_id INT DEFAULT NULL,
    special_price DECIMAL(15,2) NOT NULL,
    description VARCHAR(200) DEFAULT NULL,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    is_active TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_special_lookup (product_id, level_id, customer_id)
  )`);
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
  // === Module System Tables ===
  await safeExec('Create modules', `CREATE TABLE IF NOT EXISTS modules (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    version VARCHAR(20) DEFAULT '1.0.0',
    category VARCHAR(50) DEFAULT 'general',
    is_enabled TINYINT(1) DEFAULT 0,
    is_core TINYINT(1) DEFAULT 0,
    config JSON DEFAULT NULL,
    dependencies JSON DEFAULT NULL,
    sort_order INT DEFAULT 0,
    installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);

  await safeExec('Create module_migrations', `CREATE TABLE IF NOT EXISTS module_migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module_id VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_module_version (module_id, version))`);

  // Seed core modules (always enabled, can't be disabled)
  await safeExec('Seed core modules', `INSERT IGNORE INTO modules (id, name, description, category, is_enabled, is_core, sort_order) VALUES
    ('core-pos', 'Point of Sale', 'Kasir & transaksi penjualan', 'core', 1, 1, 1),
    ('core-products', 'Produk & Kategori', 'Manajemen produk dan kategori', 'core', 1, 1, 2),
    ('core-reports', 'Laporan Dasar', 'Laporan penjualan harian', 'core', 1, 1, 3),
    ('core-users', 'User & Shift', 'Manajemen user, shift, dan kasir', 'core', 1, 1, 4),
    ('vip-pricing', 'Harga VIP', 'Harga khusus per level member atau per pelanggan', 'pricing', 1, 0, 10)`);

  console.log('✅ Auto-migrate completed');
}
const migrationReady = runAutoMigrate().catch(err => console.error('Migration error:', err));
// Ensure migration completes before handling any request (critical for Vercel serverless)
module.exports = { runAutoMigrate, migrationReady };
