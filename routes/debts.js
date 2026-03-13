// Kasbon (Debts) routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============ KASBON (HUTANG) ============

// GET all debts (with filters)
router.get('/debts', authenticateToken, async (req, res) => {
  try {
    const { status, customer_name } = req.query;
    let query = 'SELECT * FROM debts';
    let conditions = [];
    let params = [];
    if (status && status !== 'all') { conditions.push('status = ?'); params.push(status); }
    if (customer_name) { conditions.push('customer_name LIKE ?'); params.push('%' + customer_name + '%'); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(query, params);
    
    // Also get summary
    const [summary] = await pool.query(`SELECT 
      COUNT(*) as total_debts,
      COALESCE(SUM(amount), 0) as total_amount,
      COALESCE(SUM(paid), 0) as total_paid,
      COALESCE(SUM(remaining), 0) as total_remaining,
      COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_count,
      COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_count,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
      FROM debts`);
    
    res.json({ debts: rows, summary: summary[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET debt detail with payments
router.get('/debts/:id', authenticateToken, async (req, res) => {
  try {
    const [debt] = await pool.query('SELECT * FROM debts WHERE id = ?', [req.params.id]);
    if (debt.length === 0) return res.status(404).json({ error: 'Kasbon tidak ditemukan.' });
    const [payments] = await pool.query('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY created_at DESC', [req.params.id]);
    // Get transaction items if linked
    let items = [];
    if (debt[0].transaction_id) {
      const [txItems] = await pool.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [debt[0].transaction_id]);
      items = txItems;
    }
    res.json({ debt: debt[0], payments, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST pay debt
router.post('/debts/:id/pay', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { amount, payment_method, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Jumlah bayar harus lebih dari 0.' });
    
    const [debt] = await conn.query('SELECT * FROM debts WHERE id = ?', [req.params.id]);
    if (debt.length === 0) return res.status(404).json({ error: 'Kasbon tidak ditemukan.' });
    if (debt[0].status === 'paid') return res.status(400).json({ error: 'Kasbon sudah lunas.' });
    
    const payAmount = Math.min(amount, debt[0].remaining);
    const newPaid = Number(debt[0].paid) + payAmount;
    const newRemaining = Number(debt[0].amount) - newPaid;
    const newStatus = newRemaining <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
    
    await conn.query('INSERT INTO debt_payments (debt_id, amount, payment_method, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, payAmount, payment_method || 'Cash', notes || null, req.user.id, req.user.name || req.user.username]);
    
    await conn.query('UPDATE debts SET paid = ?, remaining = ?, status = ? WHERE id = ?',
      [newPaid, Math.max(newRemaining, 0), newStatus, req.params.id]);
    
    await conn.commit();
    res.json({ message: newStatus === 'paid' ? 'Kasbon LUNAS! 🎉' : 'Pembayaran berhasil dicatat.', paid: payAmount, remaining: Math.max(newRemaining, 0), status: newStatus });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// GET customer suggestions for kasbon (autocomplete)
router.get('/kasbon-customers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT customer_name as name, customer_phone as phone, 
      COUNT(*) as total_debts, COALESCE(SUM(remaining), 0) as total_remaining
      FROM debts GROUP BY customer_name, customer_phone ORDER BY customer_name`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
