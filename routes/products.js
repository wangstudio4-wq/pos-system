// Product CRUD routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============ PRODUCT ROUTES ============

// GET low stock products
router.get('/low-stock', authenticateToken, async (req, res) => {
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
router.get('/expiring', authenticateToken, async (req, res) => {
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

router.get('/', authenticateToken, async (req, res) => {
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
router.post('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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
router.put('/:id', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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
router.delete('/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Produk berhasil dihapus!' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Gagal menghapus produk.' });
  }
});

// GET product by barcode
router.get('/barcode/:barcode', authenticateToken, async (req, res) => {
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

module.exports = router;
