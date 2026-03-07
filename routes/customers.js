const express = require('express');
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// GET all customers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({ error: 'Gagal mengambil data pelanggan.' });
  }
});

// GET customer by id with transaction history
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [customers] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (customers.length === 0) return res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });

    const [transactions] = await pool.query(
      'SELECT * FROM transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.params.id]
    );

    res.json({ customer: customers[0], transactions });
  } catch (err) {
    console.error('Get customer detail error:', err);
    res.status(500).json({ error: 'Gagal mengambil detail pelanggan.' });
  }
});

// POST new customer
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Nama pelanggan wajib diisi.' });

    const [result] = await pool.query(
      'INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)',
      [name, phone || null, email || null, address || null]
    );

    res.status(201).json({
      message: 'Pelanggan berhasil ditambahkan!',
      customer: { id: result.insertId, name, phone, email, address }
    });
  } catch (err) {
    console.error('Add customer error:', err);
    res.status(500).json({ error: 'Gagal menambahkan pelanggan.' });
  }
});

// PUT update customer
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    await pool.query(
      'UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?',
      [name, phone || null, email || null, address || null, req.params.id]
    );
    res.json({ message: 'Pelanggan berhasil diupdate!' });
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Gagal update pelanggan.' });
  }
});

// DELETE customer
router.delete('/:id', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pelanggan berhasil dihapus!' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Gagal menghapus pelanggan.' });
  }
});

module.exports = router;
