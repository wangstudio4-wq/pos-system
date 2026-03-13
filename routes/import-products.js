// Import Products routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ============ IMPORT PRODUCTS (EXCEL/CSV) ============
router.post('/import', authenticateToken, authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const { products } = req.body; // Array of { name, barcode, price, cost_price, stock, min_stock, category_name }
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Data produk kosong.' });
    }

    // Get categories for matching
    const [categories] = await pool.query('SELECT id, name FROM categories');
    const catMap = {};
    categories.forEach(c => { catMap[c.name.toLowerCase()] = c.id; });

    let imported = 0;
    let skipped = 0;
    let errors = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.name) { skipped++; errors.push(`Baris ${i+1}: Nama kosong`); continue; }
      try {
        const categoryId = p.category_name ? (catMap[p.category_name.toLowerCase()] || null) : null;
        await pool.query(
          'INSERT INTO products (barcode, name, price, cost_price, stock, min_stock, category_id, unit, purchase_unit, conversion_ratio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [p.barcode || null, p.name, p.price || 0, p.cost_price || 0, p.stock || 0, p.min_stock || 5, categoryId, p.unit || 'pcs', p.purchase_unit || null, p.conversion_ratio || 1]
        );
        imported++;
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          skipped++;
          errors.push(`Baris ${i+1}: Barcode "${p.barcode}" sudah ada`);
        } else {
          skipped++;
          errors.push(`Baris ${i+1}: ${e.message}`);
        }
      }
    }

    res.json({ message: `Import selesai: ${imported} berhasil, ${skipped} dilewati.`, imported, skipped, errors });
  } catch (err) {
    console.error('Import products error:', err);
    res.status(500).json({ error: 'Gagal import produk.' });
  }
});

module.exports = router;
