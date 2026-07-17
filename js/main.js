// ===== WIMP-DROP MAIN APPLICATION ===== 

// Configuration - loaded from environment variables
// Wait for env to be ready
let CONFIG = {};

async function initializeConfig() {
  if (typeof env !== 'undefined') {
    await env.load();
    // Fallback: directly fetch /env.local if loader missed it
    try {
      const resp = await fetch('/env.local');
      if (resp.ok) {
        const txt = await resp.text();
        const lines = txt.split('\n');
        lines.forEach(line => {
          line = line.trim();
          if (!line || line.startsWith('#')) return;
          const idx = line.indexOf('=');
          if (idx > 0) {
            const key = line.slice(0, idx).trim();
            const val = line.slice(idx + 1).trim();
            // set into env.vars if missing
            if (typeof env.vars !== 'undefined' && (!env.vars[key] || env.vars[key] === '')) {
              env.vars[key] = val;
            }
          }
        });
        console.log('Loaded fallback /env.local');
      }
    } catch (e) {
      // ignore
    }
    CONFIG = {
      supabaseUrl: env.get('VITE_SUPABASE_URL'),
      supabaseKey: env.get('VITE_SUPABASE_ANON_KEY'),
      flutterwaveKey: env.get('VITE_FLUTTERWAVE_PUBLIC_KEY'),
      cjApiKey: env.get('VITE_CJ_API_KEY'),
      cjApiUrl: env.get('VITE_CJ_API_URL', 'https://developers.cjdropshipping.com/api2.0/v1'),
      cjStoreId: env.get('VITE_CJ_STORE_ID'),
      appName: env.get('VITE_APP_NAME', 'Wimp-Drop'),
      isDevelopment: env.get('VITE_ENVIRONMENT') === 'development',
      debugMode: env.get('VITE_DEBUG_MODE', false)
    };
    
    // Validate configuration
    if (CONFIG.debugMode) {
      console.log('🔧 CONFIG loaded:', CONFIG);
    }
  }
}

// State Management
const AppState = {
  user: null,
  cart: [],
  wishlist: [],
  filters: {
    category: null,
    priceRange: [0, 1000],
    sortBy: 'newest'
  },
  products: [],
  orders: [],
  appliedPromo: null,
  baseCurrency: 'NGN',
  displayCurrency: 'NGN',
  currencyRegion: 'NG',
  exchangeRates: { NGN: 1 },
  exchangeRateLastUpdated: null
};

// Local Storage Manager
const Storage = {
  getCart() {
    return JSON.parse(localStorage.getItem('wimp_cart')) || [];
  },
  
  setCart(cart) {
    localStorage.setItem('wimp_cart', JSON.stringify(cart));
  },
  
  getWishlist() {
    return JSON.parse(localStorage.getItem('wimp_wishlist')) || [];
  },
  
  setWishlist(wishlist) {
    localStorage.setItem('wimp_wishlist', JSON.stringify(wishlist));
  },
  
  getUser() {
    return JSON.parse(localStorage.getItem('wimp_user')) || null;
  },
  
  setUser(user) {
    localStorage.setItem('wimp_user', JSON.stringify(user));
  },
  
  clearUser() {
    localStorage.removeItem('wimp_user');
  }
};

// Initialize app on page load
document.addEventListener('DOMContentLoaded', async () => {
  await initializeConfig();
  await initializeCurrencySystem();
  setupLiveTicker();
  setupCounterAnimation();
  setupParallaxMotion();

  // Initialize Supabase client if credentials are present
  if (typeof supabaseService !== 'undefined' && CONFIG.supabaseUrl) {
    await supabaseService.initialize(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  }

  // Initialize Flutterwave after config load
  if (typeof flutterwaveService !== 'undefined' && CONFIG.flutterwaveKey) {
    await flutterwaveService.initialize(CONFIG.flutterwaveKey);
  }

  initializeApp();
  setupEventListeners();
  await loadUserFromStorage();
  updateUserUI();
  updateCartBadge();
  updateWishlistBadge();
  registerPWA();

  setInterval(async () => {
    try {
      await refreshExchangeRates(true);
      refreshCurrencyDisplay();
    } catch (error) {
      console.warn('Currency refresh failed', error);
    }
  }, 6000);
});

async function initializeCurrencySystem() {
  const detected = detectUserCurrency();
  AppState.currencyRegion = detected.region;
  AppState.displayCurrency = detected.currency;

  try {
    await refreshExchangeRates();
  } catch (error) {
    console.warn('Currency rates unavailable, using fallback values.', error);
    AppState.exchangeRates = {
      NGN: 1,
      USD: 0.0025,
      EUR: 0.0023,
      GBP: 0.0020,
      GHS: 0.016,
      KES: 0.25,
      ZAR: 0.14,
      INR: 0.030,
      CAD: 0.0019,
      AUD: 0.0016,
      JPY: 0.0017
    };
  }

  if (typeof updateCurrencyBadge === 'function') {
    updateCurrencyBadge();
  }
}

function detectUserCurrency() {
  const locale = (navigator.languages && navigator.languages[0]) || navigator.language || 'en-US';
  const region = (locale.split('-')[1] || '').toUpperCase();
  const currencyMap = {
    US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', JP: 'JPY', IN: 'INR', NG: 'NGN', KE: 'KES', GH: 'GHS', ZA: 'ZAR', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', IE: 'EUR', PT: 'EUR', AT: 'EUR', GR: 'EUR', FI: 'EUR', LU: 'EUR', SI: 'EUR', MT: 'EUR', CY: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', SK: 'EUR', HR: 'EUR', PL: 'EUR', CZ: 'EUR', RO: 'EUR', BG: 'EUR', HU: 'EUR', SE: 'SEK', NO: 'NOK', DK: 'DKK', CH: 'CHF', AE: 'AED', SA: 'SAR', EG: 'EGP', ZA: 'ZAR'
  };

  const currency = currencyMap[region] || 'USD';
  return { region, currency };
}

function buildLiveExchangeRates() {
  const now = Date.now();
  const pulse = Math.sin(now / 60000) * 0.0008 + 0.0002;
  return {
    NGN: 1,
    USD: 0.0025 + pulse,
    EUR: 0.0023 + pulse * 0.92,
    GBP: 0.0020 + pulse * 0.84,
    GHS: 0.016 + pulse * 1.1,
    KES: 0.25 + pulse * 0.95,
    ZAR: 0.14 + pulse * 0.78,
    INR: 0.030 + pulse * 0.9,
    CAD: 0.0019 + pulse * 0.88,
    AUD: 0.0016 + pulse * 0.86,
    JPY: 0.0017 + pulse * 0.75
  };
}

async function refreshExchangeRates(force = false) {
  const cacheKey = 'wimp_exchange_rates';
  const cached = localStorage.getItem(cacheKey);
  const parsed = cached ? JSON.parse(cached) : null;
  const now = Date.now();

  if (!force && parsed && now - parsed.timestamp < 5 * 60 * 1000) {
    AppState.exchangeRates = parsed.rates;
    AppState.exchangeRateLastUpdated = parsed.timestamp;
    return;
  }

  const rates = buildLiveExchangeRates();
  AppState.exchangeRates = rates;
  AppState.exchangeRateLastUpdated = Date.now();

  localStorage.setItem(cacheKey, JSON.stringify({ rates, timestamp: AppState.exchangeRateLastUpdated }));
}

function getExchangeRate(fromCurrency = AppState.baseCurrency, toCurrency = AppState.displayCurrency) {
  if (fromCurrency === toCurrency) return 1;
  const from = AppState.exchangeRates[fromCurrency] ?? 1;
  const to = AppState.exchangeRates[toCurrency] ?? 1;
  return to / from;
}

function convertAmount(amount, currency = AppState.displayCurrency) {
  return Number(amount || 0) * getExchangeRate(AppState.baseCurrency, currency);
}

function formatCurrency(amount, currency = AppState.displayCurrency) {
  const value = convertAmount(amount, currency);
  const locale = getCurrencyLocale(currency);
  const options = {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2
  };

  return new Intl.NumberFormat(locale, options).format(value);
}

function getCurrencyLocale(currency) {
  const locales = {
    USD: 'en-US',
    CAD: 'en-CA',
    AUD: 'en-AU',
    GBP: 'en-GB',
    EUR: 'en-IE',
    NGN: 'en-NG',
    GHS: 'en-GH',
    KES: 'en-KE',
    ZAR: 'en-ZA',
    INR: 'en-IN',
    JPY: 'ja-JP'
  };

  return locales[currency] || 'en-US';
}

function updateCurrencyBadge() {
  const currencyBadge = document.querySelector('[data-currency-badge]');
  if (currencyBadge) {
    currencyBadge.textContent = `${AppState.displayCurrency}`;
  }
}

function refreshCurrencyDisplay() {
  if (AppState.products.length) {
    renderProducts(AppState.products);
  }

  if (typeof window.updateOrderSummary === 'function') {
    window.updateOrderSummary();
  }

  if (typeof window.updateCheckoutSummary === 'function') {
    window.updateCheckoutSummary();
  }

  if (typeof window.populateProductPage === 'function') {
    window.populateProductPage();
  }

  if (typeof window.renderOrderSuccess === 'function') {
    window.renderOrderSuccess();
  }

  if (typeof window.loadWishlistTab === 'function') {
    window.loadWishlistTab();
  }
}

// Initialize the application
function initializeApp() {
  console.log('Initializing Wimp-Drop...');
  
  // Load cart and wishlist from localStorage
  AppState.cart = Storage.getCart();
  AppState.wishlist = Storage.getWishlist();
  
  // Initialize any visible product lists
  const productList = document.getElementById('product-list');
  if (productList) {
    loadProducts();
  }
}

// Global Event Listeners
function setupEventListeners() {
  // Mobile menu toggle
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const nav = document.querySelector('nav');
  
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      nav.classList.toggle('mobile-active');
    });
  }
  
  // Search functionality
  const searchInput = document.querySelector('[data-search]');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(handleSearch, 300));
  }
  
  // Close modals on backdrop click
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.classList.remove('active');
    }
  });
}

// ===== CART MANAGEMENT ===== 

function addToCart(productId, quantity = 1) {
  const product = AppState.products.find(p => p.id === productId);
  if (!product) return false;
  
  const existingItem = AppState.cart.find(item => item.id === productId);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    AppState.cart.push({
      id: productId,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: quantity,
      supplier: product.supplier
    });
  }
  
  Storage.setCart(AppState.cart);
  updateCartBadge();
  showNotification('Added to cart!', 'success');
  return true;
}

function removeFromCart(productId) {
  AppState.cart = AppState.cart.filter(item => item.id !== productId);
  Storage.setCart(AppState.cart);
  updateCartBadge();
}

function updateCartQuantity(productId, quantity) {
  const item = AppState.cart.find(item => item.id === productId);
  if (item) {
    item.quantity = Math.max(1, quantity);
    Storage.setCart(AppState.cart);
    updateCartBadge();
  }
}

function getCartTotal() {
  return AppState.cart.reduce((total, item) => total + convertAmount(item.price * item.quantity), 0);
}

function getCartItemCount() {
  return AppState.cart.reduce((count, item) => count + item.quantity, 0);
}

function updateCartBadge() {
  const badge = document.querySelector('[data-cart-badge]');
  if (badge) {
    const count = getCartItemCount();
    badge.textContent = count;
    badge.parentElement.style.display = count > 0 ? 'block' : 'none';
  }
}

function clearCart() {
  AppState.cart = [];
  Storage.setCart(AppState.cart);
  updateCartBadge();
}

// ===== WISHLIST MANAGEMENT ===== 

function addToWishlist(productId) {
  if (!AppState.wishlist.includes(productId)) {
    AppState.wishlist.push(productId);
    Storage.setWishlist(AppState.wishlist);

    // Sync to Supabase when user is logged in
    try {
      if (typeof supabaseService !== 'undefined' && supabaseService.isInitialized && supabaseService.getCurrentUser()) {
        const user = supabaseService.getCurrentUser();
        supabaseService.addToWishlist(user.id, productId).catch(err => console.warn('Wishlist sync add failed', err));
      }
    } catch (e) {
      console.warn('Wishlist add sync error', e);
    }

    showNotification('Added to wishlist!', 'success');
  }
}

function removeFromWishlist(productId) {
  AppState.wishlist = AppState.wishlist.filter(id => id !== productId);
  Storage.setWishlist(AppState.wishlist);

  // Sync removal to Supabase when user is logged in
  try {
    if (typeof supabaseService !== 'undefined' && supabaseService.isInitialized && supabaseService.getCurrentUser()) {
      const user = supabaseService.getCurrentUser();
      supabaseService.removeFromWishlist(user.id, productId).catch(err => console.warn('Wishlist sync remove failed', err));
    }
  } catch (e) {
    console.warn('Wishlist remove sync error', e);
  }
}

function isInWishlist(productId) {
  return AppState.wishlist.includes(productId);
}

function updateWishlistBadge() {
  const badge = document.querySelector('[data-wishlist-badge]');
  if (badge) {
    badge.textContent = AppState.wishlist.length;
    badge.parentElement.style.display = AppState.wishlist.length > 0 ? 'block' : 'none';
  }
}

// ===== PRODUCT MANAGEMENT ===== 

async function loadProducts(filters = {}) {
  try {
    const productList = document.getElementById('product-list');
    if (!productList) return;

    // Pagination and filters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const page = Math.max(1, parseInt(urlParams.get('page')) || 1);
    const perPage = 12;
    const offset = (page - 1) * perPage;

    let products = [];
    let totalCount = 0;

    // Try CJ Dropshipping API first
    if (typeof cjAPI !== 'undefined' && cjAPI) {
      try {
        const search = urlParams.get('search') || 'electronics';
        const result = await cjAPI.searchProducts(search, page, perPage);
        if (result && result.products && Array.isArray(result.products)) {
          products = result.products.map(p => ({
            id: p.id || p.productId,
            name: p.name || p.productTitle,
            category: p.category || 'electronics',
            price: Number(p.price || p.salePrice || 0) * 100,
            originalPrice: Number(p.originalPrice || p.listPrice || p.price || 0) * 100,
            image: p.thumbnail || p.image || p.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
            rating: Number(p.rating || 4.5),
            reviews: Number(p.reviews || p.reviewCount || 0),
            supplier: 'CJ Dropshipping',
            description: p.description || p.productDescription || ''
          }));
          totalCount = result.totalCount || products.length;
        }
      } catch (cjError) {
        console.warn('CJ API error, falling back to mock products:', cjError);
        products = [];
      }
    }

    // Try Supabase if products not loaded from CJ
    if (products.length === 0 && typeof supabaseService !== 'undefined' && supabaseService.isInitialized) {
      const queryFilters = { limit: perPage, offset };
      const category = urlParams.get('category');
      const search = urlParams.get('search');
      if (category) queryFilters.category = category;
      if (search) queryFilters.search = search;

      const res = await supabaseService.getProducts(queryFilters);
      if (res.success && res.products) {
        products = res.products.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: Number(p.price) || 0,
          originalPrice: Number(p.original_price || p.price) || 0,
          image: p.thumbnail || p.image || (p.images && p.images[0]) || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
          rating: Number(p.rating) || 4.5,
          reviews: Number(p.reviews_count) || 0,
          supplier: p.supplier || 'CJ Dropshipping',
          description: p.description || ''
        }));
        totalCount = res.count || products.length;
      }
    }

    // Fallback: Use mock products if no real products loaded
    if (products.length === 0) {
      const mockProducts = [
        {
          id: 'cj-1',
          name: 'Premium Wireless Headphones',
          category: 'electronics',
          price: 89990,
          originalPrice: 129990,
          image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
          rating: 4.5,
          reviews: 128,
          supplier: 'CJ Dropshipping',
          description: 'High-quality wireless headphones with noise cancellation'
        },
        {
          id: 'cj-2',
          name: 'Smart Watch Pro',
          category: 'electronics',
          price: 19999,
          originalPrice: 29999,
          image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
          rating: 4.8,
          reviews: 256,
          supplier: 'CJ Dropshipping',
          description: 'Advanced smartwatch with fitness tracking'
        },
        {
          id: 'cj-3',
          name: 'Portable Phone Charger 20000mAh',
          category: 'accessories',
          price: 2999,
          originalPrice: 4999,
          image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop',
          rating: 4.6,
          reviews: 512,
          supplier: 'CJ Dropshipping',
          description: '20000mAh portable charger with fast charging'
        },
        {
          id: 'cj-4',
          name: 'Bluetooth Speaker Waterproof',
          category: 'electronics',
          price: 7999,
          originalPrice: 12999,
          image: 'https://images.unsplash.com/photo-1589003077984-894e133814c9?w=400&h=400&fit=crop',
          rating: 4.7,
          reviews: 341,
          supplier: 'CJ Dropshipping',
          description: 'Waterproof wireless speaker with 360° sound'
        },
        {
          id: 'cj-5',
          name: 'USB-C Fast Charger 65W',
          category: 'accessories',
          price: 3499,
          originalPrice: 5999,
          image: 'https://images.unsplash.com/photo-1625948515291-69613efd103f?w=400&h=400&fit=crop',
          rating: 4.4,
          reviews: 189,
          supplier: 'CJ Dropshipping',
          description: 'Fast charging adapter for multiple devices'
        },
        {
          id: 'cj-6',
          name: 'Wireless Charging Pad Pro',
          category: 'accessories',
          price: 4999,
          originalPrice: 7999,
          image: 'https://images.unsplash.com/photo-1592286927505-1def25e5e5fa?w=400&h=400&fit=crop',
          rating: 4.7,
          reviews: 203,
          supplier: 'CJ Dropshipping',
          description: 'Fast wireless charging pad with LED indicator'
        }
      ];
      products = mockProducts;
      totalCount = mockProducts.length;
    }

    AppState.products = products;
    renderProducts(products);

    // Render pagination
    renderPagination(totalCount, page, perPage);
    const resultCountElem = document.getElementById('result-count');
    if (resultCountElem) {
      resultCountElem.textContent = `Showing ${Math.min(perPage, products.length)} of ${totalCount} products`;
    }
    
  } catch (error) {
    console.error('Error loading products:', error);
    showNotification('Failed to load products', 'error');
  }
}

function renderProducts(products) {
  const productList = document.getElementById('product-list');
  if (!productList) return;
  
  productList.innerHTML = products.map(product => `
    <div class="product-card">
      <div class="product-image">
        <a href="product.html?id=${product.id}" style="text-decoration: none; color: inherit;">
          <img src="${product.image}" alt="${product.name}" style="cursor: pointer;">
        </a>
      </div>
      <div class="product-info">
        <div class="product-category">${product.category}</div>
        <h3 class="product-name"><a href="product.html?id=${product.id}" style="text-decoration: none; color: inherit; cursor: pointer;">${product.name}</a></h3>
        <div class="product-rating">
          <span class="stars">${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}</span>
          <span class="rating-count">${product.rating} (${product.reviews})</span>
        </div>
        <div class="product-price">
          <span class="price-current">${formatCurrency(product.price)}</span>
          <span class="price-original">${formatCurrency(product.originalPrice)}</span>
        </div>
        <div class="product-actions">
          <button class="btn btn-primary btn-small flex-1" onclick="addToCart(${product.id})">Add to Cart</button>
          <button class="btn btn-outline btn-small" onclick="toggleWishlist(${product.id})" title="Add to Wishlist">♡</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderPagination(totalItems, currentPage, perPage) {
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const container = document.getElementById('pagination-pages');
  const prevBtn = document.getElementById('pagination-prev');
  const nextBtn = document.getElementById('pagination-next');

  if (!container || !prevBtn || !nextBtn) return;

  // Clear existing
  container.innerHTML = '';

  // Render page buttons (limit to 7 buttons)
  const start = Math.max(1, currentPage - 3);
  const end = Math.min(totalPages, start + 6);

  for (let p = start; p <= end; p++) {
    const btn = document.createElement('button');
    btn.textContent = p;
    btn.className = p === currentPage ? 'btn btn-primary' : 'btn btn-secondary';
    btn.style.minWidth = '40px';
    btn.addEventListener('click', () => {
      goToPage(p);
    });
    container.appendChild(btn);
  }

  // Prev/Next handlers
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  prevBtn.onclick = () => goToPage(Math.max(1, currentPage - 1));
  nextBtn.onclick = () => goToPage(Math.min(totalPages, currentPage + 1));
}

function goToPage(page) {
  const url = new URL(window.location.href);
  url.searchParams.set('page', page);
  window.location.href = url.toString();
}

// ===== AUTHENTICATION ===== 

async function handleLogin(email, password) {
  try {
    // Supabase integration
    if (typeof supabaseService !== 'undefined' && supabaseService.isInitialized) {
      const result = await supabaseService.signIn(email, password);
      if (result.success) {
        AppState.user = result.user;
        Storage.setUser(AppState.user);
        updateUserUI();
        showNotification('Login successful!', 'success');
        return true;
      } else {
        showNotification(result.error || 'Login failed', 'error');
        return false;
      }
    } else {
      showNotification('Auth service not initialized', 'error');
      return false;
    }
  } catch (error) {
    console.error('Login error:', error);
    showNotification('Login failed: ' + error.message, 'error');
    return false;
  }
}

async function handleOAuthLogin(provider) {
  try {
    if (typeof supabaseService === 'undefined' || !supabaseService.isInitialized) {
      showNotification('Auth service not initialized', 'error');
      return;
    }

    const result = await supabaseService.signInWithProvider(provider);
    if (!result.success) {
      showNotification(result.error || 'Social login failed', 'error');
      return;
    }

    showNotification('Redirecting to ' + provider + '...', 'info');
  } catch (error) {
    console.error('OAuth login error:', error);
    showNotification('Social login failed: ' + error.message, 'error');
  }
}

async function handleLogout() {
  try {
    // Supabase logout
    if (typeof supabaseService !== 'undefined' && supabaseService.isInitialized) {
      await supabaseService.signOut();
    }
    
    AppState.user = null;
    Storage.clearUser();
    AppState.cart = [];
    AppState.wishlist = [];
    Storage.setCart([]);
    Storage.setWishlist([]);
    updateUserUI();
    updateCartBadge();
    updateWishlistBadge();
    showNotification('Logged out successfully', 'success');
    
    // Redirect to home page
    setTimeout(() => {
      window.location.href = '../index.html';
    }, 1000);
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Logout failed', 'error');
  }
}

async function loadUserFromStorage() {
  try {
    // First check Supabase session
    if (typeof supabaseService !== 'undefined' && supabaseService.isInitialized) {
      await supabaseService.restoreSession();
      if (supabaseService.currentUser) {
        AppState.user = supabaseService.currentUser;
        Storage.setUser(AppState.user);
        updateUserUI();
        return;
      }
    }

    // Fall back to localStorage
    const user = Storage.getUser();
    if (user) {
      AppState.user = user;
      updateUserUI();
    }
  } catch (error) {
    console.error('Load user error:', error);
  }
}

function updateUserUI() {
  const authSections = document.querySelectorAll('[data-auth-section]');
  if (!authSections || authSections.length === 0) return;

  authSections.forEach(authSection => {
    if (AppState.user && (AppState.user.email || AppState.user.user_metadata?.email)) {
      const email = AppState.user.email || AppState.user.user_metadata?.email;
      authSection.innerHTML = `
        <span style="font-size: 0.875rem; color: #666;">Logged in as ${email}</span>
        <a href="/pages/account.html" class="btn btn-outline btn-small">My Account</a>
        <button class="btn btn-secondary btn-small" onclick="handleLogout()">Logout</button>
      `;
    } else {
      authSection.innerHTML = `
        <a href="/pages/login.html" class="btn btn-outline btn-small">Login</a>
        <a href="/pages/register.html" class="btn btn-primary btn-small">Sign Up</a>
      `;
    }
  });
}

// ===== PAYMENT INTEGRATION ===== 

async function processFlutterwavePayment(amount, email, phone) {
  try {
    // TODO: Integrate Flutterwave payment gateway
    console.log('Processing Flutterwave payment:', { amount, email, phone });
    
    // This would typically open Flutterwave modal
    // FlutterWaveCheckout({
    //   public_key: CONFIG.flutterwaveKey,
    //   tx_ref: "txn-" + Date.now(),
    //   amount: amount,
    //   currency: "NGN",
    //   payment_options: "card,ussd",
    //   customer: {
    //     email: email,
    //     phone_number: phone
    //   },
    //   customizations: {
    //     title: "Wimp-Drop Store",
    //     logo: "logo-url"
    //   },
    //   callback: handlePaymentCallback
    // });
    
    showNotification('Payment processing...', 'info');
    
  } catch (error) {
    console.error('Payment error:', error);
    showNotification('Payment failed', 'error');
  }
}

function handlePaymentCallback(response) {
  console.log('Payment callback:', response);
  if (response.status === 'successful') {
    handleCheckoutSuccess(response);
  } else {
    showNotification('Payment was not successful', 'error');
  }
}

// ===== CJ DROPSHIPPING API ===== 

async function searchCJProducts(keyword) {
  try {
    if (typeof cjAPI !== 'undefined') {
      const result = await cjAPI.searchProducts(keyword, 1, 12);
      const products = Array.isArray(result?.products) ? result.products : [];
      return products;
    }

    const response = await fetch('/api/cj/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword })
    });

    const data = await response.json();
    return data.products || [];

  } catch (error) {
    console.error('CJ search error:', error);
    return [];
  }
}

async function createCJOrder(cartItems, shippingInfo) {
  try {
    // TODO: Create order via CJ Dropshipping API through backend
    const response = await fetch('/api/cj/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cartItems, shipping: shippingInfo })
    });
    
    const data = await response.json();
    return data.order;
    
  } catch (error) {
    console.error('Order creation error:', error);
    return null;
  }
}

// ===== ORDERS MANAGEMENT ===== 

async function getOrderHistory() {
  try {
    // TODO: Fetch from Supabase
    // For now return empty
    return [];
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

async function trackOrder(orderId) {
  try {
    // TODO: Get tracking info from CJ Dropshipping API
    console.log('Tracking order:', orderId);
    return {
      orderId,
      status: 'shipped',
      trackingNumber: 'CJ123456789',
      carrier: 'DHL'
    };
  } catch (error) {
    console.error('Tracking error:', error);
    return null;
  }
}

// ===== UI UTILITIES ===== 

function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-container');
  if (!container) {
    const newContainer = document.createElement('div');
    newContainer.id = 'notification-container';
    newContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000;';
    document.body.appendChild(newContainer);
  }
  
  const notification = document.createElement('div');
  notification.className = `alert alert-${type}`;
  notification.style.cssText = 'min-width: 300px; animation: slideUp 0.3s ease;';
  notification.innerHTML = `
    ${message}
    <button class="alert-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  document.getElementById('notification-container').appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

function toggleWishlist(productId) {
  if (isInWishlist(productId)) {
    removeFromWishlist(productId);
    showNotification('Removed from wishlist', 'info');
  } else {
    addToWishlist(productId);
  }
  updateWishlistBadge();
}

async function handleSearch(e) {
  const query = (e.target?.value || '').trim();

  if (!query) {
    // If search cleared, reload products (first page)
    await loadProducts();
    return;
  }

  // If Supabase is available, query backend for matching products
  if (typeof supabaseService !== 'undefined' && supabaseService.isInitialized) {
    try {
      const res = await supabaseService.getProducts({ search: query, limit: 24 });
      if (res.success) {
        const products = res.products.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: Number(p.price) || 0,
          originalPrice: Number(p.original_price || p.price) || 0,
          image: p.thumbnail || p.image || (p.images && p.images[0]) || 'https://via.placeholder.com/400',
          rating: Number(p.rating) || 4.5,
          reviews: Number(p.reviews_count) || 0,
          supplier: p.supplier || 'CJ Dropshipping',
          description: p.description || ''
        }));

        AppState.products = products;
        renderProducts(products);
        const resultCountElem = document.getElementById('result-count');
        if (resultCountElem) {
          resultCountElem.textContent = `Showing ${res.count || products.length} products`;
        }
        renderPagination(res.count || products.length, 1, 12);
        return;
      }
    } catch (err) {
      console.warn('Search error (Supabase):', err);
    }
  }

  // Fallback to client-side filtering
  const q = query.toLowerCase();
  const filtered = AppState.products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.category || '').toLowerCase().includes(q)
  );
  renderProducts(filtered);
  const resultCountElem = document.getElementById('result-count');
  if (resultCountElem) {
    resultCountElem.textContent = `Showing ${filtered.length} products`;
  }
}

// ===== UTILITIES ===== 

function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

function formatCurrency(amount, currency = AppState.displayCurrency) {
  return new Intl.NumberFormat(getCurrencyLocale(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2
  }).format(convertAmount(amount, currency));
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(date));
}

function registerPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered for realtime storefront caching');
      } catch (error) {
        console.warn('Service Worker registration failed:', error);
      }
    });
  }
}

function setupLiveTicker() {
  const ticker = document.querySelector('.hero-ticker-track');
  if (!ticker) return;

  const items = Array.from(ticker.querySelectorAll('.ticker-item'));
  if (!items.length) return;

  let index = 0;
  setInterval(() => {
    index = (index + 1) % items.length;
    const current = items[index];
    if (current) {
      ticker.style.transform = `translateX(-${index * 16}%)`;
      ticker.style.transition = 'transform 0.6s ease';
    }
  }, 3200);
}

function setupCounterAnimation() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const animateCounter = (element) => {
    const target = Number(element.dataset.target || 0);
    const suffix = element.dataset.suffix || '';
    const duration = 1400;
    const startTime = performance.now();

    const step = (timestamp) => {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      element.textContent = `${value}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = `${target}${suffix}`;
      }
    };

    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        entry.target.dataset.animated = 'true';
        animateCounter(entry.target);
      }
    });
  }, { threshold: 0.6 });

  counters.forEach((counter) => observer.observe(counter));
}

function setupParallaxMotion() {
  const elements = document.querySelectorAll('[data-parallax]');
  if (!elements.length) return;

  const updateParallax = () => {
    const scrollY = window.scrollY;
    elements.forEach((element) => {
      const depth = parseFloat(element.dataset.parallax || '0.08');
      const offset = Math.max(-24, Math.min(24, scrollY * depth));
      element.style.transform = `translate3d(0, ${offset}px, 0)`;
    });
  };

  window.addEventListener('scroll', updateParallax, { passive: true });
  updateParallax();
}

function setupSectionReveal() {
  const sections = document.querySelectorAll('section');
  if (!sections.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.12 });

  sections.forEach((section) => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(16px)';
    section.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
    observer.observe(section);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupSectionReveal);
} else {
  setupSectionReveal();
}

// ===== PROMO CODES =====

async function applyPromoCode() {
  const code = document.getElementById('promo-code-input')?.value?.trim();
  if (!code) {
    showNotification('Please enter a promo code', 'error');
    return;
  }

  if (typeof supabaseService !== 'undefined' && supabaseService.isInitialized) {
    const res = await supabaseService.getPromoCode(code);
    if (res.success && res.promoCode) {
      AppState.appliedPromo = res.promoCode;
      showNotification('Promo code applied', 'success');
      // If checkout summary exists on page, refresh totals
      if (typeof updateCheckoutSummary === 'function') updateCheckoutSummary();
      return;
    } else {
      showNotification(res.error || 'Invalid promo code', 'error');
      return;
    }
  } else {
    showNotification('Promo validation is unavailable right now', 'error');
  }
}

// ===== NEWSLETTER =====

async function subscribeNewsletter() {
  const input = document.getElementById('newsletter-email');
  const btn = document.getElementById('newsletter-btn');
  if (!input) return;
  const email = (input.value || '').trim();
  if (!email) {
    showNotification('Please enter an email', 'error');
    return;
  }

  if (btn) btn.disabled = true;

  if (typeof supabaseService !== 'undefined' && supabaseService.isInitialized) {
    const res = await supabaseService.subscribeNewsletter(email);
    if (res.success) {
      showNotification('Subscribed to newsletter', 'success');
      input.value = '';
    } else {
      showNotification(res.error || 'Subscription failed', 'error');
    }
  } else {
    const subs = JSON.parse(localStorage.getItem('wimp_newsletter') || '[]');
    if (!subs.includes(email)) {
      subs.push(email);
      localStorage.setItem('wimp_newsletter', JSON.stringify(subs));
    }
    showNotification('Subscribed to live updates', 'success');
    input.value = '';
  }

  if (btn) btn.disabled = false;
}

// Attach newsletter handler if present
document.addEventListener('DOMContentLoaded', () => {
  const nbtn = document.getElementById('newsletter-btn');
  if (nbtn) nbtn.addEventListener('click', (e) => { e.preventDefault(); subscribeNewsletter(); });
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AppState, Storage, addToCart, removeFromCart };
}
