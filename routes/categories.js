const express = require('express');
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// GET all categories
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Gagal mengambil data kategori.' });
  }
});

// POST new category
router.post('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Nama kategori wajib diisi.' });

    const [result] = await pool.query(
      'INSERT INTO categories (name, color) VALUES (?, ?)',
      [name, color || '#2563eb']
    );
    res.status(201).json({ message: 'Kategori berhasil ditambahkan!', category: { id: result.insertId, name, color } });
  } catch (err) {
    console.error('Add category error:', err);
    res.status(500).json({ error: 'Gagal menambahkan kategori.' });
  }
});

// PUT update category
router.put('/:id', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { name, color } = req.body;
    await pool.query('UPDATE categories SET name = ?, color = ? WHERE id = ?', [name, color, req.params.id]);
    res.json({ message: 'Kategori berhasil diupdate!' });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Gagal update kategori.' });
  }
});

// DELETE category
router.delete('/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    await pool.query('UPDATE products SET category_id = NULL WHERE category_id = ?', [req.params.id]);
    await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Kategori berhasil dihapus!' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Gagal menghapus kategori.' });
  }
});

module.exports = router;
