/* order-success-page.js -> /js/order-success-page.js
   Shows only what the redirect URL / orders table provide. No placeholder order numbers or totals. */
(function () {
  'use strict';

  function money(n) {
    try { if (typeof formatCurrency === 'function') return formatCurrency(Number(n || 0)); } catch (e) { /* fall through */ }
    return '\u20A6' + Number(n || 0).toLocaleString();
  }
  function setText(id, t) { var e = document.getElementById(id); if (e) e.textContent = t; }
  function fmtDate(v) {
    var d = new Date(v || Date.now());
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  async function waitReady() {
    var tries = 0;
    while (!window._appReady && tries < 100) { await new Promise(function (r) { setTimeout(r, 20); }); tries++; }
    try { if (window._appReady) await window._appReady; } catch (e) { /* ignore */ }
  }

  async function fetchOrder(ref) {
    if (!ref || typeof supabaseService === 'undefined' || !supabaseService.isInitialized) return null;
    try {
      var res = await supabaseService.getOrder(ref);
      if (res && res.success && res.order) return res.order;
    } catch (e) { console.warn('Order lookup failed', e); }
    return null;
  }

  function showFailure(message) {
    var badge = document.getElementById('os-badge');
    if (badge) { badge.textContent = '!'; badge.classList.add('is-fail'); }
    setText('os-eyebrow', 'Payment not completed');
    setText('os-title', 'We could not complete your payment');
    setText('os-lead', message);
    var next = document.getElementById('os-next');
    if (next) next.hidden = true;
    var grid = document.getElementById('os-details');
    if (grid) grid.hidden = true;
    var primary = document.getElementById('os-track');
    if (primary) { primary.textContent = 'Back to cart'; primary.setAttribute('href', '/pages/cart.html'); }
  }

  async function render() {
    await waitReady();
    var params = new URLSearchParams(window.location.search);
    var status = params.get('status');
    if (status === 'failed' || status === 'cancelled') {
      showFailure('Your card was not charged for this attempt. You can go back to your cart and try again.');
      return;
    }

    var ref = params.get('tx_ref') || sessionStorage.getItem('viewOrderId') || sessionStorage.getItem('lastOrderId') || '';
    var email = (window.AppState && AppState.user && AppState.user.email) || sessionStorage.getItem('lastOrderEmail') || '';
    setText('confirmation-email', email || 'your email address');

    var order = await fetchOrder(ref);
    var numberEl = document.getElementById('order-number');
    var copyBtn = document.getElementById('copy-order-number');

    if (order) {
      var num = order.order_number || order.id || ref;
      setText('order-number', String(num));
      setText('order-date', fmtDate(order.created_at));
      var total = Number(order.total_amount != null ? order.total_amount : order.total);
      setText('order-total', isFinite(total) ? money(total) : 'Shown in your order history');
      setText('order-status-message', 'Your payment has been received and your order is being processed.');
    } else if (ref) {
      setText('order-number', ref);
      setText('order-date', fmtDate());
      setText('order-total', 'Shown in your order history');
      setText('order-status-message', 'We are still confirming the details of this order. Check your order history shortly.');
    } else {
      setText('order-number', 'Not available');
      setText('order-date', '-');
      setText('order-total', '-');
      setText('order-status-message', 'Order details are available in your order history.');
      if (copyBtn) copyBtn.hidden = true;
    }

    if (copyBtn && numberEl && !copyBtn.hidden) {
      copyBtn.addEventListener('click', function () {
        var value = numberEl.textContent.trim();
        var done = function () { setText('os-copy-status', 'Order number copied'); if (typeof showNotification === 'function') showNotification('Order number copied', 'success'); };
        var fail = function () { setText('os-copy-status', 'Copy failed. Please select and copy the number manually.'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(done).catch(fail);
        else fail();
      });
    }
  }

  window.renderOrderSuccess = render;
  document.addEventListener('DOMContentLoaded', render);
})();