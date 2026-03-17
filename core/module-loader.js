/**
 * KasirPro Backend Module Loader
 * Loads enabled modules, runs migrations, mounts routes
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

class BackendModuleLoader {
  constructor(app, pool, auth, authorizeRole, hooks) {
    this.app = app;
    this.pool = pool;
    this.auth = auth;
    this.authorizeRole = authorizeRole;
    this.hooks = hooks;
    this.loaded = {};
  }

  /**
   * Load all enabled modules from DB
   */
  async init() {
    try {
      // Check if modules table exists
      const [tables] = await this.pool.query(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modules'"
      );
      if (tables.length === 0) {
        console.log('[ModuleLoader] No modules table yet, running core-only');
        return;
      }

      // Get enabled modules
      const [modules] = await this.pool.query(
        'SELECT * FROM modules WHERE is_enabled = 1 ORDER BY load_order, name'
      );

      for (const mod of modules) {
        if (mod.is_core) continue; // Core routes are already mounted
        try {
          await this.loadModule(mod);
        } catch (e) {
          console.error(`[ModuleLoader] Failed to load module: ${mod.id}`, e.message);
        }
      }

      console.log(`[ModuleLoader] Loaded ${Object.keys(this.loaded).length} module(s)`);
    } catch (e) {
      console.warn('[ModuleLoader] Module system not available:', e.message);
    }
  }

  /**
   * Load a single module
   */
  async loadModule(modRecord) {
    const modPath = path.join(__dirname, '..', 'modules', modRecord.id, 'index.js');
    
    if (!fs.existsSync(modPath)) {
      console.warn(`[ModuleLoader] Module file not found: ${modPath}`);
      return;
    }

    const modDef = require(modPath);

    // Validate dependencies
    if (modDef.dependencies && modDef.dependencies.length > 0) {
      for (const dep of modDef.dependencies) {
        const [depRows] = await this.pool.query(
          'SELECT is_enabled FROM modules WHERE id = ?', [dep]
        );
        if (depRows.length === 0 || !depRows[0].is_enabled) {
          console.warn(`[ModuleLoader] Module "${modRecord.id}" requires "${dep}" — skipping`);
          return;
        }
      }
    }

    // Run migrations
    await this.runMigrations(modDef);

    // Mount routes
    if (modDef.routes) {
      const router = express.Router();
      modDef.routes(router, this.pool, this.auth, this.authorizeRole);
      this.app.use('/api', router);
      console.log(`[ModuleLoader] Routes mounted for: ${modRecord.id}`);
    }

    // Register hooks
    if (modDef.hooks && this.hooks) {
      for (const [hookName, handler] of Object.entries(modDef.hooks)) {
        this.hooks.register(hookName, modRecord.id, handler);
      }
    }

    // Lifecycle callback
    if (modDef.onEnable) {
      await modDef.onEnable(this.pool);
    }

    this.loaded[modRecord.id] = modDef;
  }

  /**
   * Run module migrations
   */
  async runMigrations(modDef) {
    if (!modDef.migrations || modDef.migrations.length === 0) return;

    // Ensure module_migrations table exists
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS module_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        module_id VARCHAR(50) NOT NULL,
        version INT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_module_version (module_id, version)
      )
    `);

    // Get applied versions
    const [applied] = await this.pool.query(
      'SELECT version FROM module_migrations WHERE module_id = ?', [modDef.id]
    );
    const appliedVersions = new Set(applied.map(r => r.version));

    // Run pending migrations
    for (const migration of modDef.migrations) {
      if (!appliedVersions.has(migration.version)) {
        try {
          await this.pool.query(migration.up);
          await this.pool.query(
            'INSERT INTO module_migrations (module_id, version) VALUES (?, ?)',
            [modDef.id, migration.version]
          );
          console.log(`[ModuleLoader] Migration ${modDef.id} v${migration.version} applied`);
        } catch (e) {
          // Table might already exist — that's OK
          if (e.code === 'ER_TABLE_EXISTS_ERROR') {
            await this.pool.query(
              'INSERT IGNORE INTO module_migrations (module_id, version) VALUES (?, ?)',
              [modDef.id, migration.version]
            );
          } else {
            console.error(`[ModuleLoader] Migration ${modDef.id} v${migration.version} failed:`, e.message);
          }
        }
      }
    }
  }

  /**
   * Check if a module is loaded
   */
  isLoaded(moduleId) {
    return !!this.loaded[moduleId];
  }

  /**
   * Get all loaded modules
   */
  getAll() {
    return { ...this.loaded };
  }
}

module.exports = BackendModuleLoader;
