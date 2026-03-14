/**
 * KasirPro Hook System (Frontend)
 * Allows modules to inject behavior into core system
 * 
 * Hook Types:
 * - trigger: Fire & forget, returns array of results
 * - pipe: Pass value through handlers sequentially
 * - collect/renderAll: Collect HTML fragments from handlers
 * - asyncFilter: Async check that can cancel operations
 */
const HookSystem = {
  _hooks: {},
  _debug: false,

  /**
   * Register a hook handler
   * @param {string} hookName - e.g. 'pos.getProductPrice'
   * @param {string} moduleId - e.g. 'vip-pricing'
   * @param {Function} handler - The handler function
   * @param {Object} options - { priority: 10 } (lower = earlier)
   */
  register(hookName, moduleId, handler, options = {}) {
    if (!this._hooks[hookName]) this._hooks[hookName] = [];
    this._hooks[hookName].push({
      moduleId,
      handler,
      priority: options.priority || 50
    });
    // Sort by priority (lower first)
    this._hooks[hookName].sort((a, b) => a.priority - b.priority);
    if (this._debug) console.log(`[Hook] Registered: ${hookName} by ${moduleId} (priority: ${options.priority || 50})`);
  },

  /**
   * Unregister all hooks for a module
   * @param {string} moduleId
   */
  unregister(moduleId) {
    for (const hookName of Object.keys(this._hooks)) {
      this._hooks[hookName] = this._hooks[hookName].filter(h => h.moduleId !== moduleId);
    }
  },

  /**
   * Trigger hook — returns array of results
   * Use for: notifications, collecting data
   */
  trigger(hookName, ...args) {
    const handlers = this._hooks[hookName] || [];
    if (this._debug && handlers.length) console.log(`[Hook] Trigger: ${hookName} (${handlers.length} handlers)`);
    return handlers.map(h => {
      try {
        return h.handler(...args);
      } catch (e) {
        console.error(`[Hook] Error in ${hookName} (${h.moduleId}):`, e);
        return null;
      }
    });
  },

  /**
   * Pipe value through all handlers sequentially
   * Use for: price modification, data transformation
   */
  pipe(hookName, value, ...args) {
    const handlers = this._hooks[hookName] || [];
    if (this._debug && handlers.length) console.log(`[Hook] Pipe: ${hookName} (${handlers.length} handlers)`);
    return handlers.reduce((val, h) => {
      try {
        return h.handler(val, ...args);
      } catch (e) {
        console.error(`[Hook] Error in ${hookName} (${h.moduleId}):`, e);
        return val; // Return unchanged value on error
      }
    }, value);
  },

  /**
   * Collect HTML fragments from all handlers
   * Use for: rendering extra UI sections
   */
  renderAll(hookName, ...args) {
    return this.trigger(hookName, ...args).filter(Boolean).join('');
  },

  /**
   * Async filter — any handler can cancel by returning {allow: false, reason: '...'}
   * Use for: validation before actions (e.g. pos.beforePayment)
   */
  async asyncFilter(hookName, ...args) {
    const handlers = this._hooks[hookName] || [];
    for (const h of handlers) {
      try {
        const result = await h.handler(...args);
        if (result && result.allow === false) {
          return { allowed: false, reason: result.reason || 'Blocked by ' + h.moduleId, moduleId: h.moduleId };
        }
      } catch (e) {
        console.error(`[Hook] Error in ${hookName} (${h.moduleId}):`, e);
      }
    }
    return { allowed: true };
  },

  /**
   * Check if any handlers are registered for a hook
   */
  has(hookName) {
    return (this._hooks[hookName] || []).length > 0;
  },

  /**
   * Get list of all registered hooks (for debugging)
   */
  list() {
    const result = {};
    for (const [name, handlers] of Object.entries(this._hooks)) {
      result[name] = handlers.map(h => ({ moduleId: h.moduleId, priority: h.priority }));
    }
    return result;
  }
};

// Make globally available
window.HookSystem = HookSystem;
