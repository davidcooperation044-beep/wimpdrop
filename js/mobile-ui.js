// Mobile navigation and interaction enhancements for Wimp-Drop.
(function () {
  const NAV_ITEMS = [
    { label: 'Home', href: '/index.html', match: ['/','/index.html'], icon: 'home' },
    { label: 'Shop', href: '/pages/shop.html', match: ['/pages/shop.html','/pages/product.html'], icon: 'shop' },
    { label: 'Cart', href: '/pages/cart.html', match: ['/pages/cart.html','/pages/checkout.html'], icon: 'cart' },
    { label: 'Wishlist', href: '/pages/watchlist.html', match: ['/pages/watchlist.html'], icon: 'heart' },
    { label: 'Account', href: '/pages/account.html', match: ['/pages/account.html'], icon: 'user' }
  ];

  const ICONS = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"/>',
    shop: '<path d="M4 9h16l-1 11H5L4 9Z"/><path d="M8 9a4 4 0 0 1 8 0M9 13h6"/>',
    cart: '<circle cx="9" cy="19" r="1.5"/><circle cx="18" cy="19" r="1.5"/><path d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.5h8.5a2 2 0 0 0 1.9-1.4L21 8H6"/>',
    heart: '<path d="M20.8 8.7c0 5.5-8.8 10.3-8.8 10.3S3.2 14.2 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>'
  };

  function iconMarkup(name, filled) {
    return `<svg class="mobile-nav-icon${filled ? ' is-filled' : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g>${ICONS[name]}</g></svg>`;
  }

  function currentPath() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    return path.toLowerCase();
  }

  function getCartCount() {
    if (typeof AppState === 'undefined' || !Array.isArray(AppState.cart)) return 0;
    return AppState.cart.reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
  }

  function updateCartBadge(nav) {
    const badge = nav.querySelector('[data-mobile-cart-count]');
    if (!badge) return;
    const count = getCartCount();
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
    nav.classList.toggle('has-cart-items', count > 0);
  }

  function buildBottomNav() {
    if (document.getElementById('wimp-bottom-nav')) return;

    const path = currentPath();
    const nav = document.createElement('nav');
    nav.id = 'wimp-bottom-nav';
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Primary mobile navigation');
    nav.innerHTML = NAV_ITEMS.map((item) => {
      const active = item.match.includes(path);
      return `<a class="mobile-nav-item${active ? ' is-active' : ''}" href="${item.href}"${active ? ' aria-current="page"' : ''}>
        <span class="mobile-nav-icon-wrap">${iconMarkup(item.icon, active)}${item.icon === 'cart' ? '<span class="mobile-nav-badge" data-mobile-cart-count hidden>0</span>' : ''}</span>
        <span class="mobile-nav-label">${item.label}</span>
      </a>`;
    }).join('');

    document.body.appendChild(nav);
    updateCartBadge(nav);
    window.addEventListener('wimp:cart-state-changed', () => updateCartBadge(nav));
    window.addEventListener('storage', (event) => {
      if (event.key === 'wimp_cart') updateCartBadge(nav);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildBottomNav, { once: true });
  } else {
    buildBottomNav();
  }
})();
