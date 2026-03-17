/**
 * KasirPro Module: Rewards & Loyalty (Frontend)
 * Registers rewards page renderer to KasirModules
 */
(function() {
  if (typeof KasirModules !== 'undefined') {
    KasirModules.register({
      id: 'rewards-loyalty',
      name: 'Rewards & Loyalty',
      pages: { rewards: window.renderRewards },
      hooks: {}
    });
  }
})();
