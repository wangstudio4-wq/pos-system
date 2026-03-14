const express = require('express');
const router = express.Router();

/**
 * KasirPro Module Registry (Backend API)
 * Manages module enable/disable and provides module info to frontend
 */

// GET /api/modules/enabled — List enabled modules (for frontend loader)
router.get('/enabled', async (req, res) => {
  try {
    const pool = req.app.get('db');
    
    // Check if modules table exists
    const [tables] = await pool.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modules'"
    );
    
    if (tables.length === 0) {
      // No modules table yet — return empty (core-only mode)
      return res.json([]);
    }

    const [modules] = await pool.query(
      'SELECT id, name, icon, version, category, description FROM modules WHERE is_enabled = 1 ORDER BY load_order, name'
    );
    res.json(modules);
  } catch (err) {
    console.error('Error fetching enabled modules:', err.message);
    res.json([]); // Graceful fallback
  }
});

// GET /api/modules — List all modules (for Module Manager page)
router.get('/', async (req, res) => {
  try {
    const pool = req.app.get('db');
    
    const [tables] = await pool.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modules'"
    );
    
    if (tables.length === 0) {
      return res.json([]);
    }

    const [modules] = await pool.query(
      'SELECT * FROM modules ORDER BY category, name'
    );
    res.json(modules);
  } catch (err) {
    console.error('Error fetching modules:', err.message);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

// PUT /api/modules/:id/toggle — Enable/disable a module
router.put('/:id/toggle', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { id } = req.params;

    const [tables] = await pool.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modules'"
    );
    
    if (tables.length === 0) {
      return res.status(400).json({ error: 'Module system not initialized' });
    }

    // Get current state
    const [rows] = await pool.query('SELECT * FROM modules WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const mod = rows[0];
    const newState = mod.is_enabled ? 0 : 1;

    // If enabling, check dependencies
    if (newState === 1 && mod.dependencies) {
      const deps = JSON.parse(mod.dependencies || '[]');
      for (const dep of deps) {
        const [depRows] = await pool.query('SELECT is_enabled FROM modules WHERE id = ?', [dep]);
        if (depRows.length === 0 || !depRows[0].is_enabled) {
          return res.status(400).json({ 
            error: `Module "${id}" requires "${dep}" to be enabled first` 
          });
        }
      }
    }

    // If disabling, check if other modules depend on this
    if (newState === 0) {
      const [dependents] = await pool.query(
        "SELECT id, name FROM modules WHERE is_enabled = 1 AND JSON_CONTAINS(dependencies, ?)",
        [JSON.stringify(id)]
      );
      if (dependents.length > 0) {
        return res.status(400).json({
          error: `Cannot disable "${id}": required by ${dependents.map(d => d.name).join(', ')}`
        });
      }
    }

    await pool.query('UPDATE modules SET is_enabled = ?, updated_at = NOW() WHERE id = ?', [newState, id]);

    res.json({ 
      success: true, 
      id, 
      is_enabled: !!newState,
      message: newState ? `Module "${mod.name}" enabled` : `Module "${mod.name}" disabled`
    });
  } catch (err) {
    console.error('Error toggling module:', err.message);
    res.status(500).json({ error: 'Failed to toggle module' });
  }
});

module.exports = router;
