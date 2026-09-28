(function () {
  'use strict';

  function formatMoney(value) {
    try {
      if (typeof formatCurrency === 'function') return formatCurrency(Number(value || 0));
    } catch (e) {}
    return '₦' + Number(value || 0).toLocaleString();
  }

  function getRedirectParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      status: params.get('status'),
      txRef: params.get('tx_ref'),
      transactionId: params.get('transaction_id')
    };
  }

  async function waitForReady() {
    let attempts = 0;
    while (!window._appReady && attempts < 100) {
      await new Promise(function (resolve) { setTimeout(resolve, 20); });
      attempts += 1;
    }
    if (window._appReady) await window._appReady;
  }

  async function fetchOrder(orderRef) {
    if (!orderRef || typeof supabaseService === 'undefined' || !supabaseService.isInitialized) return null;
    try {
      const res = await supabaseService.getOrder(orderRef);
      if (res && res.success && res.order) return res.order;
    } catch (e) {}
    return null;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  async function renderOrderSuccess() {
    await waitForReady();
    const params = getRedirectParams();
    const orderRef = params.txRef || sessionStorage.getItem('lastOrderId') || '000000';
    const email = AppState.user?.email || sessionStorage.getItem('lastOrderEmail') || 'your inbox';

    setText('order-number', '#ORD-' + (orderRef || '000000'));
    setText('confirmation-email', email);
    setText('order-date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    setText('order-total', formatMoney(0));

    if (params.status === 'failed' || params.status === 'cancelled') {
      showNotification('Your payment was not completed. Please try again from your cart.', 'error');
      return;
    }

    const order = await fetchOrder(orderRef);
    if (order) {
      setText('order-number', '#ORD-' + (order.order_number || order.id || orderRef));
      setText('order-date', new Date(order.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
      setText('order-total', formatMoney(Number(order.total_amount || order.total || 0)));
    }

    const copyButton = document.getElementById('copy-order-number');
    if (copyButton) {
      copyButton.addEventListener('click', function () {
        const value = document.getElementById('order-number').textContent.replace('#', '');
        navigator.clipboard.writeText(value).then(function () {
          showNotification('Order number copied', 'success');
        }).catch(function () {
          showNotification('Copy failed. Please copy it manually.', 'error');
        });
      });
    }
  }

  window.renderOrderSuccess = renderOrderSuccess;

  document.addEventListener('DOMContentLoaded', renderOrderSuccess);
})();
