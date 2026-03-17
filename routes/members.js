// Members, Levels, Special Prices, Points & Rewards routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============================
// MEMBER & REWARD SYSTEM APIs
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

// GET single member detail
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

router.get('/members/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, ml.name as level_name, ml.color as level_color, ml.icon as level_icon, ml.discount_percent
       FROM customers c LEFT JOIN member_levels ml ON c.level_id = ml.id WHERE c.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });
    // Get recent transactions
    const [txns] = await pool.query(
      `SELECT id, total, payment_method, created_at FROM transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10`, [req.params.id]);
    // Get point history
    const [points] = await pool.query(
      `SELECT * FROM point_history WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20`, [req.params.id]);
    // Get next level info
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
    // Generate member code
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

// GET point settings

  // ============ HARGA VIP / SPESIAL ============
  // NOTE: Moved to modules/vip-pricing/ — loaded dynamically by BackendModuleLoader


  router.get('/settings/points', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT points_enabled, points_per_amount, points_earn_ratio FROM settings WHERE id = 1");
    if (!rows.length) return res.json({ points_enabled: 1, points_per_amount: 10000, points_earn_ratio: 1 });
    res.json({
      points_enabled: rows[0].points_enabled ? '1' : '0',
      points_per_amount: String(rows[0].points_per_amount || 10000),
      points_earn_ratio: String(rows[0].points_earn_ratio || 1)
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT update point settings
router.put('/settings/points', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    const { points_per_amount, points_earn_ratio, points_enabled } = req.body;
    const updates = [];
    const vals = [];
    if (points_per_amount !== undefined) { updates.push('points_per_amount = ?'); vals.push(points_per_amount); }
    if (points_earn_ratio !== undefined) { updates.push('points_earn_ratio = ?'); vals.push(points_earn_ratio); }
    if (points_enabled !== undefined) { updates.push('points_enabled = ?'); vals.push(points_enabled); }
    if (updates.length) await pool.query('UPDATE settings SET ' + updates.join(', ') + ' WHERE id = 1', vals);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST adjust points manually
router.post('/members/:id/adjust-points', authenticateToken, authorizeRole('owner','admin'), async (req, res) => {
  try {
    const { points, description, type } = req.body;
    const adjustType = type || (points >= 0 ? 'bonus' : 'adjust');
    const [member] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!member.length) return res.status(404).json({ error: 'Member not found' });
    const newBalance = member[0].points + points;
    await pool.query('UPDATE customers SET points = ? WHERE id = ?', [Math.max(0, newBalance), req.params.id]);
    await pool.query(
      'INSERT INTO point_history (customer_id, type, points, balance_after, description, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, adjustType, points, Math.max(0, newBalance), description || 'Manual adjustment', req.user.name || req.user.username]);
    // Auto update level
    await autoUpdateMemberLevel(req.params.id);
    res.json({ success: true, new_balance: Math.max(0, newBalance) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Helper: auto update member level based on points
async function autoUpdateMemberLevel(customerId) {
  try {
    const [member] = await pool.query('SELECT points FROM customers WHERE id = ?', [customerId]);
    if (!member.length) return;
    const [levels] = await pool.query('SELECT * FROM member_levels ORDER BY min_points DESC');
    for (const level of levels) {
      if (member[0].points >= level.min_points) {
        await pool.query('UPDATE customers SET level_id = ? WHERE id = ?', [level.id, customerId]);
        break;
      }
    }
  } catch(e) { console.error('Error updating member level:', e.message); }
}

// Helper: add points from transaction
async function addPointsFromTransaction(customerId, totalAmount, txId, userName) {
  try {
    const [settings] = await pool.query("SELECT points_enabled, points_per_amount, points_earn_ratio FROM settings WHERE id = 1");
    if (!settings.length || !settings[0].points_enabled) return;
    const perAmount = settings[0].points_per_amount || 10000;
    const ratio = settings[0].points_earn_ratio || 1;
    const pointsEarned = Math.floor(totalAmount / perAmount) * ratio;
    if (pointsEarned <= 0) return;
    const [member] = await pool.query('SELECT points FROM customers WHERE id = ?', [customerId]);
    if (!member.length) return;
    const newBalance = member[0].points + pointsEarned;
    await pool.query('UPDATE customers SET points = ?, total_transactions = total_transactions + 1, total_spent = total_spent + ? WHERE id = ?', [newBalance, totalAmount, customerId]);
    await pool.query(
      'INSERT INTO point_history (customer_id, type, points, balance_after, reference_type, reference_id, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [customerId, 'earn', pointsEarned, newBalance, 'transaction', txId, 'Belanja ' + totalAmount, userName]);
    await autoUpdateMemberLevel(customerId);
  } catch(e) { console.error('Error adding points:', e.message); }
}

// GET rewards catalog
router.get('/rewards', authenticateToken, async (req, res) => {
  try {
    const { active_only } = req.query;
    let sql = 'SELECT * FROM rewards';
    if (active_only === '1') sql += ' WHERE is_active = 1';
    sql += ' ORDER BY points_cost ASC';
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST create reward
router.post('/rewards', authenticateToken, authorizeRole('owner','admin'), async (req, res) => {
  try {
    const { name, description, points_cost, reward_type, reward_value, stock } = req.body;
    if (!name || !points_cost) return res.status(400).json({ error: 'Nama dan poin wajib diisi' });
    const [result] = await pool.query(
      'INSERT INTO rewards (name, description, points_cost, reward_type, reward_value, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, points_cost, reward_type || 'discount_fixed', reward_value || 0, stock !== undefined ? stock : -1]);
    res.json({ id: result.insertId });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT update reward
router.put('/rewards/:id', authenticateToken, authorizeRole('owner','admin'), async (req, res) => {
  try {
    const { name, description, points_cost, reward_type, reward_value, stock, is_active } = req.body;
    await pool.query(
      'UPDATE rewards SET name = ?, description = ?, points_cost = ?, reward_type = ?, reward_value = ?, stock = ?, is_active = ? WHERE id = ?',
      [name, description, points_cost, reward_type, reward_value, stock, is_active, req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE reward
router.delete('/rewards/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM rewards WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST redeem reward
router.post('/rewards/:id/redeem', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'Customer ID wajib' });
    const [reward] = await pool.query('SELECT * FROM rewards WHERE id = ? AND is_active = 1', [req.params.id]);
    if (!reward.length) return res.status(404).json({ error: 'Reward tidak ditemukan' });
    const [member] = await pool.query('SELECT * FROM customers WHERE id = ?', [customer_id]);
    if (!member.length) return res.status(404).json({ error: 'Member tidak ditemukan' });
    if (member[0].points < reward[0].points_cost) return res.status(400).json({ error: 'Poin tidak cukup. Dibutuhkan: ' + reward[0].points_cost + ', Tersedia: ' + member[0].points });
    if (reward[0].stock === 0) return res.status(400).json({ error: 'Reward sudah habis' });
    // Deduct points
    const newBalance = member[0].points - reward[0].points_cost;
    await pool.query('UPDATE customers SET points = ? WHERE id = ?', [newBalance, customer_id]);
    // Update stock if limited
    if (reward[0].stock > 0) await pool.query('UPDATE rewards SET stock = stock - 1 WHERE id = ?', [req.params.id]);
    // Record history
    await pool.query(
      'INSERT INTO point_history (customer_id, type, points, balance_after, reference_type, reference_id, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [customer_id, 'redeem', -reward[0].points_cost, newBalance, 'reward', reward[0].id, 'Redeem: ' + reward[0].name, req.user.name || req.user.username]);
    await autoUpdateMemberLevel(customer_id);
    res.json({ success: true, new_balance: newBalance, reward: reward[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET point history for a member
router.get('/members/:id/point-history', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM point_history WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50', [req.params.id]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Search members (for POS autocomplete)

// GET member stats summary

module.exports = router;
