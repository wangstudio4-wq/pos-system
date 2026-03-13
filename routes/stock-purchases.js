// Stock Purchase (Stok Masuk) routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============ STOCK PURCHASE (STOK MASUK) ============
// GET all purchases
router.get('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { start_date, end_date, supplier_id } = req.query;
    let query = 'SELECT * FROM stock_purchases';
    let conditions = [];
    let params = [];
    if (start_date && end_date) {
      conditions.push('DATE(created_at) BETWEEN ? AND ?');
      params.push(start_date, end_date);
    }
    if (supplier_id) {
      conditions.push('supplier_id = ?');
      params.push(supplier_id);
    }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data pembelian.' });
  }
});

// GET purchase detail
router.get('/:id', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const [purchase] = await pool.query('SELECT * FROM stock_purchases WHERE id = ?', [req.params.id]);
    if (purchase.length === 0) return res.status(404).json({ error: 'Pembelian tidak ditemukan.' });
    const [items] = await pool.query('SELECT * FROM stock_purchase_items WHERE purchase_id = ?', [req.params.id]);
    res.json({ purchase: purchase[0], items });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil detail pembelian.' });
  }
});

// POST new purchase (creates purchase + adds stock + records movements)
router.post('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { invoice_number, supplier_id, supplier_name, items, notes } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || req.user.username;

    if (!items || items.length === 0) return res.status(400).json({ error: 'Item pembelian kosong.' });

    const totalAmount = items.reduce((sum, i) => sum + (i.qty * (i.cost_price || 0)), 0);

    const [purchaseResult] = await conn.query(
      'INSERT INTO stock_purchases (invoice_number, supplier_id, supplier_name, user_id, user_name, notes, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [invoice_number || null, supplier_id || null, supplier_name || null, userId, userName, notes || null, totalAmount]
    );
    const purchaseId = purchaseResult.insertId;

    for (const item of items) {
      await conn.query(
        'INSERT INTO stock_purchase_items (purchase_id, product_id, product_name, qty, cost_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        [purchaseId, item.product_id, item.product_name, item.qty, item.cost_price || 0, item.qty * (item.cost_price || 0)]
      );

      // Get current stock
      const [prod] = await conn.query('SELECT stock FROM products WHERE id = ?', [item.product_id]);
      const beforeStock = prod.length > 0 ? prod[0].stock : 0;
      const afterStock = beforeStock + item.qty;

      // Update product stock and optionally cost_price
      if (item.cost_price && item.cost_price > 0) {
        await conn.query('UPDATE products SET stock = ?, cost_price = ? WHERE id = ?', [afterStock, item.cost_price, item.product_id]);
      } else {
        await conn.query('UPDATE products SET stock = ? WHERE id = ?', [afterStock, item.product_id]);
      }

      // Record stock movement
      await conn.query(
        'INSERT INTO stock_movements (product_id, product_name, type, qty, before_stock, after_stock, reference_type, reference_id, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item.product_id, item.product_name, 'purchase', item.qty, beforeStock, afterStock, 'stock_purchases', purchaseId, 'Pembelian stok', userId, userName]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'Pembelian stok berhasil dicatat!', purchase: { id: purchaseId, total_amount: totalAmount } });
  } catch (err) {
    await conn.rollback();
    console.error('Stock purchase error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pembelian stok.' });
  } finally { conn.release(); }
});

// DELETE purchase (restores stock)
router.delete('/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [items] = await conn.query('SELECT * FROM stock_purchase_items WHERE purchase_id = ?', [req.params.id]);
    const userName = req.user.name || req.user.username;

    for (const item of items) {
      const [prod] = await conn.query('SELECT stock FROM products WHERE id = ?', [item.product_id]);
      const beforeStock = prod.length > 0 ? prod[0].stock : 0;
      const afterStock = Math.max(0, beforeStock - item.qty);
      await conn.query('UPDATE products SET stock = ? WHERE id = ?', [afterStock, item.product_id]);
      await conn.query(
        'INSERT INTO stock_movements (product_id, product_name, type, qty, before_stock, after_stock, reference_type, reference_id, notes, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item.product_id, item.product_name, 'adjustment', -item.qty, beforeStock, afterStock, 'stock_purchases', req.params.id, 'Hapus pembelian stok', req.user.id, userName]
      );
    }

    await conn.query('DELETE FROM stock_purchase_items WHERE purchase_id = ?', [req.params.id]);
    await conn.query('DELETE FROM stock_purchases WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ message: 'Pembelian berhasil dihapus dan stok dikembalikan.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Gagal menghapus pembelian.' });
  } finally { conn.release(); }
});

module.exports = router;
