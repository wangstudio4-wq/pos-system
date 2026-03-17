/**
 * VIP Pricing Module (Frontend)
 * Registers with KasirModules for dynamic loading
 */
(function() {
  // All the VIP pricing functions are already in pages/vip-prices.js
  // This module wrapper registers them with the module system
  
  window.KasirModules = window.KasirModules || {};
  window.KasirModules['vip-pricing'] = {
    id: 'vip-pricing',
    name: 'Harga VIP',
    icon: '👑',
    version: '1.0.0',

    // Pages this module provides
    pages: [
      { id: 'vip-prices', label: 'Harga VIP', icon: '👑', roles: ['owner', 'admin'], section: 'pricing' }
    ],

    // Page renderers
    renderers: {
      'vip-prices': typeof renderVIPPrices === 'function' ? renderVIPPrices : null
    },

    // Hooks
    hooks: {
      'pos.calculatePrice': function(price, product, qty, member) {
        // VIP price override will be handled here
        // For now, the POS already handles this inline
        return price;
      }
    },

    hookPriority: 40
  };
})();
