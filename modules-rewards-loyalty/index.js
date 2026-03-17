/**
 * KasirPro Module: Rewards & Loyalty
 * Points system, rewards catalog, redemption
 */
module.exports = {
  id: 'rewards-loyalty',
  name: 'Rewards & Loyalty',
  version: '1.0.0',
  description: 'Sistem poin, level member, rewards catalog & redeem',
  author: 'KasirPro',
  category: 'loyalty',
  icon: '🎁',
  core: false,

  dependencies: [],

  migrations: [
    {
      version: 1,
      description: 'Ensure rewards & point tables exist',
      up: async (pool) => {
        // rewards table
        await pool.query(`CREATE TABLE IF NOT EXISTS rewards (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          points_cost INT NOT NULL DEFAULT 100,
          reward_type ENUM('discount_fixed','discount_percent','free_product','voucher') DEFAULT 'discount_fixed',
          reward_value DECIMAL(15,2) DEFAULT 0,
          stock INT DEFAULT -1,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        // point_history table
        await pool.query(`CREATE TABLE IF NOT EXISTS point_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL,
          type ENUM('earn','redeem','bonus','adjust') DEFAULT 'earn',
          points INT NOT NULL,
          balance_after INT DEFAULT 0,
          reference_type VARCHAR(50),
          reference_id INT,
          description TEXT,
          created_by VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_customer (customer_id),
          INDEX idx_type (type)
        )`);
      }
    }
  ],

  routes: (pool, { authenticateToken, authorizeRole }) => {
    const express = require('express');
    const router = express.Router();

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

    // Helper: add points from transaction (called via hooks)
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

    // GET point settings
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
        await autoUpdateMemberLevel(req.params.id);
        res.json({ success: true, new_balance: Math.max(0, newBalance) });
      } catch(e) { res.status(500).json({ error: e.message }); }
    });

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
        const newBalance = member[0].points - reward[0].points_cost;
        await pool.query('UPDATE customers SET points = ? WHERE id = ?', [newBalance, customer_id]);
        if (reward[0].stock > 0) await pool.query('UPDATE rewards SET stock = stock - 1 WHERE id = ?', [req.params.id]);
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

    return router;
  },

  hooks: (hooks) => {
    // Hook: after transaction completed, add points
    hooks.register('transaction.completed', 'rewards-loyalty', async (data) => {
      if (data.customer_id) {
        // Points will be added via the addPointsFromTransaction helper
        // This hook is a placeholder for future integration
        console.log(`[rewards-loyalty] Transaction ${data.id} for customer ${data.customer_id}`);
      }
    });
  },

  onEnable: async (pool) => {
    console.log('[rewards-loyalty] Module enabled');
  },

  onDisable: async (pool) => {
    console.log('[rewards-loyalty] Module disabled');
  }
};
