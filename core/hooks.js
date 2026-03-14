/**
 * KasirPro Hook System (Backend)
 * Server-side event/hook system for module integration
 */
class BackendHookSystem {
  constructor() {
    this._hooks = {};
    this._debug = false;
  }

  /**
   * Register a hook handler
   * @param {string} hookName - e.g. 'transaction.afterSave'
   * @param {string} moduleId - e.g. 'member'
   * @param {Function} handler - async function
   * @param {Object} options - { priority: 10 }
   */
  register(hookName, moduleId, handler, options = {}) {
    if (!this._hooks[hookName]) this._hooks[hookName] = [];
    this._hooks[hookName].push({
      moduleId,
      handler,
      priority: options.priority || 50
    });
    this._hooks[hookName].sort((a, b) => a.priority - b.priority);
    if (this._debug) console.log(`[Hook] Registered: ${hookName} by ${moduleId}`);
  }

  /**
   * Unregister all hooks for a module
   */
  unregister(moduleId) {
    for (const hookName of Object.keys(this._hooks)) {
      this._hooks[hookName] = this._hooks[hookName].filter(h => h.moduleId !== moduleId);
    }
  }

  /**
   * Trigger hook — returns array of results
   */
  async trigger(hookName, ...args) {
    const handlers = this._hooks[hookName] || [];
    const results = [];
    for (const h of handlers) {
      try {
        results.push(await h.handler(...args));
      } catch (e) {
        console.error(`[Hook] Error in ${hookName} (${h.moduleId}):`, e.message);
        results.push(null);
      }
    }
    return results;
  }

  /**
   * Pipe value through all handlers sequentially
   */
  async pipe(hookName, value, ...args) {
    const handlers = this._hooks[hookName] || [];
    let result = value;
    for (const h of handlers) {
      try {
        result = await h.handler(result, ...args);
      } catch (e) {
        console.error(`[Hook] Error in ${hookName} (${h.moduleId}):`, e.message);
      }
    }
    return result;
  }

  /**
   * Async filter — any handler can block by returning {allow: false}
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
        console.error(`[Hook] Error in ${hookName} (${h.moduleId}):`, e.message);
      }
    }
    return { allowed: true };
  }

  has(hookName) {
    return (this._hooks[hookName] || []).length > 0;
  }

  list() {
    const result = {};
    for (const [name, handlers] of Object.entries(this._hooks)) {
      result[name] = handlers.map(h => ({ moduleId: h.moduleId, priority: h.priority }));
    }
    return result;
  }
}

// Singleton
const hooks = new BackendHookSystem();
module.exports = hooks;
