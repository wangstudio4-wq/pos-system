const express = require('express');
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Auto-create shifts table if not exists
async function ensureShiftsTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS shifts (
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
}

// GET current open shift for user (with sales summary)
router.get('/current', authenticateToken, async (req, res) => {
  try {
    await ensureShiftsTable();
    const [shifts] = await pool.query(
      'SELECT * FROM shifts WHERE user_id = ? AND status = ? ORDER BY opened_at DESC LIMIT 1',
      [req.user.id, 'open']
    );

    let shift = shifts.length > 0 ? shifts[0] : null;

    if (shift) {
      // Calculate sales during this shift
      const [sales] = await pool.query(
        `SELECT COUNT(*) as total_transactions, 
                COALESCE(SUM(total), 0) as total_sales
         FROM transactions 
         WHERE user_id = ? AND created_at >= ?`,
        [req.user.id, shift.opened_at]
      );
      shift.total_transactions = sales[0].total_transactions;
      shift.total_sales = parseFloat(sales[0].total_sales);
      shift.expected_cash = parseFloat(shift.opening_cash) + parseFloat(sales[0].total_sales);
    }

    res.json({ shift });
  } catch (err) {
    console.error('Get current shift error:', err);
    res.status(500).json({ error: 'Gagal mengambil data shift: ' + err.message });
  }
});

// GET all shifts (admin/owner)
router.get('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    await ensureShiftsTable();
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
    res.status(500).json({ error: 'Gagal mengambil data shift: ' + err.message });
  }
});

// POST open shift
router.post('/open', authenticateToken, async (req, res) => {
  try {
    await ensureShiftsTable();

    // Check if user already has an open shift
    const [existing] = await pool.query(
      'SELECT id FROM shifts WHERE user_id = ? AND status = ?',
      [req.user.id, 'open']
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Anda sudah memiliki shift yang aktif. Tutup shift lama terlebih dahulu.' });
    }

    const { opening_cash } = req.body;
    const userName = req.user.name || req.user.username || 'Unknown';
    
    const [result] = await pool.query(
      'INSERT INTO shifts (user_id, user_name, opening_cash) VALUES (?, ?, ?)',
      [req.user.id, userName, opening_cash || 0]
    );

    res.status(201).json({
      message: 'Shift berhasil dibuka!',
      shift: { id: result.insertId, opening_cash: opening_cash || 0, status: 'open' }
    });
  } catch (err) {
    console.error('Open shift error:', err);
    res.status(500).json({ error: 'Gagal membuka shift: ' + err.message });
  }
});

// POST close shift
router.post('/close', authenticateToken, async (req, res) => {
  try {
    await ensureShiftsTable();

    const [shifts] = await pool.query(
      'SELECT * FROM shifts WHERE user_id = ? AND status = ? ORDER BY opened_at DESC LIMIT 1',
      [req.user.id, 'open']
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
      `UPDATE shifts SET status = ?, closing_cash = ?, expected_cash = ?, 
       total_sales = ?, total_transactions = ?, notes = ?, closed_at = NOW() 
       WHERE id = ?`,
      ['closed', closing_cash || 0, expectedCash, totalSales, totalTransactions, notes || null, shift.id]
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
    res.status(500).json({ error: 'Gagal menutup shift: ' + err.message });
  }
});

module.exports = router;
