const express = require('express');
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// GET current open shift for user
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const [shifts] = await pool.query(
      'SELECT * FROM shifts WHERE user_id = ? AND status = "open" ORDER BY opened_at DESC LIMIT 1',
      [req.user.id]
    );
    res.json({ shift: shifts.length > 0 ? shifts[0] : null });
  } catch (err) {
    console.error('Get current shift error:', err);
    res.status(500).json({ error: 'Gagal mengambil data shift.' });
  }
});

// GET all shifts (admin/owner)
router.get('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { date, user_id } = req.query;
    let query = 'SELECT * FROM shifts';
    let params = [];
    let conditions = [];

    if (date) {
      conditions.push('DATE(opened_at) = ?');
      params.push(date);
    }
    if (user_id) {
      conditions.push('user_id = ?');
      params.push(user_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY opened_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Get shifts error:', err);
    res.status(500).json({ error: 'Gagal mengambil data shift.' });
  }
});

// POST open shift
router.post('/open', authenticateToken, async (req, res) => {
  try {
    // Check if user already has an open shift
    const [existing] = await pool.query(
      'SELECT id FROM shifts WHERE user_id = ? AND status = "open"',
      [req.user.id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Anda sudah memiliki shift yang aktif. Tutup shift lama terlebih dahulu.' });
    }

    const { opening_cash } = req.body;
    const [result] = await pool.query(
      'INSERT INTO shifts (user_id, user_name, opening_cash) VALUES (?, ?, ?)',
      [req.user.id, req.user.name || req.user.username, opening_cash || 0]
    );

    res.status(201).json({
      message: 'Shift berhasil dibuka!',
      shift: { id: result.insertId, opening_cash: opening_cash || 0, status: 'open' }
    });
  } catch (err) {
    console.error('Open shift error:', err);
    res.status(500).json({ error: 'Gagal membuka shift.' });
  }
});

// POST close shift
router.post('/close', authenticateToken, async (req, res) => {
  try {
    const [shifts] = await pool.query(
      'SELECT * FROM shifts WHERE user_id = ? AND status = "open" ORDER BY opened_at DESC LIMIT 1',
      [req.user.id]
    );

    if (shifts.length === 0) {
      return res.status(400).json({ error: 'Tidak ada shift aktif.' });
    }

    const shift = shifts[0];
    const { closing_cash, notes } = req.body;

    // Calculate total sales during this shift
    const [sales] = await pool.query(
      `SELECT COUNT(*) as total_transactions, COALESCE(SUM(total), 0) as total_sales 
       FROM transactions 
       WHERE user_id = ? AND created_at >= ? AND created_at <= NOW()`,
      [req.user.id, shift.opened_at]
    );

    const totalSales = sales[0].total_sales;
    const totalTransactions = sales[0].total_transactions;
    const expectedCash = parseFloat(shift.opening_cash) + parseFloat(totalSales);

    await pool.query(
      `UPDATE shifts SET status = 'closed', closing_cash = ?, expected_cash = ?, 
       total_sales = ?, total_transactions = ?, notes = ?, closed_at = NOW() 
       WHERE id = ?`,
      [closing_cash || 0, expectedCash, totalSales, totalTransactions, notes || null, shift.id]
    );

    res.json({
      message: 'Shift berhasil ditutup!',
      summary: {
        opening_cash: shift.opening_cash,
        closing_cash: closing_cash || 0,
        expected_cash: expectedCash,
        total_sales: totalSales,
        total_transactions: totalTransactions,
        difference: (closing_cash || 0) - expectedCash
      }
    });
  } catch (err) {
    console.error('Close shift error:', err);
    res.status(500).json({ error: 'Gagal menutup shift.' });
  }
});

module.exports = router;
