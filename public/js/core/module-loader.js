/**
 * KasirPro Module Loader (Frontend)
 * Loads enabled modules, registers their pages/hooks/renderers
 */
const ModuleLoader = {
  _modules: {},       // Loaded module definitions
  _menuExtras: [],    // Extra menu items from modules

  /**
   * Initialize: fetch enabled modules and load them
   */
  async init() {
    try {
      const resp = await apiFetch('/api/modules/enabled');
      if (!resp.ok) {
        console.warn('[ModuleLoader] Could not fetch modules, running core-only mode');
        return;
      }
      const modules = await resp.json();

      for (const mod of modules) {
        try {
          await this.loadModule(mod);
        } catch (e) {
          console.error(`[ModuleLoader] Failed to load module: ${mod.id}`, e);
        }
      }

      console.log(`[ModuleLoader] Loaded ${Object.keys(this._modules).length} modules`);
    } catch (e) {
      // API not available or no modules table yet — that's fine
      console.warn('[ModuleLoader] Module system not available yet, running core-only');
    }
  },

  /**
   * Load a single module's frontend JS
   */
  async loadModule(mod) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `/modules/${mod.id}/frontend.js`;
      script.onload = () => {
        // Module should register itself via window.KasirModules[modId]
        const def = window.KasirModules && window.KasirModules[mod.id];
        if (def) {
          this._modules[mod.id] = def;

          // Register hooks
          if (def.hooks) {
            for (const [hookName, handler] of Object.entries(def.hooks)) {
              HookSystem.register(hookName, mod.id, handler, { priority: def.hookPriority || 50 });
            }
          }

          // Register page renderers
          if (def.renderers) {
            for (const [pageId, renderer] of Object.entries(def.renderers)) {
              if (typeof window.renderers === 'object') {
                window.renderers[pageId] = renderer;
              }
            }
          }

          // Collect menu items
          if (def.pages) {
            this._menuExtras.push(...def.pages);
          }
        }
        resolve();
      };
      script.onerror = () => {
        console.warn(`[ModuleLoader] Could not load /modules/${mod.id}/frontend.js`);
        resolve(); // Don't fail the whole chain
      };
      document.head.appendChild(script);
    });
  },

  /**
   * Get extra menu items from loaded modules
   */
  getExtraMenuItems(currentRole) {
    return this._menuExtras.filter(item => {
      if (!item.roles) return true;
      return item.roles.includes(currentRole);
    });
  },

  /**
   * Check if a module is loaded
   */
  isLoaded(moduleId) {
    return !!this._modules[moduleId];
  },

  /**
   * Get loaded module definition
   */
  get(moduleId) {
    return this._modules[moduleId] || null;
  },

  /**
   * Get all loaded modules
   */
  getAll() {
    return { ...this._modules };
  }
};

// Make globally available
window.ModuleLoader = ModuleLoader;
// Module registration namespace
window.KasirModules = window.KasirModules || {};
