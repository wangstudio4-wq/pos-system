// Stock Opname routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============ STOCK OPNAME ============
// GET all opname
router.get('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM stock_opname ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data opname.' });
  }
});

// GET opname detail
router.get('/:id', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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
router.post('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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
router.put('/:id/items', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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
router.post('/:id/complete', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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
router.delete('/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
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

module.exports = router;
