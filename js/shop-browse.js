/* =====================================================================
   shop-browse.js  ->  paste as /js/shop-browse.js
   Temu-style browsing for pages/shop.html:
     category tabs  ->  subcategory tiles  ->  product grid (infinite scroll)
   URL is shareable:  /pages/shop.html?category=Electronics&subcategory=Tablet%20Cases
   Depends on (already in your repo): supabaseService, formatCurrency,
   addToCart, isInWishlist, toggleWishlist, window._appReady
   ===================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('shop-browse');
  if (!root) return;

  var PAGE_SIZE = 20;
  var FETCH_PAGE = 1000; // Supabase returns max 1000 rows per request
  var CATEGORY_ORDER = [
    'Electronics', 'Fashion', 'Home & Kitchen', 'Beauty & Personal Care',
    'Accessories', 'Sports & Outdoors', 'Toys & Games', 'Office & Stationery',
    'Automotive', 'Essentials'
  ];
  var SORTS = [
    { id: 'recommended', label: 'Recommended' },
    { id: 'newest', label: 'Newest' },
    { id: 'price-low', label: 'Price: low to high' },
    { id: 'price-high', label: 'Price: high to low' }
  ];

  var state = {
    all: [],            // one entry per product (variants grouped)
    category: 'all',
    subcategory: 'all',
    search: '',
    sort: 'recommended',
    visible: PAGE_SIZE,
    status: 'loading'   // loading | ready | error
  };
  var observer = null;

  /* ---------- helpers ---------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (typeof formatCurrency === 'function') {
      try { return formatCurrency(n); } catch (e) { /* fall through */ }
    }
    return '\u20A6' + Number(n || 0).toLocaleString();
  }
  function wishOn(id) {
    try { return typeof isInWishlist === 'function' && isInWishlist(id); } catch (e) { return false; }
  }
  function sortedCategories(names) {
    return names.slice().sort(function (a, b) {
      var ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
      if (ia === -1) ia = 99;
      if (ib === -1) ib = 99;
      return ia - ib || a.localeCompare(b);
    });
  }

  /* ---------- data ---------- */
  function groupRows(rows) {
    var groups = {};
    rows.forEach(function (r) {
      var key = String(r.supplier_product_id || r.id);
      (groups[key] = groups[key] || []).push(r);
    });
    return Object.keys(groups).map(function (key) {
      var list = groups[key];
      var inStock = list.filter(function (r) { return Number(r.stock_quantity || 0) > 0; });
      var pool = inStock.length ? inStock : list;
      var rep = pool.slice().sort(function (a, b) { return Number(a.price || 0) - Number(b.price || 0); })[0];
      var prices = list.map(function (r) { return Number(r.price || 0); }).filter(function (p) { return p > 0; });
      var newest = list.reduce(function (m, r) { return r.created_at && r.created_at > m ? r.created_at : m; }, '');
      var reviews = Number(rep.reviews_count || 0);
      return {
        key: key,
        id: rep.id,
        name: rep.title || rep.name || 'Untitled product',
        category: (rep.category || 'Essentials').trim(),
        subcategory: (rep.subcategory || '').trim() || 'Other',
        price: prices.length ? Math.min.apply(null, prices) : Number(rep.price || 0),
        maxPrice: prices.length ? Math.max.apply(null, prices) : Number(rep.price || 0),
        image: rep.image_url || (Array.isArray(rep.images) && rep.images[0]) || '',
        inStock: inStock.length > 0,
        variantCount: list.length,
        supplier: rep.supplier,
        supplierProductId: rep.supplier_product_id || '',
        supplierVariantId: rep.supplier_variant_id || '',
        supplierSku: rep.supplier_sku || '',
        sold: Math.max.apply(null, list.map(function (r) { return Number(r.sold_count || 0); })),
        rating: Number(rep.rating || 0),
        reviews: reviews,
        created_at: newest
      };
    });
  }

  async function fetchAllRows() {
    var rows = [];
    for (var page = 0; page < 10; page++) {
      var res = await supabaseService.getProducts({
        limit: FETCH_PAGE,
        offset: page * FETCH_PAGE,
        sortBy: 'newest'
      });
      if (!res || !res.success) throw new Error('Could not load products');
      rows = rows.concat(res.products || []);
      if ((res.products || []).length < FETCH_PAGE) break;
    }
    return rows;
  }

  /* ---------- URL state ---------- */
  function readUrl() {
    var p = new URLSearchParams(window.location.search);
    state.category = p.get('category') || 'all';
    state.subcategory = p.get('subcategory') || 'all';
    state.search = p.get('search') || '';
    var s = p.get('sort');
    state.sort = SORTS.some(function (x) { return x.id === s; }) ? s : 'recommended';
    state.visible = PAGE_SIZE;
  }
  function writeUrl(push) {
    var p = new URLSearchParams();
    if (state.category !== 'all') p.set('category', state.category);
    if (state.subcategory !== 'all') p.set('subcategory', state.subcategory);
    if (state.search) p.set('search', state.search);
    if (state.sort !== 'recommended') p.set('sort', state.sort);
    var qs = p.toString();
    var url = window.location.pathname + (qs ? '?' + qs : '');
    history[push ? 'pushState' : 'replaceState'](null, '', url);
  }

  /* ---------- derived lists ---------- */
  function matchesSearch(p) {
    if (!state.search) return true;
    var q = state.search.toLowerCase();
    return (p.name + ' ' + p.category + ' ' + p.subcategory).toLowerCase().indexOf(q) !== -1;
  }
  function baseList() { return state.all.filter(matchesSearch); }
  function filtered() {
    var list = baseList().filter(function (p) {
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (state.subcategory !== 'all' && p.subcategory !== state.subcategory) return false;
      return true;
    });
    var by = state.sort;
    list.sort(function (a, b) {
      if (by === 'price-low') return a.price - b.price;
      if (by === 'price-high') return b.price - a.price;
      if (by === 'newest') return a.created_at < b.created_at ? 1 : -1;
      return (b.sold - a.sold) || (a.created_at < b.created_at ? 1 : -1);
    });
    return list;
  }
  function facets(list, field) {
    var map = {};
    list.forEach(function (p) {
      var k = p[field];
      if (!map[k]) map[k] = { name: k, count: 0, image: p.image };
      map[k].count++;
      if (!map[k].image && p.image) map[k].image = p.image;
    });
    return map;
  }

  /* ---------- rendering ---------- */
  function shell() {
    root.innerHTML =
      '<div class="sb-cats" id="sb-cats" role="tablist" aria-label="Categories"></div>' +
      '<div class="sb-tiles-wrap"><div class="sb-tiles" id="sb-tiles"></div></div>' +
      '<div class="sb-toolbar">' +
        '<div class="sb-count" id="sb-count" aria-live="polite"></div>' +
        '<label class="sb-sort"><span>Sort</span><select id="sb-sort">' +
          SORTS.map(function (s) { return '<option value="' + s.id + '">' + s.label + '</option>'; }).join('') +
        '</select></label>' +
      '</div>' +
      '<div class="sb-grid" id="sb-grid"></div>' +
      '<div class="sb-more" id="sb-more"></div>';
  }

  function renderCats() {
    var counts = facets(baseList(), 'category');
    var names = sortedCategories(Object.keys(counts));
    var total = baseList().length;
    var html = '<button type="button" role="tab" class="sb-cat' + (state.category === 'all' ? ' active' : '') +
      '" data-cat="all">All <em>' + total + '</em></button>';
    names.forEach(function (n) {
      html += '<button type="button" role="tab" class="sb-cat' + (state.category === n ? ' active' : '') +
        '" data-cat="' + esc(n) + '">' + esc(n) + ' <em>' + counts[n].count + '</em></button>';
    });
    document.getElementById('sb-cats').innerHTML = html;
  }

  function tile(label, count, image, active, attr, value) {
    return '<button type="button" class="sb-tile' + (active ? ' active' : '') + '" ' + attr + '="' + esc(value) + '">' +
      '<span class="sb-tile-img">' + (image ? '<img src="' + esc(image) + '" alt="" loading="lazy" decoding="async">' : '') + '</span>' +
      '<span class="sb-tile-label">' + esc(label) + '</span>' +
      '<span class="sb-tile-count">' + count + '</span></button>';
  }

  function renderTiles() {
    var wrap = document.getElementById('sb-tiles');
    var html = '';
    if (state.category === 'all') {
      // Level 1: show categories
      var cats = facets(baseList(), 'category');
      sortedCategories(Object.keys(cats)).forEach(function (n) {
        html += tile(n, cats[n].count, cats[n].image, false, 'data-cat', n);
      });
    } else {
      // Level 2: show subcategories of the chosen category
      var inCat = baseList().filter(function (p) { return p.category === state.category; });
      var subs = facets(inCat, 'subcategory');
      html += tile('All ' + state.category, inCat.length, inCat[0] && inCat[0].image, state.subcategory === 'all', 'data-sub', 'all');
      Object.keys(subs).sort(function (a, b) { return subs[b].count - subs[a].count; }).forEach(function (n) {
        html += tile(n, subs[n].count, subs[n].image, state.subcategory === n, 'data-sub', n);
      });
    }
    wrap.innerHTML = html;
    var active = wrap.querySelector('.active');
    if (active && active.scrollIntoView) {
      try { active.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { /* ignore */ }
    }
  }

  function card(p) {
    var href = 'product.html?id=' + encodeURIComponent(p.id);
    var range = p.maxPrice > p.price;
    var sold = p.sold > 0 ? '<span class="sb-sold">' + p.sold.toLocaleString() + ' sold</span>' : '';
    var rating = (p.reviews > 0 && p.rating > 0)
      ? '<span class="sb-rating">\u2605 ' + p.rating.toFixed(1) + '</span>' : '';
    var action = p.inStock
      ? (p.variantCount > 1
          ? '<a class="sb-add" href="' + href + '" aria-label="Choose options for ' + esc(p.name) + '">+</a>'
          : '<button type="button" class="sb-add" data-add="' + esc(p.key) + '" aria-label="Add ' + esc(p.name) + ' to cart">+</button>')
      : '';
    return '<article class="sb-card' + (p.inStock ? '' : ' sb-out') + '">' +
      '<a class="sb-card-img" href="' + href + '">' +
        (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">' : '') +
        (p.inStock ? '' : '<span class="sb-badge">Sold out</span>') +
      '</a>' +
      '<button type="button" class="sb-wish' + (wishOn(p.id) ? ' active' : '') + '" data-wish="' + esc(p.id) + '" aria-label="Toggle wishlist">' +
        (wishOn(p.id) ? '\u2665' : '\u2661') + '</button>' +
      '<div class="sb-card-body">' +
        '<a class="sb-card-title" href="' + href + '">' + esc(p.name) + '</a>' +
        '<div class="sb-meta">' + rating + sold + '</div>' +
        '<div class="sb-price-row">' +
          '<span class="sb-price">' + (range ? '<small>from</small> ' : '') + money(p.price) + '</span>' + action +
        '</div>' +
      '</div></article>';
  }

  function renderGrid() {
    var grid = document.getElementById('sb-grid');
    var more = document.getElementById('sb-more');
    var count = document.getElementById('sb-count');

    if (state.status === 'loading') {
      grid.innerHTML = new Array(10 + 1).join('<div class="sb-card sb-skel"><div class="sb-card-img"></div><div class="sb-card-body"><i></i><i></i></div></div>');
      more.innerHTML = '';
      count.textContent = '';
      return;
    }
    if (state.status === 'error') {
      grid.innerHTML = '';
      count.textContent = '';
      more.innerHTML = '<div class="sb-empty"><p>We couldn\u2019t load products right now.</p><button type="button" class="sb-btn" data-retry="1">Try again</button></div>';
      return;
    }

    var list = filtered();
    var shown = list.slice(0, state.visible);
    var heading = state.subcategory !== 'all' ? state.subcategory : (state.category !== 'all' ? state.category : 'All products');
    count.innerHTML = '<strong>' + esc(heading) + '</strong> \u00B7 ' + list.length + ' item' + (list.length === 1 ? '' : 's');

    if (!list.length) {
      grid.innerHTML = '';
      more.innerHTML = '<div class="sb-empty"><p>No products found' + (state.search ? ' for \u201C' + esc(state.search) + '\u201D' : '') + '.</p>' +
        '<button type="button" class="sb-btn" data-reset="1">Show all products</button></div>';
      return;
    }
    grid.innerHTML = shown.map(card).join('');
    if (shown.length < list.length) {
      more.innerHTML = '<div id="sb-sentinel"></div><button type="button" class="sb-btn" data-more="1">Load more</button>';
      watchSentinel();
    } else {
      more.innerHTML = '<p class="sb-end">You\u2019ve seen everything here</p>';
    }
  }

  function renderAll() {
    renderCats();
    renderTiles();
    document.getElementById('sb-sort').value = state.sort;
    renderGrid();
  }

  function watchSentinel() {
    if (observer) observer.disconnect();
    var s = document.getElementById('sb-sentinel');
    if (!s || !('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '700px 0px' });
    observer.observe(s);
  }
  function loadMore() {
    state.visible += PAGE_SIZE;
    renderGrid();
  }

  /* ---------- actions ---------- */
  function go(next, push) {
    state.category = next.category != null ? next.category : state.category;
    state.subcategory = next.subcategory != null ? next.subcategory : state.subcategory;
    state.visible = PAGE_SIZE;
    writeUrl(push !== false);
    renderAll();
    var top = root.getBoundingClientRect().top + window.pageYOffset - (stickyTop() + 8);
    if (window.pageYOffset > top) window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function addByKey(key) {
    var p = state.all.filter(function (x) { return x.key === key; })[0];
    if (!p || typeof addToCart !== 'function') return;
    addToCart(p.id, 1, {
      id: p.id, name: p.name, price: p.price, image: p.image, supplier: p.supplier,
      supplierProductId: p.supplierProductId, supplierVariantId: p.supplierVariantId, supplierSku: p.supplierSku
    });
  }

  root.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-cat]'))) return go({ category: t.getAttribute('data-cat'), subcategory: 'all' });
    if ((t = e.target.closest('[data-sub]'))) return go({ subcategory: t.getAttribute('data-sub') });
    if ((t = e.target.closest('[data-add]'))) { e.preventDefault(); return addByKey(t.getAttribute('data-add')); }
    if ((t = e.target.closest('[data-wish]'))) {
      e.preventDefault();
      var id = t.getAttribute('data-wish');
      if (typeof toggleWishlist === 'function') toggleWishlist(id);
      var on = wishOn(id);
      t.classList.toggle('active', on);
      t.textContent = on ? '\u2665' : '\u2661';
      return;
    }
    if (e.target.closest('[data-more]')) return loadMore();
    if (e.target.closest('[data-reset]')) { state.search = ''; return go({ category: 'all', subcategory: 'all' }); }
    if (e.target.closest('[data-retry]')) return boot();
  });
  root.addEventListener('change', function (e) {
    if (e.target.id === 'sb-sort') {
      state.sort = e.target.value;
      state.visible = PAGE_SIZE;
      writeUrl(false);
      renderGrid();
    }
  });
  window.addEventListener('popstate', function () { readUrl(); renderAll(); });

  // Header search box (site-search-input) -> filter in place instead of reloading
  function hookSearch(inputId, buttonId) {
    var input = document.getElementById(inputId);
    var button = document.getElementById(buttonId);
    if (!input) return;
    function run(ev) {
      if (ev) ev.preventDefault();
      state.search = input.value.trim();
      state.visible = PAGE_SIZE;
      writeUrl(false);
      renderAll();
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.stopImmediatePropagation(); run(e); }
    }, true);
    if (button) button.addEventListener('click', function (e) { e.stopImmediatePropagation(); run(e); }, true);
  }

  // keep the category bar just under the sticky site header
  function stickyTop() {
    var h = document.querySelector('.site-header');
    return h ? h.offsetHeight : 0;
  }
  function placeSticky() {
    root.style.setProperty('--sb-top', stickyTop() + 'px');
  }

  /* ---------- boot ---------- */
  async function boot() {
    state.status = 'loading';
    renderGrid();
    try {
      if (window._appReady) { try { await window._appReady; } catch (e) { /* main.js logs it */ } }
      var rows = await fetchAllRows();
      state.all = groupRows(rows);
      state.status = 'ready';
    } catch (err) {
      console.error('shop-browse:', err);
      state.status = 'error';
    }
    renderAll();
  }

  shell();
  readUrl();
  placeSticky();
  window.addEventListener('resize', placeSticky);
  window.addEventListener('load', placeSticky);
  hookSearch('site-search-input', 'site-search-submit');
  hookSearch('mobile-site-search-input', 'mobile-search-submit');
  var pre = document.getElementById('site-search-input');
  if (pre && state.search) pre.value = state.search;
  boot();
})();