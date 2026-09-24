const CACHE_NAME = 'wimp-drop-cache-v2';
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
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).catch(() => {
        return caches.match('/index.html');
      });
    })
  );
});
