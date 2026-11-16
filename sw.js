/* PB Jgeer — service worker
 * - Halaman (HTML): jaringan dulu, cadangan dari cache bila offline -> selalu versi terbaru saat online
 * - Data Spreadsheet / Apps Script / Firestore: SELALU langsung dari jaringan, tidak pernah disimpan
 * - Aset (Tailwind, font, foto, ikon): tampil dari cache lalu diperbarui di belakang layar
 * Naikkan VERSION hanya bila ingin membuang semua cache lama.
 */
const VERSION = 'v1';
const PRECACHE = 'jgeer-core-' + VERSION;
const RT_CORS = 'jgeer-cors-' + VERSION;      // respons CORS (modul Firebase, gambar untuk canvas)
const RT_OPAQUE = 'jgeer-nocors-' + VERSION;  // respons no-cors (script/gambar biasa lintas situs)
const MAX_RUNTIME = 220;

const CORE = [
  './', 'index.html', 'report.html', 'turnamen.html', 'offline.html',
  'pwa.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

// Data hidup: tidak boleh basi, jadi tidak disentuh cache sama sekali
const LIVE_HOSTS = [
  'docs.google.com', 'sheets.googleapis.com',
  'script.google.com', 'script.googleusercontent.com',
  'firestore.googleapis.com', 'firebaseinstallations.googleapis.com',
  'identitytoolkit.googleapis.com', 'securetoken.googleapis.com'
];
// Tidak dicegat (video/embedding)
const SKIP_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com', 'i.ytimg.com', 'youtube.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(PRECACHE);
    await Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = new Set([PRECACHE, RT_CORS, RT_OPAQUE]);
    for (const k of await caches.keys()) if (k.startsWith('jgeer-') && !keep.has(k)) await caches.delete(k);
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch (_) {} }
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

async function trim(name) {
  const c = await caches.open(name), keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_RUNTIME; i++) await c.delete(keys[i]);
}

function usable(res) { return res && (res.ok || res.type === 'opaque'); }

// HTML: jaringan dulu (maks 6 dtk), lalu cache, lalu halaman offline
async function pageStrategy(e) {
  const req = e.request;
  const cache = await caches.open(PRECACHE);
  try {
    const pre = e.preloadResponse ? await e.preloadResponse : null;
    const net = pre || await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
    ]);
    if (net && net.ok && net.type === 'basic') cache.put(req, net.clone()).catch(() => {});
    return net;
  } catch (_) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    return (await cache.match('offline.html')) || new Response('Offline', { status: 503 });
  }
}

// Aset: tampil dari cache, perbarui di belakang layar
async function assetStrategy(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const refresh = fetch(req).then(res => {
    if (usable(res)) { cache.put(req, res.clone()).then(() => trim(cacheName)).catch(() => {}); }
    return res;
  }).catch(() => null);
  if (hit) { refresh.catch(() => {}); return hit; }
  const res = await refresh;
  return res || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                         // POST (Apps Script) lewat langsung
  if (req.headers.has('range')) return;                     // video/audio
  let url; try { url = new URL(req.url); } catch (_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (SKIP_HOSTS.includes(url.hostname)) return;

  if (LIVE_HOSTS.includes(url.hostname)) {                  // data langsung, tanpa cache
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => Response.error()));
    return;
  }

  if (req.mode === 'navigate') { e.respondWith(pageStrategy(e)); return; }

  if (url.origin === self.location.origin) {                // pwa.js, manifest, ikon, dll.
    e.respondWith(assetStrategy(req, PRECACHE));
    return;
  }

  // Lintas situs: Tailwind, font, modul Firebase, foto GitHub, avatar, dll.
  e.respondWith(assetStrategy(req, req.mode === 'cors' ? RT_CORS : RT_OPAQUE));
});
