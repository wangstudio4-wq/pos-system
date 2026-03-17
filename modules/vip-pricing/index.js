/**
 * VIP Pricing Module (Backend)
 * Harga spesial per level member atau per customer
 */
const express = require('express');

module.exports = {
  id: 'vip-pricing',
  name: 'Harga VIP',
  icon: '👑',
  version: '1.0.0',
  category: 'pricing',
  description: 'Atur harga khusus per level member atau per pelanggan tertentu',
  is_core: false,
  dependencies: [],
  optionalDependencies: ['member'],

  // Database migrations
  migrations: [
    {
      version: 1,
      up: `CREATE TABLE IF NOT EXISTS special_prices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        level_id INT DEFAULT NULL,
        customer_id INT DEFAULT NULL,
        special_price DECIMAL(15,2) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        start_date DATE DEFAULT NULL,
        end_date DATE DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_product (product_id),
        INDEX idx_level (level_id),
        INDEX idx_customer (customer_id)
      )`
    },
    {
      version: 2,
      up: `CREATE TABLE IF NOT EXISTS price_tiers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        min_qty INT NOT NULL DEFAULT 1,
        price DECIMAL(15,2) NOT NULL,
        INDEX idx_product (product_id)
      )`
    }
  ],

  // Pages registered to frontend
  pages: [
    { id: 'vip-prices', label: 'Harga VIP', icon: '👑', roles: ['owner', 'admin'] }
  ],

  // Register routes
  routes: (router, pool, auth, authorizeRole) => {
    // ============ SPECIAL PRICES (VIP) ============

    // GET all special prices
    router.get('/special-prices', auth, async (req, res) => {
      try {
        let sql = 'SELECT sp.*, p.name as product_name, p.price as normal_price, ml.name as level_name, ml.icon as level_icon, c.name as customer_name FROM special_prices sp LEFT JOIN products p ON sp.product_id = p.id LEFT JOIN member_levels ml ON sp.level_id = ml.id LEFT JOIN customers c ON sp.customer_id = c.id WHERE 1=1';
        const params = [];
        if (req.query.level_id) { sql += ' AND sp.level_id = ?'; params.push(req.query.level_id); }
        if (req.query.customer_id) { sql += ' AND sp.customer_id = ?'; params.push(req.query.customer_id); }
        sql += ' ORDER BY sp.product_id, sp.level_id';
        const [rows] = await pool.query(sql, params);
        res.json(rows);
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // GET special prices for a product
    router.get('/special-prices/product/:productId', auth, async (req, res) => {
      try {
        const [rows] = await pool.query(
          'SELECT sp.*, ml.name as level_name, ml.icon as level_icon, c.name as customer_name FROM special_prices sp LEFT JOIN member_levels ml ON sp.level_id = ml.id LEFT JOIN customers c ON sp.customer_id = c.id WHERE sp.product_id = ? ORDER BY sp.level_id, sp.customer_id',
          [req.params.productId]
        );
        res.json(rows);
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // GET special prices for a member (POS use)
    router.get('/special-prices/for-member/:customerId', auth, async (req, res) => {
      try {
        const { customerId } = req.params;
        const [customer] = await pool.query('SELECT level_id FROM customers WHERE id = ?', [customerId]);
        const levelId = customer[0]?.level_id || null;
        const today = new Date().toISOString().split('T')[0];
        const [rows] = await pool.query(
          'SELECT sp.product_id, sp.special_price, sp.level_id, sp.customer_id, sp.description FROM special_prices sp WHERE sp.is_active = 1 AND (sp.customer_id = ? OR (sp.customer_id IS NULL AND sp.level_id = ?)) AND (sp.start_date IS NULL OR sp.start_date <= ?) AND (sp.end_date IS NULL OR sp.end_date >= ?) ORDER BY sp.customer_id DESC, sp.level_id DESC',
          [customerId, levelId, today, today]
        );
        res.json(rows);
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // POST create/update special price
    router.post('/special-prices', auth, authorizeRole('admin', 'owner'), async (req, res) => {
      try {
        const { product_id, level_id, customer_id, special_price, description, start_date, end_date, is_active } = req.body;
        const [existing] = await pool.query(
          'SELECT id FROM special_prices WHERE product_id = ? AND (level_id <=> ?) AND (customer_id <=> ?)',
          [product_id, level_id || null, customer_id || null]
        );
        if (existing.length > 0) {
          await pool.query(
            'UPDATE special_prices SET special_price = ?, description = ?, start_date = ?, end_date = ?, is_active = ? WHERE id = ?',
            [special_price, description || null, start_date || null, end_date || null, is_active !== undefined ? is_active : 1, existing[0].id]
          );
          res.json({ id: existing[0].id, updated: true });
        } else {
          const [result] = await pool.query(
            'INSERT INTO special_prices (product_id, level_id, customer_id, special_price, description, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [product_id, level_id || null, customer_id || null, special_price, description || null, start_date || null, end_date || null, is_active !== undefined ? is_active : 1]
          );
          res.json({ id: result.insertId, created: true });
        }
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // POST batch set prices for a product
    router.post('/special-prices/batch/:productId', auth, authorizeRole('admin', 'owner'), async (req, res) => {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const productId = req.params.productId;
        const { prices } = req.body;
        if (prices && prices.length > 0) {
          await conn.query('DELETE FROM special_prices WHERE product_id = ? AND customer_id IS NULL', [productId]);
          for (const p of prices) {
            await conn.query(
              'INSERT INTO special_prices (product_id, level_id, customer_id, special_price, description, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1) ',
              [productId, p.level_id, null, p.special_price, p.description || null, p.start_date || null, p.end_date || null]
            );
          }
        }
        await conn.commit();
        const [rows] = await conn.query('SELECT sp.*, ml.name as level_name, ml.icon as level_icon FROM special_prices sp LEFT JOIN member_levels ml ON sp.level_id = ml.id WHERE sp.product_id = ?', [productId]);
        res.json({ success: true, prices: rows });
      } catch (err) { await conn.rollback(); res.status(500).json({ error: err.message }); }
      finally { conn.release(); }
    });

    // GET stats
    router.get('/special-prices/stats', auth, async (req, res) => {
      try {
        const [[stats]] = await pool.query(
          'SELECT COUNT(DISTINCT product_id) as products_with_special, COUNT(*) as total_special_prices, COUNT(DISTINCT level_id) as levels_configured, COUNT(DISTINCT customer_id) as customers_with_vip FROM special_prices WHERE is_active = 1'
        );
        res.json(stats);
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // DELETE a special price
    router.delete('/special-prices/:id', auth, authorizeRole('admin', 'owner'), async (req, res) => {
      try {
        await pool.query('DELETE FROM special_prices WHERE id = ?', [req.params.id]);
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ============ PRICE TIERS (HARGA GROSIR) ============

    // GET price tiers for a product
    router.get('/products/:id/price-tiers', auth, async (req, res) => {
      try {
        const [rows] = await pool.query('SELECT * FROM price_tiers WHERE product_id = ? ORDER BY min_qty ASC', [req.params.id]);
        res.json(rows);
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // GET all price tiers (for POS - bulk load)
    router.get('/price-tiers', auth, async (req, res) => {
      try {
        const [rows] = await pool.query('SELECT * FROM price_tiers ORDER BY product_id, min_qty ASC');
        res.json(rows);
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // POST save price tiers for a product
    router.post('/products/:id/price-tiers', auth, authorizeRole('admin', 'owner'), async (req, res) => {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const { tiers } = req.body;
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
      } catch (err) { await conn.rollback(); res.status(500).json({ error: err.message }); }
      finally { conn.release(); }
    });

    return router;
  },

  // Hooks into core system
  hooks: {
    'pos.calculatePrice': (product, qty, member) => {
      // Module can override price in POS based on member level/customer
      // This is called via HookSystem.pipe('pos.calculatePrice', basePrice, product, qty, member)
    },
    'dashboard.getWidgets': () => [{
      type: 'stat',
      title: 'Harga VIP Aktif',
      query: 'SELECT COUNT(*) as value FROM special_prices WHERE is_active = 1'
    }]
  },

  // Lifecycle
  onEnable: async (db) => {
    console.log('[vip-pricing] Module enabled');
  },
  onDisable: async (db) => {
    console.log('[vip-pricing] Module disabled (data preserved)');
  }
};
