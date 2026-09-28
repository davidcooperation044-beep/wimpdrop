/* cart-page.js -> /js/cart-page.js
   Single owner of the cart page (the old inline script in cart.html was removed).
   main.js calls window.renderCartItems / window.updateOrderSummary, so both are exposed. */
(function () {
  'use strict';

  var VAT_RATE = 0.075; // same rate checkout.html uses

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    try { if (typeof formatCurrency === 'function') return formatCurrency(Number(n || 0)); } catch (e) { /* fall through */ }
    return '\u20A6' + Number(n || 0).toLocaleString();
  }
  function el(id) { return document.getElementById(id); }
  function cartList() { return (window.AppState && Array.isArray(AppState.cart)) ? AppState.cart : []; }
  function catalog() { return (window.AppState && Array.isArray(AppState.products)) ? AppState.products : []; }
  function findItem(id) {
    return cartList().find(function (i) { return String(i.id) === String(id); });
  }
  function catalogItem(id) {
    return catalog().find(function (p) { return String(p.id) === String(id); });
  }
  function safeImg(src) { return esc(src || '/images/wimp.png'); }

  function stockPill(item) {
    var p = catalogItem(item.id);
    var raw = item.stock_quantity != null ? item.stock_quantity : (p ? p.stock_quantity : null);
    if (raw == null || raw === '') return '';
    var n = Number(raw);
    if (n <= 0) return '<span class="ct-pill is-warn">Out of stock</span>';
    if (n <= 3) return '<span class="ct-pill is-warn">' + n + ' left</span>';
    return '<span class="ct-pill">In stock</span>';
  }

  function itemRow(item) {
    var q = Number(item.quantity || 1);
    var price = Number(item.price || 0);
    var href = '/pages/product.html?id=' + encodeURIComponent(item.id);
    var name = item.name || 'Product';
    return '<div class="ct-item" data-row="' + esc(item.id) + '">' +
      '<a class="ct-thumb" href="' + href + '"><img src="' + safeImg(item.image) + '" alt="' + esc(name) + '" loading="lazy"></a>' +
      '<div class="ct-copy">' +
        '<a class="ct-title" href="' + href + '">' + esc(name) + '</a>' +
        '<div class="ct-meta">' + (item.supplier ? '<span class="ct-pill">' + esc(item.supplier) + '</span>' : '') + stockPill(item) + '</div>' +
        '<div class="ct-unit">' + money(price) + ' each</div>' +
        '<div class="ct-qty" role="group" aria-label="Quantity for ' + esc(name) + '">' +
          '<button type="button" data-qty="dec" data-id="' + esc(item.id) + '" aria-label="Decrease quantity">\u2212</button>' +
          '<output aria-live="polite">' + q + '</output>' +
          '<button type="button" data-qty="inc" data-id="' + esc(item.id) + '" aria-label="Increase quantity">+</button>' +
        '</div>' +
      '</div>' +
      '<div class="ct-actions">' +
        '<div class="ct-price">' + money(price * q) + '</div>' +
        '<button type="button" class="ct-remove" data-remove="' + esc(item.id) + '" aria-label="Remove ' + esc(name) + ' from cart">Remove</button>' +
      '</div></div>';
  }

  function card(p) {
    var id = p.id;
    var href = '/pages/product.html?id=' + encodeURIComponent(id);
    var name = p.name || p.title || 'Product';
    var inStock = p.stock_quantity == null || Number(p.stock_quantity) > 0;
    var wished = false;
    try { wished = typeof isInWishlist === 'function' && isInWishlist(id); } catch (e) { /* ignore */ }
    return '<article class="sb-card' + (inStock ? '' : ' sb-out') + '">' +
      '<a class="sb-card-img" href="' + href + '"><img src="' + safeImg(p.image || p.image_url) + '" alt="' + esc(name) + '" loading="lazy" decoding="async">' +
        (inStock ? '' : '<span class="sb-badge">Sold out</span>') + '</a>' +
      '<button type="button" class="sb-wish' + (wished ? ' active' : '') + '" data-wish="' + esc(id) + '" aria-label="Toggle wishlist">' + (wished ? '\u2665' : '\u2661') + '</button>' +
      '<div class="sb-card-body"><a class="sb-card-title" href="' + href + '">' + esc(name) + '</a>' +
      '<div class="sb-price-row"><span class="sb-price">' + money(p.price) + '</span>' +
      (inStock ? '<button type="button" class="sb-add" data-add="' + esc(id) + '" aria-label="Add ' + esc(name) + ' to cart">+</button>' : '') +
      '</div></div></article>';
  }

  var relatedCache = null;
  async function loadRelatedPool() {
    if (relatedCache) return relatedCache;
    var pool = catalog().slice();
    if (!pool.length && typeof supabaseService !== 'undefined' && supabaseService.isInitialized) {
      try {
        var res = await supabaseService.getProducts({ limit: 60, sortBy: 'newest' });
        if (res && res.success) {
          pool = (res.products || []).map(function (r) {
            return { id: r.id, name: r.title || r.name, price: r.price, image: r.image_url || (Array.isArray(r.images) && r.images[0]) || '',
              category: r.category, stock_quantity: r.stock_quantity, supplier: r.supplier, supplier_product_id: r.supplier_product_id };
          });
        }
      } catch (e) { console.warn('Cart suggestions failed', e); }
    }
    relatedCache = pool;
    return pool;
  }

  async function renderRelated() {
    var box = el('cart-related');
    if (!box) return;
    var pool = await loadRelatedPool();
    var inCart = cartList();
    var cats = {};
    inCart.forEach(function (i) { var p = catalogItem(i.id); if (p && p.category) cats[p.category] = true; });
    var seen = {};
    inCart.forEach(function (i) { seen[String(i.supplier_product_id || i.id)] = true; });
    var picks = pool.filter(function (p) {
      var k = String(p.supplier_product_id || p.id);
      if (seen[k] || !p.id) return false;
      if (p.stock_quantity != null && Number(p.stock_quantity) <= 0) return false;
      return true;
    });
    var same = picks.filter(function (p) { return cats[p.category]; });
    var list = (same.length >= 4 ? same : same.concat(picks.filter(function (p) { return !cats[p.category]; }))).filter(function (p, i, a) {
      var k = String(p.supplier_product_id || p.id);
      return a.findIndex(function (x) { return String(x.supplier_product_id || x.id) === k; }) === i;
    }).slice(0, 5);
    if (!list.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<h2>You may also like</h2><div class="sb-grid">' + list.map(card).join('') + '</div>';
  }

  function updateOrderSummary() {
    var cart = cartList();
    var subtotal = cart.reduce(function (s, i) { return s + Number(i.price || 0) * Number(i.quantity || 0); }, 0);
    var vat = Math.round(subtotal * VAT_RATE);
    var total = subtotal + vat;
    var set = function (id, v) { var e = el(id); if (e) e.textContent = v; };
    set('subtotal', money(subtotal));
    set('tax', money(vat));
    set('total', money(total));
    set('mobile-total', money(total));
    var disabled = cart.length === 0;
    ['checkout-link', 'checkout-link-mobile'].forEach(function (id) {
      var a = el(id);
      if (a) a.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    });
  }

  function renderCartItems() {
    var container = el('cart-items-container');
    if (!container) return;
    var cart = cartList();
    var count = el('cart-count-copy');
    if (!cart.length) {
      container.innerHTML = '<div class="ct-empty"><h3>Your cart is empty</h3><p>Browse the catalog and add something you like.</p><a href="/pages/shop.html" class="btn btn-primary">Shop now</a></div>';
      if (count) count.textContent = '0 items';
    } else {
      container.innerHTML = cart.map(itemRow).join('');
      var units = cart.reduce(function (s, i) { return s + Number(i.quantity || 0); }, 0);
      if (count) count.textContent = units + ' item' + (units === 1 ? '' : 's');
    }
    updateOrderSummary();
    renderRelated();
  }

  document.addEventListener('click', function (e) {
    try {
      var t = e.target.closest('[data-qty],[data-remove],[data-add],[data-wish]');
      if (!t) return;
      if (t.hasAttribute('data-qty')) {
        var item = findItem(t.getAttribute('data-id'));
        if (!item) return;
        var next = Number(item.quantity || 1) + (t.getAttribute('data-qty') === 'inc' ? 1 : -1);
        if (next < 1) { removeFromCart(item.id); } else { updateCartQuantity(item.id, next); }
        renderCartItems();
      } else if (t.hasAttribute('data-remove')) {
        var it = findItem(t.getAttribute('data-remove'));
        if (it) removeFromCart(it.id);
        renderCartItems();
      } else if (t.hasAttribute('data-add')) {
        var id = t.getAttribute('data-add');
        var p = catalogItem(id) || (relatedCache || []).find(function (x) { return String(x.id) === String(id); });
        if (p) addToCart(p.id, 1, p);
        renderCartItems();
      } else if (t.hasAttribute('data-wish')) {
        toggleWishlist(t.getAttribute('data-wish'));
        var on = isInWishlist(t.getAttribute('data-wish'));
        t.classList.toggle('active', on);
        t.textContent = on ? '\u2665' : '\u2661';
      }
    } catch (err) { console.warn('Cart action failed', err); }
  });

  window.renderCartItems = renderCartItems;
  window.updateOrderSummary = updateOrderSummary;

  async function start() {
    var tries = 0;
    while (!window._appReady && tries < 100) { await new Promise(function (r) { setTimeout(r, 20); }); tries++; }
    try { if (window._appReady) await window._appReady; } catch (e) { /* ignore */ }
    renderCartItems();
  }
  document.addEventListener('DOMContentLoaded', start);
})();