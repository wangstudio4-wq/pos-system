-- ============================================================
-- POS MAJOO-LIKE: DATABASE MIGRATION
-- Compatible with MySQL 8.0+
-- Run this SQL after the initial tables (users, products, 
-- transactions, transaction_items) are already created.
-- ============================================================

-- 1. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#2563eb',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ADD columns to PRODUCTS (drop constraint first if re-running)
ALTER TABLE products ADD COLUMN category_id INT DEFAULT NULL;
ALTER TABLE products ADD COLUMN image_url VARCHAR(500) DEFAULT NULL;
ALTER TABLE products ADD COLUMN min_stock INT DEFAULT 5;
ALTER TABLE products ADD CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- 3. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
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
);

-- 4. UPDATE TRANSACTIONS for payment method, customer, discount
ALTER TABLE transactions ADD COLUMN payment_method VARCHAR(20) DEFAULT 'cash';
ALTER TABLE transactions ADD COLUMN customer_id INT DEFAULT NULL;
ALTER TABLE transactions ADD COLUMN customer_name VARCHAR(100) DEFAULT NULL;
ALTER TABLE transactions ADD COLUMN discount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN subtotal DECIMAL(15,2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN notes TEXT DEFAULT NULL;
ALTER TABLE transactions ADD CONSTRAINT fk_tx_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 5. UPDATE TRANSACTION_ITEMS for discount
ALTER TABLE transaction_items ADD COLUMN discount DECIMAL(15,2) DEFAULT 0;

-- 6. SHIFTS
CREATE TABLE IF NOT EXISTS shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_name VARCHAR(100) NOT NULL,
  opening_cash DECIMAL(15,2) DEFAULT 0,
  closing_cash DECIMAL(15,2) DEFAULT NULL,
  expected_cash DECIMAL(15,2) DEFAULT NULL,
  total_sales DECIMAL(15,2) DEFAULT 0,
  total_transactions INT DEFAULT 0,
  notes TEXT DEFAULT NULL,
  status ENUM('open', 'closed') DEFAULT 'open',
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 7. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  user_id INT NOT NULL,
  user_name VARCHAR(100) NOT NULL,
  date DATE DEFAULT (CURRENT_DATE),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 8. Insert default categories
INSERT IGNORE INTO categories (id, name, color) VALUES
  (1, 'Makanan', '#ef4444'),
  (2, 'Minuman', '#3b82f6'),
  (3, 'Snack', '#f59e0b'),
  (4, 'Lainnya', '#6b7280');
