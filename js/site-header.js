(function () {
  'use strict';

  var HEADER_CATEGORY_MAP = {
    electronics: 'Electronics',
    fashion: 'Fashion',
    'home': 'Home & Kitchen',
    'home & kitchen': 'Home & Kitchen',
    accessories: 'Accessories',
    'sports': 'Sports & Outdoors',
    'sports & outdoors': 'Sports & Outdoors',
    gadgets: 'Electronics',
    'beauty': 'Beauty & Personal Care',
    'beauty & personal care': 'Beauty & Personal Care'
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch];
    });
  }

  function normalizeCategory(raw) {
    if (!raw) return '';
    var found = HEADER_CATEGORY_MAP[String(raw).trim().toLowerCase()];
    return found || raw;
  }

  function patchLegacyLinks() {
    var links = document.querySelectorAll('a[href*="/pages/shop.html"]');
    links.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (!href.includes('shop.html?')) return;
      var params = new URLSearchParams(href.split('?')[1] || '');
      var searchTerm = params.get('search');
      if (searchTerm) {
        var mapped = normalizeCategory(searchTerm);
        if (mapped) {
          params.delete('search');
          params.set('category', mapped);
          link.setAttribute('href', '/pages/shop.html?' + params.toString());
        }
      }
    });
  }

  function buildHeaderMarkup() {
    return [
      '<div class="header-container">',
      '  <div class="site-nav-main">',
      '    <div class="brand-group">',
      '      <a href="/index.html" class="logo link-reset">Wimp<span>-Drop</span></a>',
      '      <div class="nav-menu-trigger">',
      '        <button class="btn btn-outline btn-small nav-menu-btn" type="button" id="nav-menu-button" aria-expanded="false" aria-controls="site-nav-menu">',
      '          Shop <span class="nav-menu-chevron">▾</span>',
      '        </button>',
      '        <div class="nav-menu" id="site-nav-menu">',
      '          <a href="/pages/shop.html">All products</a>',
      '          <a href="/pages/shop.html?category=Electronics">Electronics</a>',
      '          <a href="/pages/shop.html?category=Fashion">Fashion</a>',
      '          <a href="/pages/shop.html?category=Home%20%26%20Kitchen">Home &amp; Kitchen</a>',
      '          <a href="/pages/shop.html?category=Accessories">Accessories</a>',
      '          <a href="/pages/shop.html?category=Sports%20%26%20Outdoors">Sports &amp; Outdoors</a>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div class="site-search">',
      '      <input id="site-search-input" type="search" placeholder="Search products, brands, categories…" autocomplete="off" data-search>',
      '      <button class="btn btn-primary search-submit" id="site-search-submit" type="button">Search</button>',
      '      <div class="search-suggestions" id="search-suggestions"></div>',
      '    </div>',
      '    <div class="site-actions">',
      '      <button class="icon-btn mobile-search-toggle" id="mobile-search-toggle" type="button" aria-label="Open search">🔎</button>',
      '      <a href="/pages/account.html" class="icon-link" aria-label="Account">👤</a>',
      '      <a href="/pages/watchlist.html" class="icon-link" aria-label="Watchlist">♡<span class="badge" data-wishlist-badge style="display:none">0</span></a>',
      '      <a href="/pages/cart.html" class="icon-link" aria-label="Cart">🛒<span class="badge" data-cart-badge style="display:none">0</span></a>',
      '      <button class="icon-btn mobile-menu-btn" id="mobile-menu-button" type="button" aria-label="Open menu">☰</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '<div class="site-subnav">',
      '  <div class="subnav-links">',
      '    <a href="/pages/shop.html">Shop</a>',
      '    <a href="/pages/shop.html?category=Electronics">Electronics</a>',
      '    <a href="/pages/shop.html?category=Fashion">Fashion</a>',
      '    <a href="/pages/shop.html?category=Home%20%26%20Kitchen">Home &amp; Kitchen</a>',
      '    <a href="/pages/shop.html?category=Accessories">Accessories</a>',
      '    <a href="/pages/shop.html?category=Sports%20%26%20Outdoors">Sports &amp; Outdoors</a>',
      '  </div>',
      '  <div class="subnav-promo">Search first, shop fast — new arrivals live from the catalog.</div>',
      '</div>',
      '<div class="mobile-search-panel" id="mobile-search-panel" aria-hidden="true">',
      '  <div class="mobile-search-shell">',
      '    <div class="site-search">',
      '      <input id="mobile-site-search-input" type="search" placeholder="Search Wimp-Drop catalog…" autocomplete="off">',
      '      <button class="btn btn-primary search-submit" id="mobile-search-submit" type="button">Search</button>',
      '    </div>',
      '    <div class="search-suggestions" id="mobile-search-suggestions"></div>',
      '    <button class="btn btn-secondary btn-small mobile-search-close" type="button">Close</button>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function buildFooterMarkup() {
    return [
      '<div class="footer-content">',
      '  <nav class="footer-links" aria-label="Footer links">',
      '    <a href="/pages/about.html">About</a>',
      '    <a href="/pages/contact.html">Contact</a>',
      '    <a href="/pages/terms.html">Terms of Service</a>',
      '    <a href="/pages/privacy.html">Privacy Policy</a>',
      '    <a href="/pages/disclaimer.html">Disclaimer</a>',
      '    <a href="/pages/security.html">Security</a>',
      '  </nav>',
      '</div>',
      '<div class="footer-bottom">',
      '  <p>&copy; 2026 Wimp-Drop. All rights reserved.</p>',
      '</div>'
    ].join('');
  }

  function ensureSharedHeader() {
    var existingHeader = document.querySelector('header.site-header');
    if (existingHeader) {
      existingHeader.setAttribute('data-shared-header', 'true');
      existingHeader.innerHTML = buildHeaderMarkup();
      return;
    }

    var header = document.createElement('header');
    header.className = 'site-header';
    header.setAttribute('data-shared-header', 'true');
    header.innerHTML = buildHeaderMarkup();

    var firstNode = document.body.firstChild;
    if (firstNode) {
      document.body.insertBefore(header, firstNode);
    } else {
      document.body.appendChild(header);
    }
  }

  function ensureSharedFooter() {
    var existingFooter = document.querySelector('footer');
    if (existingFooter) {
      existingFooter.setAttribute('data-shared-footer', 'true');
      existingFooter.innerHTML = buildFooterMarkup();
      return;
    }

    var footer = document.createElement('footer');
    footer.setAttribute('data-shared-footer', 'true');
    footer.innerHTML = buildFooterMarkup();
    document.body.appendChild(footer);
  }

  function markActiveLinks() {
    var path = window.location.pathname;
    var cat = new URLSearchParams(window.location.search).get('category');
    document.querySelectorAll('.subnav-links a').forEach(function (a) {
      a.classList.remove('active');
      a.removeAttribute('aria-current');
      var u;
      try { u = new URL(a.getAttribute('href'), window.location.origin); } catch (e) { return; }
      var linkCat = u.searchParams.get('category');
      var onShop = path.indexOf('/pages/shop.html') !== -1;
      var match = onShop && ((cat && linkCat === cat) || (!cat && !linkCat));
      if (match) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
    });
  }

  // Loads the cart/wishlist account sync on every page that uses the shared header,
  // so no individual page needs its own <script> tag for it.
  function loadAccountSync() {
    if (window.__wimpAccountSync || document.querySelector('script[data-account-sync]')) return;
    var s = document.createElement('script');
    s.src = '/js/account-sync.js';
    s.setAttribute('data-account-sync', 'true');
    (document.body || document.head).appendChild(s);
  }

  function init() {
    patchLegacyLinks();
    ensureSharedHeader();
    ensureSharedFooter();
    markActiveLinks();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadAccountSync);
    } else {
      loadAccountSync();
    }
  }

  // This script must load BEFORE main.js so main.js binds to the injected header.
  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();