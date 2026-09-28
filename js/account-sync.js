/* account-sync.js -> /js/account-sync.js
   Saves the shopper's cart and wishlist to their account (Supabase) so they follow
   the person to any device. localStorage stays as the fast local copy / guest cart.

   Loaded automatically by site-header.js, so no page needs a new <script> tag.
   Needs the SQL in supabase/migrations/202609280001_account_cart_wishlist_sync.sql.

   How it behaves
   - Guest (not logged in): nothing changes, cart/wishlist live in localStorage only.
   - Log in: the guest cart/wishlist is MERGED with the one saved on the account.
   - Logged in: every cart change is saved to the account (debounced), and the latest
     account cart/wishlist is pulled when a page opens and when the tab regains focus.
   - Log out: this device's local copy is cleared (already done by handleLogout);
     the account keeps its saved cart/wishlist.
*/
(function () {
  'use strict';
  if (window.__wimpAccountSync) return;
  window.__wimpAccountSync = true;

  var OWNER_CART = 'wimp_cart_owner';   // user id the local cart was last in sync with
  var DIRTY_CART = 'wimp_cart_dirty';   // '1' = local cart has changes not yet saved
  var OWNER_WISH = 'wimp_wishlist_owner';
  var PUSH_DELAY = 700;                 // ms to wait before saving after a change
  var REFRESH_EVERY = 30000;            // ms, min gap between focus-triggered pulls
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var svc = null;            // supabaseService
  var uid = null;            // signed-in user id (null = guest)
  var applying = false;      // true while we write a pulled cart into local state
  var pushTimer = null;
  var syncing = null;        // in-flight sync promise (prevents overlap)
  var lastSyncAt = 0;
  var origSetCart = null;

  function log() { try { console.warn.apply(console, ['[account-sync]'].concat([].slice.call(arguments))); } catch (e) { /* ignore */ } }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ---------- cart helpers ----------
  function cleanItems(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (i) {
      if (!i || i.id == null || i.id === '') return;
      var q = Math.max(1, Math.floor(Number(i.quantity) || 1));
      var copy = {};
      Object.keys(i).forEach(function (k) { copy[k] = i[k]; });
      copy.quantity = q;
      out.push(copy);
    });
    return out;
  }
  function readLocalCart() {
    try { return cleanItems(JSON.parse(lsGet('wimp_cart')) || []); } catch (e) { return []; }
  }
  function sameCart(a, b) {
    if (a.length !== b.length) return false;
    var m = {};
    a.forEach(function (i) { m[String(i.id)] = Number(i.quantity); });
    return b.every(function (i) { return m[String(i.id)] === Number(i.quantity); });
  }
  // Same product in both carts -> keep the larger quantity (so re-merging never inflates it).
  function mergeCarts(server, local) {
    var byId = {}, order = [];
    server.concat(local).forEach(function (i) {
      var k = String(i.id);
      if (!byId[k]) { byId[k] = i; order.push(k); }
      else if (Number(i.quantity) > Number(byId[k].quantity)) { byId[k].quantity = i.quantity; }
    });
    return order.map(function (k) { return byId[k]; });
  }

  function refreshUi() {
    try { if (typeof updateCartBadge === 'function') updateCartBadge(); } catch (e) { /* ignore */ }
    try { if (typeof updateWishlistBadge === 'function') updateWishlistBadge(); } catch (e) { /* ignore */ }
    try { if (typeof window.renderCartItems === 'function') window.renderCartItems(); } catch (e) { /* ignore */ }
    try { if (typeof window.updateOrderSummary === 'function') window.updateOrderSummary(); } catch (e) { /* ignore */ }
    try { if (typeof window.renderWatchlist === 'function') window.renderWatchlist(); } catch (e) { /* ignore */ }
    try { window.dispatchEvent(new Event('wimp:cart-state-changed')); } catch (e) { /* ignore */ }
  }

  function applyLocalCart(items) {
    applying = true;
    try {
      AppState.cart = items;
      (origSetCart || Storage.setCart).call(Storage, items);
    } finally { applying = false; }
  }
  function applyLocalWishlist(ids) {
    AppState.wishlist = ids;
    Storage.setWishlist(ids);
  }

  // ---------- server calls ----------
  async function client() { return svc.getClient(); }

  async function pullCart() {
    var sb = await client();
    var r = await sb.from('user_carts').select('items').eq('user_id', uid).maybeSingle();
    if (r.error) throw r.error;
    return r.data ? cleanItems(r.data.items) : null; // null = account has no saved cart yet
  }
  async function pushCart(items) {
    var sb = await client();
    var r = await sb.from('user_carts').upsert(
      { user_id: uid, items: items, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    if (r.error) throw r.error;
  }
  async function pullWishlist() {
    var sb = await client();
    var r = await sb.from('wishlist').select('product_id').eq('user_id', uid);
    if (r.error) throw r.error;
    return (r.data || []).map(function (row) { return String(row.product_id); });
  }
  async function pushWishlistIds(ids) {
    if (!ids.length) return;
    var sb = await client();
    var rows = ids.map(function (id) { return { user_id: uid, product_id: id }; });
    var r = await sb.from('wishlist').upsert(rows, { onConflict: 'user_id,product_id', ignoreDuplicates: true });
    if (!r.error) return;
    // One bad id (e.g. a product that no longer exists) fails the whole batch, so retry one by one.
    for (var i = 0; i < rows.length; i++) {
      try { await sb.from('wishlist').upsert(rows[i], { onConflict: 'user_id,product_id', ignoreDuplicates: true }); } catch (e) { /* skip */ }
    }
  }

  // ---------- cart sync ----------
  async function syncCart() {
    var local = readLocalCart();
    var owner = lsGet(OWNER_CART);
    var dirty = lsGet(DIRTY_CART) === '1';
    var server = await pullCart();
    var result;

    if (owner === uid) {
      // This device was already tied to this account: the account copy is the truth,
      // unless we have changes that never got saved (e.g. we were offline).
      result = dirty ? local : (server || []);
    } else if (owner) {
      // Leftover cart from a different account: don't leak it into this one.
      result = server || [];
    } else {
      // No owner = guest cart from before login: merge it into the account cart.
      result = mergeCarts(server || [], local);
    }

    if (!sameCart(result, local)) applyLocalCart(result);
    if (server === null ? result.length > 0 : !sameCart(result, server)) await pushCart(result);

    lsSet(OWNER_CART, uid);
    lsDel(DIRTY_CART);
    if (!sameCart(result, local)) refreshUi();
  }

  function onLocalCartChange() {
    if (applying || !uid) return; // guests and our own writes are ignored
    lsSet(DIRTY_CART, '1');
    clearTimeout(pushTimer);
    var who = uid;
    pushTimer = setTimeout(function () { flushCart(who); }, PUSH_DELAY);
  }
  async function flushCart(who) {
    clearTimeout(pushTimer);
    pushTimer = null;
    if (!uid || (who && who !== uid) || lsGet(DIRTY_CART) !== '1') return;
    try {
      await pushCart(readLocalCart());
      lsSet(OWNER_CART, uid);
      lsDel(DIRTY_CART);
    } catch (e) {
      log('Saving cart to account failed; will retry on the next page load.', e && e.message);
    }
  }

  // ---------- wishlist sync ----------
  async function syncWishlist() {
    var localRaw;
    try { localRaw = (JSON.parse(lsGet('wimp_wishlist')) || []).map(String); } catch (e) { localRaw = []; }
    var owner = lsGet(OWNER_WISH);
    var server = await pullWishlist();
    var result;

    if (owner) {
      // Already tied to an account (this one or another): the account copy wins.
      result = server;
    } else {
      // Guest wishlist from before login: add anything the account doesn't have yet.
      var have = {};
      server.forEach(function (id) { have[id] = true; });
      var extra = localRaw.filter(function (id) { return !have[id] && UUID_RE.test(id); });
      if (extra.length) await pushWishlistIds(extra);
      result = server.concat(extra.filter(function (id, i, a) { return a.indexOf(id) === i; }));
    }

    var changed = result.length !== localRaw.length || result.some(function (id) { return localRaw.indexOf(id) === -1; });
    if (changed) applyLocalWishlist(result);
    lsSet(OWNER_WISH, uid);
    if (changed) refreshUi();
  }

  // The site's own wishlist code calls addToWishlist(user.id, productId) but the service method
  // only takes (productId), so nothing ever saved. Accept both call styles.
  function patchWishlistMethods() {
    if (svc.__wishPatched) return;
    svc.__wishPatched = true;
    var add = svc.addToWishlist, rem = svc.removeFromWishlist;
    svc.addToWishlist = function () { return add.call(svc, arguments[arguments.length - 1]); };
    svc.removeFromWishlist = function () { return rem.call(svc, arguments[arguments.length - 1]); };
  }

  // ---------- orchestration ----------
  function syncAll(force) {
    if (!uid) return Promise.resolve();
    if (syncing) return syncing;
    if (!force && Date.now() - lastSyncAt < REFRESH_EVERY) return Promise.resolve();
    syncing = (async function () {
      try { await syncCart(); } catch (e) { log('Cart sync failed (is the SQL migration applied?)', e && e.message); }
      try { await syncWishlist(); } catch (e) { log('Wishlist sync failed (is the SQL migration applied?)', e && e.message); }
      lastSyncAt = Date.now();
    })().then(function () { syncing = null; }, function () { syncing = null; });
    return syncing;
  }

  function hookStorage() {
    if (origSetCart) return;
    origSetCart = Storage.setCart;
    Storage.setCart = function (cart) {
      origSetCart.call(Storage, cart);
      onLocalCartChange();
    };
  }

  function hookSignOut() {
    if (svc.__signOutPatched) return;
    svc.__signOutPatched = true;
    var orig = svc.signOut;
    svc.signOut = async function () {
      try { await flushCart(uid); } catch (e) { /* ignore */ }   // save any pending change first
      var res = await orig.apply(svc, arguments);
      uid = null;
      lsDel(OWNER_CART); lsDel(DIRTY_CART); lsDel(OWNER_WISH);
      return res;
    };
  }

  async function start() {
    // main.js / supabase.js are plain scripts; wait until they and the app bootstrap are ready.
    var tries = 0;
    while (tries < 400 && !(typeof AppState !== 'undefined' && typeof Storage !== 'undefined' &&
      typeof Storage.setCart === 'function' && typeof supabaseService !== 'undefined' && window._appReady)) {
      await sleep(25); tries++;
    }
    if (typeof AppState === 'undefined' || typeof Storage === 'undefined' ||
        typeof Storage.setCart !== 'function' || typeof supabaseService === 'undefined') return; // page without the shop scripts
    svc = supabaseService;

    try { await window._appReady; } catch (e) { /* ignore */ }
    try { if (window._supabaseReady) await window._supabaseReady; } catch (e) { /* ignore */ }
    if (!svc.isInitialized) return; // no Supabase credentials -> stay localStorage-only

    hookStorage();
    hookSignOut();
    patchWishlistMethods();

    try {
      var session = await svc.getSession();
      uid = session && session.user ? session.user.id : null;
    } catch (e) { uid = null; }

    try {
      var sb = await client();
      if (sb.auth && sb.auth.onAuthStateChange) {
        sb.auth.onAuthStateChange(function (event, session) {
          var next = session && session.user ? session.user.id : null;
          if (event === 'SIGNED_OUT' || !next) {
            uid = null;
            lsDel(OWNER_CART); lsDel(DIRTY_CART); lsDel(OWNER_WISH);
            return;
          }
          if (next !== uid) {
            uid = next;
            // Defer: never call back into supabase-js from inside its own auth callback.
            setTimeout(function () { syncAll(true); }, 0);
          }
        });
      }
    } catch (e) { /* ignore */ }

    if (uid) await syncAll(true);

    // Pick up changes made on another device when the tab comes back into view.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) syncAll(false);
    });
    window.addEventListener('focus', function () { syncAll(false); });
    // Best effort: try to save a pending change when the page is being closed.
    window.addEventListener('pagehide', function () { if (uid && lsGet(DIRTY_CART) === '1') flushCart(uid); });
  }

  start().catch(function (e) { log('Account sync did not start', e && e.message); });
})();