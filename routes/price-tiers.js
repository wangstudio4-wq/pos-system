// Price Tiers (Harga Grosir) routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============ PRICE TIERS (HARGA GROSIR) ============

// GET price tiers for a product
router.get('/products/:id/price-tiers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM price_tiers WHERE product_id = ? ORDER BY min_qty ASC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all price tiers (for POS - bulk load)
router.get('/price-tiers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM price_tiers ORDER BY product_id, min_qty ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST save price tiers for a product (replace all)
router.post('/products/:id/price-tiers', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { tiers } = req.body; // Array of { min_qty, price }
    await conn.query('DELETE FROM price_tiers WHERE product_id = ?', [req.params.id]);
    if (tiers && tiers.length > 0) {
      for (const t of tiers) {
        if (t.min_qty > 0 && t.price > 0) {
          await conn.query('INSERT INTO price_tiers (product_id, min_qty, price) VALUES (?, ?, ?)', [req.params.id, t.min_qty, t.price]);
        }
      }
    }
    await conn.commit();
    const [rows] = await pool.query('SELECT * FROM price_tiers WHERE product_id = ? ORDER BY min_qty ASC', [req.params.id]);
    res.json({ message: 'Harga grosir berhasil disimpan!', tiers: rows });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
