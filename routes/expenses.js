const express = require('express');
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// GET expenses (with optional date filter)
router.get('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { date, start_date, end_date, month } = req.query;
    let query = 'SELECT * FROM expenses';
    let params = [];

    if (date) {
      query += ' WHERE date = ?';
      params.push(date);
    } else if (start_date && end_date) {
      query += ' WHERE date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    } else if (month) {
      query += ' WHERE DATE_FORMAT(date, "%Y-%m") = ?';
      params.push(month);
    }

    query += ' ORDER BY date DESC, created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Get expenses error:', err);
    res.status(500).json({ error: 'Gagal mengambil data pengeluaran.' });
  }
});

// GET expense summary
router.get('/summary', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { period } = req.query;
    let dateFilter = '';

    if (period === 'today') {
      dateFilter = 'WHERE date = CURDATE()';
    } else if (period === 'week') {
      dateFilter = 'WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      dateFilter = 'WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    const [total] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as count FROM expenses ${dateFilter}`
    );

    const [byCategory] = await pool.query(
      `SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
       FROM expenses ${dateFilter} GROUP BY category ORDER BY total DESC`
    );

    res.json({ summary: total[0], by_category: byCategory });
  } catch (err) {
    console.error('Expense summary error:', err);
    res.status(500).json({ error: 'Gagal mengambil ringkasan pengeluaran.' });
  }
});

// POST new expense
router.post('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { category, description, amount, date } = req.body;
    if (!category || !description || !amount) {
      return res.status(400).json({ error: 'Kategori, deskripsi, dan jumlah wajib diisi.' });
    }

    const [result] = await pool.query(
      'INSERT INTO expenses (category, description, amount, user_id, user_name, date) VALUES (?, ?, ?, ?, ?, ?)',
      [category, description, amount, req.user.id, req.user.name || req.user.username, date || new Date().toISOString().split('T')[0]]
    );

    res.status(201).json({
      message: 'Pengeluaran berhasil dicatat!',
      expense: { id: result.insertId, category, description, amount }
    });
  } catch (err) {
    console.error('Add expense error:', err);
    res.status(500).json({ error: 'Gagal mencatat pengeluaran.' });
  }
});

// DELETE expense
router.delete('/:id', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pengeluaran berhasil dihapus!' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Gagal menghapus pengeluaran.' });
  }
});

module.exports = router;
