const CACHE_NAME = 'wimp-drop-cache-v3'; // bump this on every deploy

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/luxury-theme.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/pages/shop.html',
  '/pages/product.html',
  '/pages/account.html',
  '/pages/cart.html',
  '/pages/checkout.html',
  '/pages/watchlist.html',
  '/pages/login.html',
  '/pages/register.html',
  '/pages/order-success.html',
  '/js/main.js',
  '/js/env.js',
  '/js/supabase.js',
  '/js/flutterwave.js',
  '/js/mobile-ui.js',
  '/js/luxury-ui.js',
  '/js/email-service.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only intervene for same-origin GET requests; let everything else
  // (cross-origin API calls to Supabase/CJ, POSTs, etc.) go straight to
  // the network untouched.
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return; // don't call respondWith — browser handles it normally
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});