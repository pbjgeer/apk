/* PB Jgeer — PWA helper (dipakai index, report, turnamen)
 * 1) Mendaftarkan service worker
 * 2) Bar "Pasang aplikasi" di Home (hanya jika HP bisa memasang; hilang setelah terpasang)
 * 3) Pembaruan otomatis ke versi terbaru
 * 4) Penanda offline
 */
(function () {
  'use strict';

  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Di iOS hanya Safari/Chrome yang bisa "Tambah ke Layar Utama" (bukan WebView aplikasi lain / Firefox)
  var iosCapable = isIOS && /Safari\//.test(ua) && !/FxiOS|FBAN|FBAV|Instagram|Line\/|MicroMessenger|GSA\//.test(ua);
  var isMobile = isIOS || /Android|Mobi/i.test(ua) || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  var deferred = null;

  function isStandalone() {
    return (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)) ||
      navigator.standalone === true;
  }

  /* ---------- Gaya ---------- */
  var css = '' +
    '.pwa-bar{position:relative;z-index:30;background:#fff;border-bottom:1px solid rgba(43,27,34,.09);box-shadow:0 10px 24px -18px rgba(214,69,93,.5);animation:pwaIn .45s cubic-bezier(.22,1,.36,1) both}' +
    '.pwa-bar[hidden]{display:none}' +
    '.pwa-bar-in{max-width:72rem;margin:0 auto;display:flex;align-items:center;gap:.75rem;padding:.65rem 1rem}' +
    '.pwa-bar img{width:2.6rem;height:2.6rem;border-radius:.8rem;flex:none;box-shadow:0 6px 14px -8px rgba(43,27,34,.5)}' +
    '.pwa-txt{min-width:0;flex:1;line-height:1.25}' +
    '.pwa-txt b{display:block;font:800 .9rem/1.2 "Plus Jakarta Sans",system-ui,sans-serif;color:#2B1B22}' +
    '.pwa-txt span{display:block;font:500 .72rem/1.3 "Plus Jakarta Sans",system-ui,sans-serif;color:#85727B;margin-top:.1rem}' +
    '.pwa-btn{flex:none;border:0;cursor:pointer;border-radius:999px;padding:.6rem 1.15rem;font:800 .8rem "Plus Jakarta Sans",system-ui,sans-serif;letter-spacing:.02em;color:#fff;background:linear-gradient(135deg,#E4405F,#FF7A59);box-shadow:0 14px 24px -14px rgba(228,64,95,.95);transition:transform .15s,filter .2s}' +
    '.pwa-btn:hover{filter:saturate(1.15)}.pwa-btn:active{transform:scale(.96)}' +
    '.pwa-ov{position:fixed;inset:0;z-index:2000;display:flex;align-items:flex-end;justify-content:center;padding:1rem;background:rgba(43,27,34,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:pwaFade .2s ease both}' +
    '@media(min-width:640px){.pwa-ov{align-items:center}}' +
    '.pwa-card{width:100%;max-width:26rem;background:#fff;border-radius:1.75rem;padding:1.5rem 1.25rem 1.25rem;box-shadow:0 30px 60px -24px rgba(43,27,34,.6);animation:pwaUp .35s cubic-bezier(.22,1,.36,1) both;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#2B1B22;padding-bottom:calc(1.25rem + env(safe-area-inset-bottom))}' +
    '.pwa-card h3{margin:0 0 .25rem;font-size:1.15rem;font-weight:800}' +
    '.pwa-card>p{margin:0 0 1rem;font-size:.8rem;color:#85727B}' +
    '.pwa-steps{list-style:none;margin:0 0 1.1rem;padding:0;display:grid;gap:.6rem}' +
    '.pwa-steps li{display:flex;gap:.75rem;align-items:center;background:#FFF3F0;border-radius:1.1rem;padding:.7rem .85rem;font-size:.85rem;line-height:1.35}' +
    '.pwa-steps .n{flex:none;width:1.7rem;height:1.7rem;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:.8rem;color:#fff;background:linear-gradient(135deg,#E4405F,#FF7A59)}' +
    '.pwa-steps svg{width:1.15rem;height:1.15rem;vertical-align:-.2rem;margin:0 .1rem;stroke:#E4405F;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.pwa-card .pwa-btn{width:100%;padding:.8rem 1rem;font-size:.9rem}' +
    '.pwa-off{position:fixed;left:50%;top:calc(.6rem + env(safe-area-inset-top));transform:translateX(-50%);z-index:1900;max-width:calc(100% - 1.5rem);padding:.45rem .95rem;border-radius:999px;background:#2B1B22;color:#fff;font:700 .72rem "Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 12px 24px -12px rgba(0,0,0,.6);animation:pwaDrop .35s cubic-bezier(.22,1,.36,1) both;text-align:center}' +
    '.pwa-off[hidden]{display:none}' +
    '.pwa-toast{position:fixed;left:50%;bottom:calc(5.5rem + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1900;padding:.6rem 1.1rem;border-radius:999px;background:#2B1B22;color:#fff;font:700 .78rem "Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 16px 30px -14px rgba(0,0,0,.65);animation:pwaDrop .3s ease both}' +
    '@keyframes pwaIn{from{opacity:0;transform:translateY(-100%)}}' +
    '@keyframes pwaFade{from{opacity:0}}' +
    '@keyframes pwaUp{from{opacity:0;transform:translateY(30px) scale(.97)}}' +
    '@keyframes pwaDrop{from{opacity:0;transform:translate(-50%,-10px)}}' +
    '@media(prefers-reduced-motion:reduce){.pwa-bar,.pwa-card,.pwa-ov,.pwa-off,.pwa-toast{animation:none}}';
  function injectCss() {
    if (document.getElementById('pwa-css')) return;
    var s = document.createElement('style'); s.id = 'pwa-css'; s.textContent = css; document.head.appendChild(s);
  }

  /* ---------- Toast ---------- */
  function toast(msg, ms) {
    injectCss();
    var t = document.createElement('div'); t.className = 'pwa-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, ms || 2600);
  }

  /* ---------- Bar pasang aplikasi ---------- */
  var bar = null;
  function canInstall() {
    if (isStandalone() || !isMobile) return false;
    return !!deferred || iosCapable;
  }
  function renderBar() {
    var slot = document.getElementById('pwaInstallSlot');
    if (!slot) return;
    if (!canInstall()) { if (bar) { bar.remove(); bar = null; } return; }
    if (bar) return;
    injectCss();
    bar = document.createElement('div');
    bar.className = 'pwa-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Pasang aplikasi');
    bar.innerHTML =
      '<div class="pwa-bar-in">' +
      '<img src="icons/icon-192.png" alt="" width="42" height="42">' +
      '<div class="pwa-txt"><b>Pasang aplikasi PB Jgeer</b><span>Layar penuh, buka lebih cepat, halaman yang pernah dibuka tetap tampil offline.</span></div>' +
      '<button type="button" class="pwa-btn">Pasang</button>' +
      '</div>';
    bar.querySelector('.pwa-btn').addEventListener('click', onInstallClick);
    slot.appendChild(bar);
  }
  function hideBar() { if (bar) { bar.remove(); bar = null; } }

  function onInstallClick() {
    if (deferred) {                                   // Android / Chrome: langsung memasang
      var p = deferred; deferred = null;
      p.prompt();
      (p.userChoice || Promise.resolve()).then(function (c) {
        if (c && c.outcome === 'accepted') hideBar();
        else { deferred = p; }                        // batal: biarkan bar tetap ada
      }).catch(function () {});
      return;
    }
    if (iosCapable) showIosSteps();                   // iPhone: tampilkan langkah manual
  }

  function showIosSteps() {
    injectCss();
    var ov = document.createElement('div');
    ov.className = 'pwa-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Cara memasang aplikasi');
    ov.innerHTML =
      '<div class="pwa-card">' +
      '<h3>Pasang di iPhone</h3>' +
      '<p>Ikuti 3 langkah ini di browser Anda.</p>' +
      '<ol class="pwa-steps">' +
      '<li><span class="n">1</span><span>Ketuk tombol <b>Bagikan</b> ' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/></svg>' +
      ' di bagian bawah atau atas layar.</span></li>' +
      '<li><span class="n">2</span><span>Gulir lalu pilih <b>Tambah ke Layar Utama</b>.</span></li>' +
      '<li><span class="n">3</span><span>Ketuk <b>Tambah</b>. Ikon PB Jgeer muncul di layar utama.</span></li>' +
      '</ol>' +
      '<button type="button" class="pwa-btn">Mengerti</button>' +
      '</div>';
    function close() { ov.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.pwa-btn').addEventListener('click', close);
    document.addEventListener('keydown', esc);
    document.body.appendChild(ov);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e; renderBar();
  });
  window.addEventListener('appinstalled', function () { deferred = null; hideBar(); toast('Aplikasi terpasang'); });
  try {
    var mq = matchMedia('(display-mode: standalone)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { if (isStandalone()) hideBar(); });
  } catch (_) {}

  /* ---------- Penanda offline ---------- */
  var offEl = null;
  function syncOnline() {
    if (!document.body) return;
    if (!navigator.onLine) {
      injectCss();
      if (!offEl) {
        offEl = document.createElement('div'); offEl.className = 'pwa-off'; offEl.setAttribute('role', 'status');
        offEl.textContent = 'Offline: data terbaru belum bisa dimuat';
        document.body.appendChild(offEl);
      }
    } else if (offEl) { offEl.remove(); offEl = null; toast('Kembali online'); }
  }
  window.addEventListener('online', syncOnline);
  window.addEventListener('offline', syncOnline);

  /* ---------- Service worker + pembaruan otomatis ---------- */
  var swOk = 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  var reg = null, baseSig = null, lastCheck = Date.now();

  function busy() {
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
    var m = document.querySelector('.fixed.inset-0:not(.hidden):not(#loadingOverlay)');
    return !!(m && m.offsetParent !== null && getComputedStyle(m).display !== 'none');
  }
  var reloading = false;
  function reloadWhenIdle() {
    if (reloading) return;
    var go = function () {
      if (document.hidden) { reloading = true; location.reload(); return true; }
      if (busy()) return false;
      reloading = true; toast('Versi baru tersedia, memuat ulang…', 1400);
      setTimeout(function () { location.reload(); }, 1300); return true;
    };
    if (go()) return;
    var iv = setInterval(function () { if (go()) clearInterval(iv); }, 4000);
  }

  function pageSig() {
    if (location.protocol === 'file:') return Promise.resolve(null);
    return fetch(location.pathname + location.search, { method: 'HEAD', cache: 'no-store' })
      .then(function (r) { return r.headers.get('etag') || r.headers.get('last-modified') || null; })
      .catch(function () { return null; });
  }
  function checkForUpdate() {
    lastCheck = Date.now();
    if (reg) reg.update().catch(function () {});
    if (!navigator.onLine) return;
    pageSig().then(function (s) {
      if (!s) return;
      if (baseSig === null) { baseSig = s; return; }
      if (s !== baseSig) reloadWhenIdle();
    });
  }

  if (swOk) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }   // pemasangan pertama: tak perlu muat ulang
      reloadWhenIdle();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (r) { reg = r; r.update().catch(function () {}); }).catch(function () {});
      pageSig().then(function (s) { baseSig = s; });
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && Date.now() - lastCheck > 60000) checkForUpdate();
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) checkForUpdate(); });
  }

  document.addEventListener('DOMContentLoaded', function () { renderBar(); syncOnline(); });
})();
