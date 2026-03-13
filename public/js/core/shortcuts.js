// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', (e) => {
  if (e.key === 'F2' && currentPage === 'pos') {
    e.preventDefault();
    const el = document.getElementById('posSearch');
    if (el) el.focus();
  }
});

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

