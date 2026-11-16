/* Service worker PB Jgeer: tampilan tersimpan offline, data selalu diambil terbaru */
const VER = 'jgeer-v1';
const SHELL = ['./', './index.html', './report.html', './turnamen.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const STATIC_HOSTS = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'raw.githubusercontent.com'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Data spreadsheet & Apps Script: selalu langsung dari jaringan (jangan di-cache)
  if (/(^|\.)(google\.com|googleusercontent\.com)$/.test(url.hostname) && !/fonts\./.test(url.hostname)) return;
  // Halaman: jaringan dulu, cadangan dari cache saat offline
  if (req.mode === 'navigate' || (url.origin === location.origin && /\.html$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VER).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match(url.pathname.endsWith('report.html') ? './report.html' : url.pathname.endsWith('turnamen.html') ? './turnamen.html' : './index.html'))));
    return;
  }
  // Aset statis (ikon, font, Tailwind, logo): cache dulu, perbarui di belakang layar
  if (url.origin === location.origin || STATIC_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(VER).then(c => c.put(req, cp)); } return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
