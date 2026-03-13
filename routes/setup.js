// Setup, store-info, register-owner, debug routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

// ============ SETUP: Auto-init database ============

// Check setup status (no auth needed)
router.get('/setup/status', async (req, res) => {
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
router.get('/store-info', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT store_name, store_logo_url FROM settings WHERE id = 1');
    res.json(rows[0] || { store_name: 'KasirPro', store_logo_url: null });
  } catch (err) {
    res.json({ store_name: 'KasirPro', store_logo_url: null });
  }
});

// Auto-init database tables
router.post('/setup/init', async (req, res) => {
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
router.post('/auth/register-owner', async (req, res) => {
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
router.get('/debug/schema', authenticateToken, async (req, res) => {
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

module.exports = router;
