// Mobile UI enhancements for Wimp-Drop
(function(){
  function buildBottomNav(){
    if (document.getElementById('wimp-bottom-nav')) return;
    const nav = document.createElement('nav');
    nav.id = 'wimp-bottom-nav';
    nav.className = 'bottom-nav card';
    nav.innerHTML = `
      <a href="/" aria-label="Home">🏠<div style="font-size:0.75rem; margin-top:4px;">Home</div></a>
      <a href="/pages/shop.html" aria-label="Shop">🛍️<div style="font-size:0.75rem; margin-top:4px;">Shop</div></a>
      <a href="/pages/cart.html" aria-label="Cart">🛒 <span id="mobile-cart-badge" class="cart-badge" style="display:none">0</span><div style="font-size:0.75rem; margin-top:4px;">Cart</div></a>
      <a href="/pages/account.html" aria-label="Account">👤<div style="font-size:0.75rem; margin-top:4px;">Account</div></a>
    `;
    document.body.appendChild(nav);
    // adjust body bottom padding so content isn't hidden
    const bodyPad = parseInt(getComputedStyle(document.body).paddingBottom || '0', 10);
    document.body.style.paddingBottom = Math.max(bodyPad, 86) + 'px';

    // wire cart badge updates
    function refreshBadge(){
      try{
        const badge = document.getElementById('mobile-cart-badge');
        const globalBadge = document.querySelector('[data-cart-badge]');
        if (!badge) return;
        if (globalBadge && globalBadge.textContent) {
          const val = Number(globalBadge.textContent) || 0;
          badge.textContent = val;
          badge.style.display = val > 0 ? 'inline-block' : 'none';
        }
      }catch(e){console.warn('mobile-ui badge update', e)}
    }

    // initial refresh
    refreshBadge();
    // try to observe changes to the global cart badge
    const target = document.querySelector('[data-cart-badge]');
    if (target && window.MutationObserver) {
      const mo = new MutationObserver(refreshBadge);
      mo.observe(target, { childList: true, characterData: true, subtree: true });
    }
  }

  if (window.matchMedia && window.matchMedia('(max-width:899px)').matches) {
    document.addEventListener('DOMContentLoaded', buildBottomNav);
  }
})();
