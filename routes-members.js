// Members & Levels routes (Points/Rewards moved to modules/rewards-loyalty/)
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============================
// MEMBER SYSTEM APIs
// ============================

// GET all members
router.get('/members', authenticateToken, async (req, res) => {
  try {
    const { search, level_id, is_active } = req.query;
    let sql = `SELECT c.*, ml.name as level_name, ml.color as level_color, ml.icon as level_icon, ml.discount_percent
               FROM customers c LEFT JOIN member_levels ml ON c.level_id = ml.id WHERE 1=1`;
    const params = [];
    if (search) { sql += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.member_code LIKE ?)`; params.push('%'+search+'%','%'+search+'%','%'+search+'%'); }
    if (level_id) { sql += ` AND c.level_id = ?`; params.push(level_id); }
    if (is_active !== undefined) { sql += ` AND c.is_active = ?`; params.push(is_active); }
    sql += ` ORDER BY c.points DESC, c.name ASC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET quick search (for POS autocomplete)
router.get('/members/search/quick', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.phone, c.member_code, c.points, ml.name as level_name, ml.icon as level_icon, ml.discount_percent
       FROM customers c LEFT JOIN member_levels ml ON c.level_id = ml.id
       WHERE c.is_active = 1 AND (c.name LIKE ? OR c.phone LIKE ? OR c.member_code LIKE ?) LIMIT 10`,
      ['%'+q+'%', '%'+q+'%', '%'+q+'%']);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET member stats summary
router.get('/members/stats/summary', authenticateToken, async (req, res) => {
  try {
    const [total] = await pool.query('SELECT COUNT(*) as cnt FROM customers WHERE is_active = 1');
    const [byLevel] = await pool.query(
      `SELECT ml.name, ml.icon, ml.color, COUNT(c.id) as cnt 
       FROM member_levels ml LEFT JOIN customers c ON c.level_id = ml.id AND c.is_active = 1
       GROUP BY ml.id ORDER BY ml.sort_order`);
    const [totalPoints] = await pool.query('SELECT COALESCE(SUM(points),0) as total FROM customers WHERE is_active = 1');
    const [newThisMonth] = await pool.query("SELECT COUNT(*) as cnt FROM customers WHERE is_active = 1 AND member_since >= DATE_FORMAT(CURDATE(), '%Y-%m-01')");
    res.json({ total_members: total[0].cnt, by_level: byLevel, total_points_circulating: totalPoints[0].total, new_this_month: newThisMonth[0].cnt });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET single member detail
router.get('/members/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, ml.name as level_name, ml.color as level_color, ml.icon as level_icon, ml.discount_percent
       FROM customers c LEFT JOIN member_levels ml ON c.level_id = ml.id WHERE c.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });
    const [txns] = await pool.query(
      `SELECT id, total, payment_method, created_at FROM transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10`, [req.params.id]);
    const [points] = await pool.query(
      `SELECT * FROM point_history WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20`, [req.params.id]);
    const [nextLevel] = await pool.query(
      `SELECT * FROM member_levels WHERE min_points > ? ORDER BY min_points ASC LIMIT 1`, [rows[0].points]);
    res.json({ ...rows[0], recent_transactions: txns, point_history: points, next_level: nextLevel[0] || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST create member
router.post('/members', authenticateToken, async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nama wajib diisi' });
    const [countResult] = await pool.query('SELECT COUNT(*) as cnt FROM customers');
    const code = 'MBR-' + String(countResult[0].cnt + 1).padStart(5, '0');
    const [result] = await pool.query(
      `INSERT INTO customers (name, phone, email, address, notes, member_code, level_id, points, member_since) VALUES (?, ?, ?, ?, ?, ?, 1, 0, CURRENT_DATE)`,
      [name, phone || null, email || null, address || null, notes || null, code]);
    res.json({ id: result.insertId, member_code: code });
  } catch(e) { 
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Member dengan data ini sudah ada' });
    res.status(500).json({ error: e.message }); 
  }
});

// PUT update member
router.put('/members/:id', authenticateToken, async (req, res) => {
  try {
    const { name, phone, email, address, notes, is_active } = req.body;
    await pool.query(
      `UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ?, is_active = ? WHERE id = ?`,
      [name, phone || null, email || null, address || null, notes || null, is_active !== undefined ? is_active : 1, req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE member
router.delete('/members/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM point_history WHERE customer_id = ?', [req.params.id]);
    await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET member levels
router.get('/member-levels', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM member_levels ORDER BY sort_order ASC');
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT update member level
router.put('/member-levels/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    const { name, min_points, discount_percent, color, icon } = req.body;
    await pool.query(
      'UPDATE member_levels SET name = ?, min_points = ?, discount_percent = ?, color = ?, icon = ? WHERE id = ?',
      [name, min_points, discount_percent, color, icon, req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
