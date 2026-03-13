// Transaction routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.post('/transactions', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { items, subtotal, discount, total, payment, change, payment_method, customer_id, customer_name, notes, tax_amount, tax_name, tax_rate, service_charge, service_charge_rate } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || req.user.username;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang kosong.' });
    }

    const [txResult] = await conn.query(
      `INSERT INTO transactions (subtotal, discount, total, payment, \`change\`, payment_method, user_id, user_name, customer_id, customer_name, notes, tax_amount, tax_name, tax_rate, service_charge, service_charge_rate) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subtotal || total, discount || 0, total, payment, change, payment_method || 'cash', userId, userName, customer_id || null, customer_name || null, notes || null, tax_amount || 0, tax_name || null, tax_rate || 0, service_charge || 0, service_charge_rate || 0]
    );

    const txId = txResult.insertId;

    for (const item of items) {
      await conn.query(
        'INSERT INTO transaction_items (transaction_id, product_id, product_name, price, cost_price, qty, subtotal, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [txId, item.id, item.name, item.price, item.cost_price || 0, item.qty, item.price * item.qty, item.discount || 0]
      );

      await conn.query(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [item.qty, item.id, item.qty]
      );

      // Record stock movement for sale
      try {
        const [prodStock] = await conn.query('SELECT stock FROM products WHERE id = ?', [item.id]);
        const afterStock = prodStock.length > 0 ? prodStock[0].stock : 0;
        await conn.query(
          'INSERT INTO stock_movements (product_id, product_name, type, qty, before_stock, after_stock, reference_type, reference_id, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [item.id, item.name, 'sale', -item.qty, afterStock + item.qty, afterStock, 'transactions', txId, 'Penjualan', userId, userName]
        );
      } catch (e) { console.log('Stock movement log failed:', e.message); }
    }

    // Create kasbon/debt record if payment method is Hutang
    if ((payment_method || '').toLowerCase() === 'hutang') {
      await conn.query(
        'INSERT INTO debts (customer_name, customer_phone, transaction_id, amount, paid, remaining, status, notes, user_id, user_name) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)',
        [customer_name || 'Tanpa Nama', req.body.customer_phone || null, txId, total, total, 'unpaid', notes || null, userId, userName]
      );
    }

    await conn.commit();

    // Auto-add points if member is attached
    if (customer_id) {
      addPointsFromTransaction(customer_id, total, txId, userName).catch(e => console.error('Points error:', e));
    }

    res.status(201).json({
      message: 'Transaksi berhasil!',
      transaction: { id: txId, total, payment, change, payment_method: payment_method || 'cash', cashier: userName }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Transaction error:', err);
    res.status(500).json({ error: 'Gagal menyimpan transaksi.' });
  } finally {
    conn.release();
  }
});

// GET my transactions (for kasir - only their own)
router.get('/my-transactions', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    res.json({ transactions: rows });
  } catch (err) {
    console.error('Get my transactions error:', err);
    res.status(500).json({ error: 'Gagal mengambil data transaksi.' });
  }
});

// GET transactions
router.get('/transactions', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { date, start_date, end_date, user_id } = req.query;
    let query = 'SELECT * FROM transactions';
    let conditions = [];
    let params = [];

    if (date) {
      conditions.push('DATE(created_at) = ?');
      params.push(date);
    } else if (start_date && end_date) {
      conditions.push('DATE(created_at) BETWEEN ? AND ?');
      params.push(start_date, end_date);
    }

    if (user_id) {
      conditions.push('user_id = ?');
      params.push(user_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: 'Gagal mengambil data transaksi.' });
  }
});

// GET transaction detail
router.get('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const [tx] = await pool.query('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (tx.length === 0) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    }

    const [items] = await pool.query(
      'SELECT * FROM transaction_items WHERE transaction_id = ?',
      [req.params.id]
    );

    res.json({ transaction: tx[0], items });
  } catch (err) {
    console.error('Get transaction detail error:', err);
    res.status(500).json({ error: 'Gagal mengambil detail transaksi.' });
  }
});

// VOID transaction
router.post('/transactions/:id/void', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Alasan void wajib diisi.' });

    const [tx] = await conn.query('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (tx.length === 0) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (tx[0].status === 'void') return res.status(400).json({ error: 'Transaksi sudah di-void.' });
    if (tx[0].status === 'refund') return res.status(400).json({ error: 'Transaksi sudah di-refund.' });

    // Restore stock
    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [req.params.id]);
    for (const item of items) {
      await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.qty || item.quantity, item.product_id]);

      // Record stock movement for void
      try {
        const [prodStock] = await conn.query('SELECT stock FROM products WHERE id = ?', [item.product_id]);
        const afterStock = prodStock.length > 0 ? prodStock[0].stock : 0;
        await conn.query(
          'INSERT INTO stock_movements (product_id, product_name, type, qty, before_stock, after_stock, reference_type, reference_id, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [item.product_id, item.product_name, 'void', item.qty || item.quantity, afterStock - (item.qty || item.quantity), afterStock, 'transactions', req.params.id, 'Void transaksi', req.user.id, req.user.name || req.user.username]
        );
      } catch (e) { console.log('Stock movement log failed:', e.message); }
    }

    await conn.query(
      'UPDATE transactions SET status = ?, void_reason = ?, voided_by = ?, voided_at = NOW() WHERE id = ?',
      ['void', reason, req.user.name || req.user.username, req.params.id]
    );

    await conn.commit();
    res.json({ message: 'Transaksi berhasil di-void.' });
  } catch (err) {
    await conn.rollback();
    console.error('Void error:', err);
    res.status(500).json({ error: 'Gagal void transaksi.' });
  } finally { conn.release(); }
});

// REFUND transaction
router.post('/transactions/:id/refund', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Alasan refund wajib diisi.' });

    const [tx] = await conn.query('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (tx.length === 0) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (tx[0].status === 'void') return res.status(400).json({ error: 'Transaksi sudah di-void.' });
    if (tx[0].status === 'refund') return res.status(400).json({ error: 'Transaksi sudah di-refund.' });

    // Restore stock
    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [req.params.id]);
    for (const item of items) {
      await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.qty || item.quantity, item.product_id]);

      // Record stock movement for refund
      try {
        const [prodStock] = await conn.query('SELECT stock FROM products WHERE id = ?', [item.product_id]);
        const afterStock = prodStock.length > 0 ? prodStock[0].stock : 0;
        await conn.query(
          'INSERT INTO stock_movements (product_id, product_name, type, qty, before_stock, after_stock, reference_type, reference_id, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [item.product_id, item.product_name, 'refund', item.qty || item.quantity, afterStock - (item.qty || item.quantity), afterStock, 'transactions', req.params.id, 'Refund transaksi', req.user.id, req.user.name || req.user.username]
        );
      } catch (e) { console.log('Stock movement log failed:', e.message); }
    }

    await conn.query(
      'UPDATE transactions SET status = ?, void_reason = ?, voided_by = ?, voided_at = NOW() WHERE id = ?',
      ['refund', reason, req.user.name || req.user.username, req.params.id]
    );

    await conn.commit();
    res.json({ message: 'Transaksi berhasil di-refund.' });
  } catch (err) {
    await conn.rollback();
    console.error('Refund error:', err);
    res.status(500).json({ error: 'Gagal refund transaksi.' });
  } finally { conn.release(); }
});

// GET sales report

module.exports = router;
