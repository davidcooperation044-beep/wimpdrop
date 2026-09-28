(function () {
  'use strict';

  function formatMoney(value) {
    try {
      if (typeof formatCurrency === 'function') return formatCurrency(Number(value || 0));
    } catch (e) {}
    return '₦' + Number(value || 0).toLocaleString();
  }

  function renderWatchlistPage() {
    const container = document.getElementById('watchlist-items');
    const copy = document.getElementById('watchlist-copy');
    const savedCount = document.getElementById('saved-count');
    const availableCount = document.getElementById('available-count');
    const mobileCount = document.getElementById('mobile-watchlist-count');

    const savedProducts = Array.isArray(AppState.products) ? AppState.products.filter(function (product) {
      return Array.isArray(AppState.wishlist) && AppState.wishlist.includes(product.id);
    }) : [];

    if (!savedProducts.length) {
      container.innerHTML = '<div class="wl-empty"><h3>Nothing saved yet</h3><p>Heart a few items to keep them here for later.</p><a href="/pages/shop.html" class="btn btn-primary">Discover products</a></div>';
      if (copy) copy.textContent = '0 saved items';
      if (savedCount) savedCount.textContent = '0';
      if (availableCount) availableCount.textContent = '0';
      if (mobileCount) mobileCount.textContent = '0 saved';
      return;
    }

    container.innerHTML = '<div class="wl-grid">' + savedProducts.map(function (product) {
      const productId = product.id || product.product_id || '';
      return '<article class="sb-card"><a class="sb-card-img" href="/pages/product.html?id=' + encodeURIComponent(productId) + '"><img src="' + (product.image || '/images/wimp.png') + '" alt="' + (product.name || product.title || 'Product') + '" loading="lazy"></a><button type="button" class="sb-wish active" data-wishlist-remove="' + escapeHtml(productId) + '" aria-label="Remove from watchlist">♥</button><div class="sb-card-body"><a class="sb-card-title" href="/pages/product.html?id=' + encodeURIComponent(productId) + '">' + (product.name || product.title || 'Product') + '</a><div class="sb-price-row"><span class="sb-price">' + formatMoney(product.price || 0) + '</span><button type="button" class="sb-add" data-add-watchlist="' + escapeHtml(productId) + '">+</button></div></div></article>';
    }).join('') + '</div>';

    if (copy) copy.textContent = savedProducts.length + ' saved item' + (savedProducts.length === 1 ? '' : 's');
    if (savedCount) savedCount.textContent = String(savedProducts.length);
    if (availableCount) availableCount.textContent = String(savedProducts.filter(function (p) { return Number(p.stock_quantity || 0) > 0; }).length);
    if (mobileCount) mobileCount.textContent = savedProducts.length + ' saved';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  document.addEventListener('click', function (event) {
    const removeButton = event.target.closest('[data-wishlist-remove]');
    if (removeButton) {
      const id = removeButton.getAttribute('data-wishlist-remove');
      if (typeof toggleWishlist === 'function') toggleWishlist(id);
      renderWatchlistPage();
      return;
    }

    const addButton = event.target.closest('[data-add-watchlist]');
    if (addButton) {
      const id = addButton.getAttribute('data-add-watchlist');
      const product = Array.isArray(AppState.products) ? AppState.products.find(function (item) { return String(item.id) === String(id); }) : null;
      if (product && typeof addToCart === 'function') {
        addToCart(product.id, 1, product);
      }
      renderWatchlistPage();
    }
  });

  window.renderWatchlist = renderWatchlistPage;

  document.addEventListener('DOMContentLoaded', function () {
    renderWatchlistPage();
  });
})();
