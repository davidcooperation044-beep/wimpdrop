/* watchlist-page.js -> /js/watchlist-page.js */
(function () {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    try { if (typeof formatCurrency === 'function') return formatCurrency(Number(n || 0)); } catch (e) { /* fall through */ }
    return '\u20A6' + Number(n || 0).toLocaleString();
  }
  function wishIds() { return (window.AppState && Array.isArray(AppState.wishlist)) ? AppState.wishlist.map(String) : []; }
  function pool() { return (window.AppState && Array.isArray(AppState.products)) ? AppState.products.slice() : []; }

  var extra = [];   // wishlist products not present in AppState.products
  var fetched = false;

  async function loadMissing() {
    if (fetched) return;
    var have = {};
    pool().forEach(function (p) { have[String(p.id)] = true; });
    var missing = wishIds().filter(function (id) { return !have[id]; });
    if (!missing.length) return;
    fetched = true;
    if (typeof supabaseService === 'undefined' || !supabaseService.isInitialized) return;
    try {
      var res = await supabaseService.getProducts({ limit: 1000, sortBy: 'newest' });
      if (res && res.success) {
        (res.products || []).forEach(function (r) {
          if (missing.indexOf(String(r.id)) !== -1) {
            extra.push({ id: r.id, name: r.title || r.name, price: r.price,
              image: r.image_url || (Array.isArray(r.images) && r.images[0]) || '',
              stock_quantity: r.stock_quantity, supplier: r.supplier, supplier_product_id: r.supplier_product_id });
          }
        });
      }
    } catch (e) { console.warn('Watchlist lookup failed', e); }
  }

  function saved() {
    var ids = wishIds();
    return pool().concat(extra).filter(function (p, i, a) {
      return ids.indexOf(String(p.id)) !== -1 && a.findIndex(function (x) { return String(x.id) === String(p.id); }) === i;
    });
  }

  function card(p) {
    var id = p.id;
    var href = '/pages/product.html?id=' + encodeURIComponent(id);
    var name = p.name || p.title || 'Product';
    var inStock = p.stock_quantity == null || Number(p.stock_quantity) > 0;
    return '<article class="sb-card' + (inStock ? '' : ' sb-out') + '">' +
      '<a class="sb-card-img" href="' + href + '"><img src="' + esc(p.image || p.image_url || '/images/wimp.png') + '" alt="' + esc(name) + '" loading="lazy" decoding="async">' +
        (inStock ? '' : '<span class="sb-badge">Sold out</span>') + '</a>' +
      '<div class="sb-card-body"><a class="sb-card-title" href="' + href + '">' + esc(name) + '</a>' +
      '<div class="sb-price-row"><span class="sb-price">' + money(p.price) + '</span></div></div>' +
      '<div class="wl-card-actions">' +
        '<button type="button" class="wl-btn primary" data-move="' + esc(id) + '"' + (inStock ? '' : ' disabled') + ' aria-label="Move ' + esc(name) + ' to cart">Move to cart</button>' +
        '<button type="button" class="wl-btn" data-remove="' + esc(id) + '" aria-label="Remove ' + esc(name) + ' from watchlist">Remove</button>' +
      '</div></article>';
  }

  function setText(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }

  function render() {
    var box = document.getElementById('watchlist-items');
    if (!box) return;
    var list = saved();
    setText('watchlist-copy', list.length + ' saved item' + (list.length === 1 ? '' : 's'));
    if (!list.length) {
      box.innerHTML = '<div class="wl-empty"><h2>Nothing saved yet</h2><p>Tap the heart on any product to keep it here for later.</p><a href="/pages/shop.html" class="btn btn-primary">Browse products</a></div>';
      return;
    }
    box.innerHTML = '<div class="wl-grid">' + list.map(card).join('') + '</div>';
  }

  document.addEventListener('click', function (e) {
    try {
      var mv = e.target.closest('[data-move]');
      var rm = e.target.closest('[data-remove]');
      if (mv) {
        var id = mv.getAttribute('data-move');
        var p = saved().find(function (x) { return String(x.id) === String(id); });
        if (p && addToCart(p.id, 1, p)) {
          if (typeof isInWishlist === 'function' && isInWishlist(p.id) && typeof toggleWishlist === 'function') toggleWishlist(p.id);
        }
        render();
      } else if (rm) {
        var rid = rm.getAttribute('data-remove');
        if (typeof toggleWishlist === 'function' && isInWishlist(rid)) toggleWishlist(rid);
        render();
      }
    } catch (err) { console.warn('Watchlist action failed', err); }
  });

  window.renderWatchlist = render;

  async function start() {
    var tries = 0;
    while (!window._appReady && tries < 100) { await new Promise(function (r) { setTimeout(r, 20); }); tries++; }
    try { if (window._appReady) await window._appReady; } catch (e) { /* ignore */ }
    await loadMissing();
    render();
  }
  document.addEventListener('DOMContentLoaded', start);
})();