// Product Discounts routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============ PRODUCT DISCOUNTS ============

router.get('/product-discounts', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pd.*, p.name as product_name 
       FROM product_discounts pd 
       LEFT JOIN products p ON pd.product_id = p.id 
       ORDER BY pd.created_at DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/product-discounts/active', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pd.*, p.name as product_name 
       FROM product_discounts pd 
       LEFT JOIN products p ON pd.product_id = p.id 
       WHERE pd.is_active = 1 
       AND (pd.start_date IS NULL OR pd.start_date <= CURDATE()) 
       AND (pd.end_date IS NULL OR pd.end_date >= CURDATE())
       ORDER BY pd.product_id, pd.min_qty DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/product-discounts', authenticateToken, authorizeRole('owner','admin'), async (req, res) => {
  try {
    const { product_id, name, discount_type, discount_value, min_qty, start_date, end_date } = req.body;
    if (!product_id || !name || !discount_value) return res.status(400).json({ error: 'Data diskon tidak lengkap' });
    const [result] = await pool.query(
      'INSERT INTO product_discounts (product_id, name, discount_type, discount_value, min_qty, start_date, end_date) VALUES (?,?,?,?,?,?,?)',
      [product_id, name, discount_type || 'percentage', discount_value, min_qty || 1, start_date || null, end_date || null]
    );
    res.json({ id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/product-discounts/:id', authenticateToken, authorizeRole('owner','admin'), async (req, res) => {
  try {
    const { name, discount_type, discount_value, min_qty, start_date, end_date, is_active } = req.body;
    await pool.query(
      'UPDATE product_discounts SET name=?, discount_type=?, discount_value=?, min_qty=?, start_date=?, end_date=?, is_active=? WHERE id=?',
      [name, discount_type, discount_value, min_qty || 1, start_date || null, end_date || null, is_active !== undefined ? is_active : 1, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/product-discounts/:id', authenticateToken, authorizeRole('owner','admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM product_discounts WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
