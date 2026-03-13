// Settings routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============ SETTINGS ============
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1');
    res.json(rows[0] || {});
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Gagal mengambil settings.' });
  }
});

router.put('/', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { store_name, store_address, store_phone, tax_enabled, tax_name, tax_rate, service_charge_enabled, service_charge_rate, receipt_footer, store_logo_url } = req.body;
    await pool.query(
      `UPDATE settings SET store_name=?, store_address=?, store_phone=?, tax_enabled=?, tax_name=?, tax_rate=?, service_charge_enabled=?, service_charge_rate=?, receipt_footer=?, store_logo_url=? WHERE id = 1`,
      [store_name || 'KasirPro', store_address || null, store_phone || null, tax_enabled ? 1 : 0, tax_name || 'PB1', tax_rate || 10, service_charge_enabled ? 1 : 0, service_charge_rate || 5, receipt_footer || 'Terima kasih telah berbelanja!', store_logo_url || null]
    );
    const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1');
    res.json({ message: 'Settings berhasil disimpan!', settings: rows[0] });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Gagal menyimpan settings.' });
  }
});

// POST new transaction (updated with payment method, customer, discount)

module.exports = router;
