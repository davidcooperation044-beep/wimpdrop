(function () {
  'use strict';

  function formatMoney(value) {
    try {
      if (typeof formatCurrency === 'function') return formatCurrency(Number(value || 0));
    } catch (e) {}
    return '₦' + Number(value || 0).toLocaleString();
  }

  function getCartTotal() {
    try {
      return Number((typeof window.getCartTotal === 'function' ? window.getCartTotal() : 0)) || 0;
    } catch (e) {
      return 0;
    }
  }

  function renderCartPage() {
    const container = document.getElementById('cart-items-container');
    const countCopy = document.getElementById('cart-count-copy');
    const mobileTotal = document.getElementById('mobile-total');
    const subtotalEl = document.getElementById('subtotal');
    const shippingEl = document.getElementById('shipping');
    const taxEl = document.getElementById('tax');
    const totalEl = document.getElementById('total');

    const cart = Array.isArray(AppState.cart) ? AppState.cart : [];
    if (!cart.length) {
      const suggested = Array.isArray(AppState.products) ? AppState.products.slice(0, 3) : [];
      container.innerHTML = '<div class="ct-empty"><h3>Your cart is empty</h3><p>Save a few items you love and return here when you’re ready to check out.</p><div class="ct-suggested">' + suggested.map(function (product) {
        return '<article class="sb-card"><a class="sb-card-img" href="/pages/product.html?id=' + encodeURIComponent(product.id) + '"><img src="' + (product.image || '/images/wimp.png') + '" alt="' + (product.name || product.title || 'Product') + '" loading="lazy"></a><div class="sb-card-body"><a class="sb-card-title" href="/pages/product.html?id=' + encodeURIComponent(product.id) + '">' + (product.name || product.title || 'Product') + '</a><div class="sb-price-row"><span class="sb-price">' + formatMoney(product.price || 0) + '</span><button type="button" class="sb-add" data-add="' + (product.id || '') + '">+</button></div></div></article>';
      }).join('') + '</div><div style="margin-top:1rem"><a href="/pages/shop.html" class="btn btn-primary">Browse the catalog</a></div></div>';

      if (countCopy) countCopy.textContent = '0 items ready to ship';
      if (mobileTotal) mobileTotal.textContent = formatMoney(0);
      if (subtotalEl) subtotalEl.textContent = formatMoney(0);
      if (shippingEl) shippingEl.textContent = formatMoney(0);
      if (taxEl) taxEl.textContent = formatMoney(0);
      if (totalEl) totalEl.textContent = formatMoney(0);
      return;
    }

    container.innerHTML = cart.map(function (item) {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const total = quantity * price;
      return '<div class="ct-item"><div class="ct-thumb"><img src="' + (item.image || '/images/wimp.png') + '" alt="' + (item.name || 'Product') + '" loading="lazy"></div><div class="ct-copy"><h3>' + (item.name || 'Product') + '</h3><div class="ct-meta"><span class="ct-pill">' + (item.supplier || 'Trusted source') + '</span><span class="ct-pill">In stock</span></div><div class="ct-qty"><button type="button" data-qty-action="decrease" data-item-id="' + (item.id || '') + '">−</button><span>' + quantity + '</span><button type="button" data-qty-action="increase" data-item-id="' + (item.id || '') + '">+</button></div></div><div class="ct-actions"><button class="ct-remove" type="button" data-remove-id="' + (item.id || '') + '">Remove</button><div class="ct-price">' + formatMoney(total) + '</div></div></div>';
    }).join('');

    const subtotal = cart.reduce(function (sum, item) { return sum + (Number(item.price || 0) * Number(item.quantity || 0)); }, 0);
    const shipping = subtotal > 0 ? 0 : 0;
    const tax = Math.round(subtotal * 0.075);
    const total = subtotal + shipping + tax;

    if (countCopy) countCopy.textContent = cart.length + ' item' + (cart.length === 1 ? '' : 's') + ' ready to ship';
    if (mobileTotal) mobileTotal.textContent = formatMoney(total);
    if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
    if (shippingEl) shippingEl.textContent = formatMoney(shipping);
    if (taxEl) taxEl.textContent = formatMoney(tax);
    if (totalEl) totalEl.textContent = formatMoney(total);
  }

  document.addEventListener('click', function (event) {
    const addBtn = event.target.closest('[data-add]');
    if (addBtn) {
      const id = addBtn.getAttribute('data-add');
      if (id && typeof addToCart === 'function') addToCart(id, 1, AppState.products.find(function (product) { return String(product.id) === String(id); }));
      renderCartPage();
    }

    const removeBtn = event.target.closest('[data-remove-id]');
    if (removeBtn) {
      const id = removeBtn.getAttribute('data-remove-id');
      if (typeof removeFromCart === 'function') removeFromCart(id);
      renderCartPage();
    }

    const qtyBtn = event.target.closest('[data-qty-action]');
    if (qtyBtn) {
      const id = qtyBtn.getAttribute('data-item-id');
      const dir = qtyBtn.getAttribute('data-qty-action');
      const current = Array.isArray(AppState.cart) ? AppState.cart.find(function (item) { return String(item.id) === String(id); }) : null;
      if (!current) return;
      const next = dir === 'increase' ? current.quantity + 1 : current.quantity - 1;
      if (typeof updateCartQuantity === 'function') {
        updateCartQuantity(id, next);
      } else if (typeof window.updateCartQuantity === 'function') {
        window.updateCartQuantity(id, next);
      }
      renderCartPage();
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    renderCartPage();
  });
})();
