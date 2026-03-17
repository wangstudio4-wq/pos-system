const express = require('express');
const cors = require('cors');

const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Route imports
const authRoutes = require('../routes/auth');
const userRoutes = require('../routes/users');
const categoryRoutes = require('../routes/categories');
const expenseRoutes = require('../routes/expenses');
const shiftRoutes = require('../routes/shifts');
const setupRoutes = require('../routes/setup');
const dashboardRoutes = require('../routes/dashboard');
const productRoutes = require('../routes/products');
// price-tiers: moved to modules/vip-pricing
const discountRoutes = require('../routes/discounts');
const debtRoutes = require('../routes/debts');
const settingsRoutes = require('../routes/settings');
const transactionRoutes = require('../routes/transactions');
const reportRoutes = require('../routes/reports');
const supplierRoutes = require('../routes/suppliers');
const stockPurchaseRoutes = require('../routes/stock-purchases');
const stockOpnameRoutes = require('../routes/stock-opname');
const stockMovementRoutes = require('../routes/stock-movements');
const importProductRoutes = require('../routes/import-products');
const memberRoutes = require('../routes/members');
const customerRoutes = require('../routes/customers');
const utilityRoutes = require('../routes/utilities');
const moduleRoutes = require('../routes/modules');

const path = require('path');
const hooks = require('../core/hooks');
const BackendModuleLoader = require('../core/module-loader');

const app = express();
app.set('hooks', hooks);  // Available via req.app.get('hooks') in routes

// Middleware
app.use(cors());
app.use(express.json());

// Serve PWA files
app.get('/manifest.json', (req, res) => {
  res.json({
    name: "KasirPro - Sistem POS",
    short_name: "KasirPro",
    description: "Aplikasi Point of Sale untuk toko kelontong",
    start_url: "/",
    display: "standalone",
    background_color: "#111D13",
    theme_color: "#415D43",
    orientation: "any",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  });
});

app.get('/icons/:file', (req, res) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="80" fill="#415D43"/>
    <text x="256" y="340" text-anchor="middle" font-size="280" font-family="sans-serif" fill="white">🏪</text>
  </svg>`;
  res.set('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// Service Worker (must be at root, not under /api)
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.send(`
const CACHE_NAME = 'kasirpro-v1';
const STATIC_ASSETS = ['/'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return resp;
    })).catch(() => caches.match('/'))
  );
});
  `);
});

// Auto-migration (runs on startup, middleware waits for completion)
const { migrationReady } = require('../core-migration');
app.use(async (req, res, next) => { await migrationReady; next(); });

// ============ MOUNT ROUTES ============
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api', setupRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
// price-tiers: moved to modules/vip-pricing (dynamically loaded)
app.use('/api', discountRoutes);         // /api/product-discounts
app.use('/api', debtRoutes);             // /api/debts + /api/kasbon-customers
app.use('/api/settings', settingsRoutes);
app.use('/api', transactionRoutes);      // /api/transactions + /api/my-transactions
app.use('/api/reports', reportRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/stock-purchases', stockPurchaseRoutes);
app.use('/api/stock-opname', stockOpnameRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/products', importProductRoutes);  // /api/products/import
app.use('/api/customers', customerRoutes);
app.use('/api', memberRoutes);           // /api/members + /api/member-levels + /api/rewards (special-prices moved to module)
app.use('/api', utilityRoutes);          // /api/sync + /api/auto-migrate + /sw.js
app.use('/api/modules', moduleRoutes);   // /api/modules + /api/modules/enabled

// ============ LOAD DYNAMIC MODULES ============
const moduleLoader = new BackendModuleLoader(app, pool, authenticateToken, authorizeRole, hooks);
const modulesReady = moduleLoader.init();
app.set('moduleLoader', moduleLoader);

// Serve module frontend files
app.use('/modules', express.static(path.join(__dirname, '..', 'public', 'modules')));

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;
