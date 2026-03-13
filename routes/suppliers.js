// Supplier routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============ SUPPLIER ROUTES ============
// GET all suppliers
router.get('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data supplier.' });
  }
});

// POST new supplier
router.post('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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
router.put('/:id', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
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
router.delete('/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Supplier berhasil dihapus!' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus supplier.' });
  }
});

module.exports = router;
