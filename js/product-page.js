/* product-page.js -> /js/product-page.js
   Single owner of pages/product.html (the old inline script was removed). */
(function () {
  'use strict';

  var root = document.getElementById('pd-root');
  if (!root) return;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    try { if (typeof formatCurrency === 'function') return formatCurrency(Number(n || 0)); } catch (e) { /* fall through */ }
    return '\u20A6' + Number(n || 0).toLocaleString();
  }
  function $(id) { return document.getElementById(id); }
  function shopLink(cat, sub) {
    var p = new URLSearchParams();
    if (cat) p.set('category', cat);
    if (sub) p.set('subcategory', sub);
    return '/pages/shop.html' + (p.toString() ? '?' + p.toString() : '');
  }

  var S = { rows: [], variants: [], attrs: [], sel: {}, cur: null, qty: 1, images: [], imgIdx: 0, base: null };

  /* ---------- data ---------- */
  function firstImage(r) { return r.image_url || (Array.isArray(r.images) && r.images[0]) || ''; }

  function rowAttrs(r) {
    var a = {};
    var color = r.variant_color || r.color;
    var size = r.variant_size || r.size;
    if (color) a.Color = String(color).trim();
    if (size) a.Size = String(size).trim();
    if (!Object.keys(a).length && r.variants && !Array.isArray(r.variants) && typeof r.variants === 'object') {
      Object.keys(r.variants).slice(0, 3).forEach(function (k) {
        var v = r.variants[k];
        if (typeof v === 'string' || typeof v === 'number') a[k.charAt(0).toUpperCase() + k.slice(1)] = String(v);
      });
    }
    return a;
  }

  function buildVariants(rows) {
    var list = rows.map(function (r) { return { row: r, attrs: rowAttrs(r) }; });
    var keys = [];
    list.forEach(function (v) { Object.keys(v.attrs).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); }); });
    var groups = keys.map(function (k) {
      var vals = [];
      list.forEach(function (v) { if (v.attrs[k] && vals.indexOf(v.attrs[k]) === -1) vals.push(v.attrs[k]); });
      return { name: k, values: vals };
    }).filter(function (g) { return g.values.length > 1; });
    // Fallback: no colour/size data, but several rows -> one "Option" group from SKU
    if (!groups.length && list.length > 1) {
      var vals = list.map(function (v, i) { var lab = v.row.supplier_sku || ('Option ' + (i + 1)); v.attrs = { Option: lab }; return lab; });
      groups = [{ name: 'Option', values: vals }];
    }
    S.variants = list;
    S.attrs = groups;
  }

  function matchVariant(sel, strict) {
    var found = S.variants.filter(function (v) {
      return S.attrs.every(function (g) { return !sel[g.name] || v.attrs[g.name] === sel[g.name]; });
    });
    if (found.length || strict) return found[0] || null;
    return null;
  }

  async function fetchVariantRows(base) {
    var key = base.supplier_product_id;
    if (!key) return [base];
    try {
      var sb = await supabaseService.getClient();
      var res = await sb.from('products').select('*').eq('supplier_product_id', key).eq('is_published', true);
      if (!res.error && res.data && res.data.length) return res.data;
    } catch (e) { console.warn('Variant query failed, falling back', e); }
    try {
      var r2 = await supabaseService.getProductVariants(key);
      if (r2 && r2.success && r2.products && r2.products.length) return r2.products;
    } catch (e2) { /* fall through */ }
    return [base];
  }

  async function fetchBase(id) {
    try {
      var r = await supabaseService.getProduct(id);
      if (r && r.success && r.product) return r.product;
    } catch (e) { console.warn('Product lookup failed', e); }
    var p = (window.AppState && AppState.products || []).find(function (x) { return String(x.id) === String(id); });
    return p ? { id: p.id, title: p.name, name: p.name, price: p.price, image_url: p.image, supplier: p.supplier, category: p.category, subcategory: p.subcategory, stock_quantity: p.stock_quantity, supplier_product_id: p.supplier_product_id } : null;
  }

  /* ---------- rendering ---------- */
  function title() { return (S.base.title || S.base.name || 'Product').trim(); }

  function renderCrumbs() {
    var cat = (S.base.category || '').trim(), sub = (S.base.subcategory || '').trim();
    var h = '<a href="/index.html">Home</a><span aria-hidden="true">/</span>';
    if (cat) h += '<a href="' + esc(shopLink(cat)) + '">' + esc(cat) + '</a><span aria-hidden="true">/</span>';
    if (sub) h += '<a href="' + esc(shopLink(cat, sub)) + '">' + esc(sub) + '</a><span aria-hidden="true">/</span>';
    h += '<span aria-current="page">' + esc(title()) + '</span>';
    $('pd-crumbs').innerHTML = h;
  }

  function collectImages() {
    var seen = {}, out = [];
    function add(u) { if (u && !seen[u]) { seen[u] = 1; out.push(u); } }
    add(firstImage(S.cur.row));
    S.variants.forEach(function (v) { add(firstImage(v.row)); });
    (Array.isArray(S.cur.row.images) ? S.cur.row.images : []).forEach(add);
    S.images = out;
  }

  function renderGallery() {
    var img = $('pd-main-img');
    var src = S.images[S.imgIdx] || '/images/wimp.png';
    img.src = src;
    img.alt = title();
    var multi = S.images.length > 1;
    $('pd-prev').hidden = !multi; $('pd-next').hidden = !multi;
    $('pd-thumbs').innerHTML = multi ? S.images.map(function (u, i) {
      return '<button type="button" class="pd-thumb' + (i === S.imgIdx ? ' is-active' : '') + '" data-thumb="' + i + '" aria-label="Show image ' + (i + 1) + '"><img src="' + esc(u) + '" alt="" loading="lazy"></button>';
    }).join('') : '';
  }

  function renderGroups() {
    $('pd-variants').innerHTML = S.attrs.map(function (g) {
      var sel = S.sel[g.name];
      return '<fieldset class="pd-group"><legend>' + esc(g.name) + ': <strong>' + esc(sel || 'Select') + '</strong></legend><div class="pd-swatches">' +
        g.values.map(function (val) {
          var test = Object.assign({}, S.sel); test[g.name] = val;
          var v = matchVariant(test, false) || S.variants.find(function (x) { return x.attrs[g.name] === val; });
          var out = v && Number(v.row.stock_quantity || 0) <= 0;
          return '<button type="button" class="pd-swatch" data-attr="' + esc(g.name) + '" data-val="' + esc(val) + '" aria-pressed="' + (sel === val) + '"' + (out ? ' title="Out of stock"' : '') + '>' + esc(val) + '</button>';
        }).join('') + '</div></fieldset>';
    }).join('');
  }

  function stockInfo(r) {
    var n = Number(r.stock_quantity || 0);
    if (n <= 0) return { cls: 'is-out', text: 'Out of stock', ok: false, n: 0 };
    if (n <= 5) return { cls: 'is-low', text: 'Only ' + n + ' left', ok: true, n: n };
    return { cls: '', text: 'In stock', ok: true, n: n };
  }

  function renderBuy() {
    var r = S.cur.row, st = stockInfo(r);
    if (S.qty > st.n && st.n > 0) S.qty = st.n;
    if (S.qty < 1) S.qty = 1;
    $('pd-price').textContent = money(r.price);
    var stEl = $('pd-stock'); stEl.textContent = st.text; stEl.className = 'pd-stock ' + st.cls;
    $('pd-qty-val').textContent = S.qty;
    var add = $('pd-add'); add.disabled = !st.ok; add.textContent = st.ok ? 'Add to cart' : 'Out of stock';
    $('pd-buy-now').disabled = !st.ok;
    var sb = $('pd-sticky-btn'); sb.disabled = !st.ok; sb.textContent = st.ok ? 'Add to cart' : 'Out of stock';
    $('pd-sticky-price').textContent = money(r.price);
    var sku = $('pd-sku'); if (sku) sku.textContent = r.supplier_sku || '-';
    updateWish();
  }

  function updateWish() {
    var b = $('pd-wish'); if (!b) return;
    var on = false;
    try { on = typeof isInWishlist === 'function' && isInWishlist(S.cur.row.id); } catch (e) { /* ignore */ }
    b.classList.toggle('is-saved', on);
    b.textContent = on ? '\u2665 Saved' : '\u2661 Save';
    b.setAttribute('aria-pressed', String(on));
  }

  function selectVariant(v, keepImage) {
    S.cur = v;
    S.sel = Object.assign({}, v.attrs);
    var img = firstImage(v.row);
    var idx = S.images.indexOf(img);
    if (!keepImage && idx >= 0) S.imgIdx = idx;
    renderGroups(); renderGallery(); renderBuy();
    try { history.replaceState(null, '', location.pathname + '?id=' + encodeURIComponent(v.row.id)); } catch (e) { /* ignore */ }
  }

  /* ---------- description ---------- */
  function cleanText(v) { return String(v == null ? '' : v).replace(/<[^>]*>/g, '').replace(/[ \t]+/g, ' ').trim(); }
  // Use this row's description; if it is empty, fall back to any variant row of the same product.
  function descText() {
    var d = cleanText(S.base && S.base.description);
    if (d) return d;
    var rows = S.rows || [];
    for (var i = 0; i < rows.length; i++) {
      d = cleanText(rows[i] && rows[i].description);
      if (d) return d;
    }
    return '';
  }
  // Short summary shown next to the price: first one or two sentences, max ~180 characters.
  function renderBlurb(desc) {
    var el = $('pd-blurb'); if (!el) return;
    if (!desc) { el.hidden = true; el.textContent = ''; return; }
    // Split only where punctuation is followed by whitespace, so decimals like 15.6 stay intact.
    var sentences = desc.replace(/([.!?])\s+/g, '$1\u0001').split('\u0001').filter(Boolean);
    var out = '';
    for (var i = 0; i < sentences.length; i++) {
      var next = (out + ' ' + sentences[i]).trim();
      if (out && next.length > 180) break;
      out = next;
      if (i >= 1) break;
    }
    if (out.length > 200) out = out.slice(0, 197).replace(/\s+\S*$/, '') + '\u2026';
    el.textContent = out;
    var more = document.createElement('a');
    more.href = '#pd-about'; more.className = 'pd-blurb-more'; more.textContent = ' Full description';
    el.appendChild(more);
    el.hidden = false;
  }

  function renderStatic() {
    var b = S.base;
    document.title = title() + ' | Wimp-Drop';
    renderCrumbs();
    $('pd-cat').textContent = [b.category, b.subcategory].filter(Boolean).join(' \u203A ');
    $('pd-title').textContent = title();
    var rating = (Number(b.reviews_count || 0) > 0 && Number(b.rating || 0) > 0)
      ? '\u2605 ' + Number(b.rating).toFixed(1) + ' (' + Number(b.reviews_count) + ' reviews)' : '';
    $('pd-rating').textContent = rating; $('pd-rating').hidden = !rating;
    var desc = descText();
    $('pd-desc').textContent = desc || 'No description provided for this product.';
    renderBlurb(desc);
    var sub = (b.subcategory || '').trim();
    $('pd-more-title').textContent = sub ? 'More in ' + sub : 'More to explore';
    var all = $('pd-more-all'); all.href = shopLink((b.category || '').trim(), sub);
  }

  /* ---------- more in subcategory ---------- */
  function card(p) {
    var href = '/pages/product.html?id=' + encodeURIComponent(p.id);
    var inStock = p.inStock;
    var wished = false;
    try { wished = typeof isInWishlist === 'function' && isInWishlist(p.id); } catch (e) { /* ignore */ }
    var rating = (p.reviews > 0 && p.rating > 0) ? '<span class="sb-rating">\u2605 ' + p.rating.toFixed(1) + '</span>' : '';
    return '<article class="sb-card' + (inStock ? '' : ' sb-out') + '">' +
      '<a class="sb-card-img" href="' + href + '">' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">' : '') +
        (inStock ? '' : '<span class="sb-badge">Sold out</span>') + '</a>' +
      '<button type="button" class="sb-wish' + (wished ? ' active' : '') + '" data-wish="' + esc(p.id) + '" aria-label="Toggle wishlist">' + (wished ? '\u2665' : '\u2661') + '</button>' +
      '<div class="sb-card-body"><a class="sb-card-title" href="' + href + '">' + esc(p.name) + '</a>' +
      '<div class="sb-meta">' + rating + '</div>' +
      '<div class="sb-price-row"><span class="sb-price">' + money(p.price) + '</span>' +
      (inStock ? '<a class="sb-add" href="' + href + '" aria-label="View ' + esc(p.name) + '">+</a>' : '') + '</div></div></article>';
  }

  async function loadMore() {
    var box = $('pd-more-grid');
    var sub = (S.base.subcategory || '').trim();
    var cat = (S.base.category || '').trim();
    var rows = [];
    try {
      var sb = await supabaseService.getClient();
      var q = sb.from('products').select('id,title,name,price,image_url,images,stock_quantity,rating,reviews_count,supplier_product_id,category,subcategory,shipping_folded_into_price').eq('is_published', true).limit(200);
      if (sub) q = q.eq('subcategory', sub); else if (cat) q = q.eq('category', cat);
      var res = await q;
      if (!res.error) rows = res.data || [];
    } catch (e) { console.warn('More-in query failed', e); }
    var groups = {};
    rows.forEach(function (r) {
      var k = String(r.supplier_product_id || r.id);
      if (k === String(S.base.supplier_product_id || S.base.id)) return;
      (groups[k] = groups[k] || []).push(r);
    });
    var items = Object.keys(groups).map(function (k) {
      var list = groups[k];
      var ins = list.filter(function (r) { return Number(r.stock_quantity || 0) > 0; });
      var rep = (ins.length ? ins : list).slice().sort(function (a, b) { return Number(a.price || 0) - Number(b.price || 0); })[0];
      return { id: rep.id, name: rep.title || rep.name || 'Product', price: Number(rep.price || 0), image: firstImage(rep), inStock: ins.length > 0, rating: Number(rep.rating || 0), reviews: Number(rep.reviews_count || 0) };
    }).slice(0, 10);
    if (!items.length) { $('pd-more').hidden = true; return; }
    box.innerHTML = items.map(card).join('');
  }

  /* ---------- actions ---------- */
  function cartProduct() {
    var r = S.cur.row;
    var label = S.attrs.length ? Object.keys(S.cur.attrs).map(function (k) { return S.cur.attrs[k]; }).join(' / ') : '';
    return { id: r.id, name: title() + (label ? ' - ' + label : ''), price: r.price, image: firstImage(r), supplier: r.supplier,
      stock_quantity: r.stock_quantity, supplierProductId: r.supplier_product_id || null, supplierVariantId: r.supplier_variant_id || null, supplierSku: r.supplier_sku || null };
  }
  function addNow() {
    try {
      if (!stockInfo(S.cur.row).ok) return false;
      return !!addToCart(S.cur.row.id, S.qty, cartProduct());
    } catch (e) { console.warn('Add to cart failed', e); if (typeof showNotification === 'function') showNotification('Could not add this product to your cart', 'error'); return false; }
  }

  document.addEventListener('click', function (e) {
    try {
      var t = e.target;
      var sw = t.closest('.pd-swatch');
      if (sw) {
        var next = Object.assign({}, S.sel); next[sw.getAttribute('data-attr')] = sw.getAttribute('data-val');
        var v = matchVariant(next, true) || S.variants.find(function (x) { return x.attrs[sw.getAttribute('data-attr')] === sw.getAttribute('data-val'); });
        if (v) selectVariant(v, false);
        return;
      }
      var th = t.closest('[data-thumb]');
      if (th) { S.imgIdx = Number(th.getAttribute('data-thumb')); renderGallery(); return; }
      if (t.closest('#pd-prev')) { S.imgIdx = (S.imgIdx - 1 + S.images.length) % S.images.length; renderGallery(); return; }
      if (t.closest('#pd-next')) { S.imgIdx = (S.imgIdx + 1) % S.images.length; renderGallery(); return; }
      if (t.closest('#pd-dec')) { S.qty = Math.max(1, S.qty - 1); renderBuy(); return; }
      if (t.closest('#pd-inc')) { var max = stockInfo(S.cur.row).n || 1; S.qty = Math.min(max, S.qty + 1); renderBuy(); return; }
      if (t.closest('#pd-add') || t.closest('#pd-sticky-btn')) { addNow(); return; }
      if (t.closest('#pd-buy-now')) { if (addNow()) setTimeout(function () { window.location.href = '/pages/cart.html'; }, 300); return; }
      if (t.closest('#pd-wish')) { toggleWishlist(S.cur.row.id); updateWish(); return; }
      var w = t.closest('.sb-wish');
      if (w) { var id = w.getAttribute('data-wish'); toggleWishlist(id); var on = isInWishlist(id); w.classList.toggle('active', on); w.textContent = on ? '\u2665' : '\u2661'; }
    } catch (err) { console.warn('Product action failed', err); }
  });

  function initSwipe() {
    var stage = $('pd-stage'), x0 = null;
    stage.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (x0 == null || S.images.length < 2) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) < 40) return;
      S.imgIdx = (S.imgIdx + (dx < 0 ? 1 : -1) + S.images.length) % S.images.length;
      renderGallery();
    }, { passive: true });
  }

  /* ---------- boot ---------- */
  function fail(msg) {
    var ld = $('pd-loading'); if (ld) ld.hidden = true;
    root.hidden = false;
    root.innerHTML = '<div class="pd-state"><h1>' + esc(msg) + '</h1><p><a class="btn btn-primary" href="/pages/shop.html">Back to shop</a></p></div>';
  }

  async function start() {
    var tries = 0;
    while (!window._appReady && tries < 100) { await new Promise(function (r) { setTimeout(r, 20); }); tries++; }
    try { if (window._appReady) await window._appReady; } catch (e) { /* ignore */ }

    var id = new URLSearchParams(location.search).get('id');
    if (!id) { fail('No product selected'); return; }
    var base = await fetchBase(id);
    if (!base) { fail('Product not found'); return; }
    S.base = base;
    S.rows = await fetchVariantRows(base);
    buildVariants(S.rows);
    var v = S.variants.find(function (x) { return String(x.row.id) === String(id); }) || S.variants.find(function (x) { return Number(x.row.stock_quantity || 0) > 0; }) || S.variants[0];
    S.cur = v;
    S.sel = Object.assign({}, v.attrs);
    collectImages();
    S.imgIdx = Math.max(0, S.images.indexOf(firstImage(v.row)));
    var ld2 = $('pd-loading'); if (ld2) ld2.hidden = true;
    root.hidden = false;
    renderStatic(); renderGroups(); renderGallery(); renderBuy(); initSwipe();
    try { if (typeof trackRecentlyViewedProduct === 'function') trackRecentlyViewedProduct(String(v.row.id)); } catch (e) { /* ignore */ }
    loadMore();
  }
  document.addEventListener('DOMContentLoaded', start);
})();