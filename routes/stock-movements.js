// Stock Movements (Kartu Stok) routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============ STOCK MOVEMENTS (KARTU STOK) ============
router.get('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { product_id, start_date, end_date, type } = req.query;
    let query = 'SELECT * FROM stock_movements';
    let conditions = [];
    let params = [];
    if (product_id) { conditions.push('product_id = ?'); params.push(product_id); }
    if (start_date && end_date) { conditions.push('DATE(created_at) BETWEEN ? AND ?'); params.push(start_date, end_date); }
    if (type) { conditions.push('type = ?'); params.push(type); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC LIMIT 500';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil kartu stok.' });
  }
});

module.exports = router;
