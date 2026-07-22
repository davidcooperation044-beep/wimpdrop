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
  shopFilters: {
    origins: [],
    priceMax: 100000,
    sortBy: 'newest',
    search: '',
    selectedVariants: {}
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
async function initializePage() {
  await initializeConfig();
  await initializeCurrencySystem();
  setupLiveTicker();
  setupCounterAnimation();
  setupParallaxMotion();

  // Initialize Supabase client if credentials are present
  if (typeof supabaseService !== 'undefined' && CONFIG.supabaseUrl) {
    try {
      await supabaseService.initialize(CONFIG.supabaseUrl, CONFIG.supabaseKey);
    } catch (error) {
      console.warn('Supabase initialization failed:', error.message || error);
    }
  }

  // Initialize Flutterwave after config load
  if (typeof flutterwaveService !== 'undefined' && CONFIG.flutterwaveKey) {
    try {
      await flutterwaveService.initialize(CONFIG.flutterwaveKey);
    } catch (error) {
      console.warn('Flutterwave initialization failed:', error.message || error);
    }
  }

  initializeApp();
  setupEventListeners();
  await loadUserFromStorage();
  updateUserUI();
  updateCartBadge();
  updateWishlistBadge();
  registerPWA();

  // Setup realtime subscriptions (requires Supabase SDK)
  try {
    if (typeof supabaseService !== 'undefined' && supabaseService.isInitialized) {
      // Products table updates
      supabaseService.subscribe('products', async (payload) => {
        console.log('Realtime products change:', payload);
        if (typeof loadProducts === 'function') {
          await loadProducts();
        }
      });

      // Orders updates
      supabaseService.subscribe('orders', async (payload) => {
        console.log('Realtime orders change:', payload);
        if (AppState.user && typeof supabaseService.getUserOrders === 'function') {
          const res = await supabaseService.getUserOrders();
          if (res.success) {
            AppState.orders = res.orders;
            if (typeof updateOrderList === 'function') updateOrderList();
          }
        }
      });

      // User profile updates for current user
      if (AppState.user && AppState.user.id) {
        supabaseService.subscribe('user_profiles', async (payload) => {
          console.log('Realtime user profile change:', payload);
          const r = await supabaseService.getUserProfile();
          if (r.success) {
            AppState.userProfile = r.profile;
            if (typeof updateUserUI === 'function') updateUserUI();
          }
        });
      }
    }
  } catch (e) {
    console.warn('Realtime subscription setup failed', e);
  }

  setInterval(async () => {
    try {
      await refreshExchangeRates(true);
      refreshCurrencyDisplay();
    } catch (error) {
      console.warn('Currency refresh failed', error);
    }
  }, 6000);

  // Load mobile UI enhancements when appropriate
  try {
    if (window.matchMedia && window.matchMedia('(max-width:899px)').matches) {
      const s = document.createElement('script');
      s.src = '/js/mobile-ui.js';
      s.defer = true;
      document.body.appendChild(s);
    }
  } catch (e) {
    console.warn('Failed to load mobile UI enhancements', e);
  }
}

function setupEventListeners() {
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const navMenuTrigger = document.querySelector('.nav-menu-trigger');
  const navMenuButton = document.getElementById('nav-menu-button');
  const siteNavMenu = document.getElementById('site-nav-menu');
  const searchInput = document.querySelector('[data-search]');
  const searchSubmit = document.getElementById('site-search-submit');
  const searchSuggestions = document.getElementById('search-suggestions');
  const mobileSearchToggle = document.getElementById('mobile-search-toggle');
  const mobileSearchPanel = document.getElementById('mobile-search-panel');
  const mobileSearchInput = document.getElementById('mobile-site-search-input');
  const mobileSearchSubmit = document.getElementById('mobile-search-submit');
  const mobileSearchSuggestions = document.getElementById('mobile-search-suggestions');
  const mobileSearchClose = document.querySelector('.mobile-search-close');

  const updateNavOpenState = (isOpen) => {
    if (!navMenuTrigger || !siteNavMenu) return;
    navMenuTrigger.classList.toggle('open', isOpen);
    siteNavMenu.classList.toggle('open', isOpen);
    if (navMenuButton) {
      navMenuButton.setAttribute('aria-expanded', String(isOpen));
    }
  };

  if (navMenuTrigger && siteNavMenu) {
    navMenuTrigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = !navMenuTrigger.classList.contains('open');
      updateNavOpenState(isOpen);
    });
  }

  if (mobileMenuBtn && navMenuTrigger && siteNavMenu) {
    mobileMenuBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = !navMenuTrigger.classList.contains('open');
      updateNavOpenState(isOpen);
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.nav-menu-trigger') && !event.target.closest('#site-nav-menu')) {
      updateNavOpenState(false);
    }
  });

  const handleSearch = (query) => {
    if (!query) return;
    const url = new URL(window.location.href);
    url.pathname = '/pages/shop.html';
    url.searchParams.set('search', query);
    window.location.href = url.toString();
  };

  if (searchSubmit && searchInput) {
    searchSubmit.addEventListener('click', () => handleSearch(searchInput.value.trim()));
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        handleSearch(searchInput.value.trim());
      }
    });
  }

  if (mobileSearchToggle && mobileSearchPanel && mobileSearchInput && mobileSearchSubmit) {
    mobileSearchToggle.addEventListener('click', () => {
      mobileSearchPanel.classList.add('active');
      mobileSearchPanel.setAttribute('aria-hidden', 'false');
      mobileSearchInput.focus();
    });

    mobileSearchClose.addEventListener('click', () => {
      mobileSearchPanel.classList.remove('active');
      mobileSearchPanel.setAttribute('aria-hidden', 'true');
    });

    mobileSearchSubmit.addEventListener('click', () => {
      handleSearch(mobileSearchInput.value.trim());
    });

    mobileSearchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        handleSearch(mobileSearchInput.value.trim());
      }
    });
  }

  // Mark active navigation links
  const currentPath = window.location.pathname.replace(/\/+$|\/index\.html$/i, '/');
  document.querySelectorAll('.site-nav-main .nav-menu a, .site-nav-main .logo, .subnav-links a').forEach((link) => {
    try {
      const url = new URL(link.href, window.location.origin);
      const normalized = url.pathname.replace(/\/+$|\/index\.html$/i, '/');
      if (normalized === currentPath) {
        link.classList.add('active');
      }
    } catch (error) {
      // ignore invalid URLs
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.classList.remove('active');
    }
  });

  setupShopPage();
}

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

function setupProductAutoRefresh() {
  if (window.__productAutoRefreshBound) return;
  window.__productAutoRefreshBound = true;

  const refreshProducts = () => {
    if (!document.hidden) {
      try {
        loadProducts();
      } catch (error) {
        console.warn('Auto refresh failed:', error);
      }
    }
  };

  window.addEventListener('focus', refreshProducts);
  window.addEventListener('pageshow', refreshProducts);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshProducts();
  });
}

// Initialize the application
function initializeApp() {
  console.log('Initializing Wimp-Drop...');
  
  // Load cart and wishlist from localStorage
  AppState.cart = Storage.getCart();
  AppState.wishlist = Storage.getWishlist();

  setupProductAutoRefresh();
  
  // Initialize any visible product lists or homepage rails
  const productList = document.getElementById('product-list');
  if (productList || isHomePage()) {
    loadProducts();
  }
}

// Global Event Listeners
function isShopPage() {
  return !!document.querySelector('.shop-product-grid');
}

function isHomePage() {
  const path = window.location.pathname;
  return path === '/' || path.endsWith('/index.html') || path.endsWith('/home.html');
}

function setupShopPage() {
  if (!isShopPage() || window.shopPageSetupDone) return;
  window.shopPageSetupDone = true;

  const shopSearch = document.getElementById('shop-search');
  const originFilters = document.getElementById('origin-filters');
  const sheetOriginFilters = document.getElementById('sheet-origin-filters');
  const priceRange = document.getElementById('price-range');
  const sheetPriceRange = document.getElementById('sheet-price-range');
  const priceValue = document.getElementById('price-range-value');
  const sheetPriceValue = document.getElementById('sheet-price-value');
  const sortSelect = document.getElementById('sort-select');
  const sortPills = Array.from(document.querySelectorAll('.sort-pill'));
  const clearFilters = document.getElementById('clear-filters');
  const openSheet = document.getElementById('open-sheet');
  const closeSheet = document.getElementById('close-sheet');
  const applySheet = document.getElementById('apply-sheet');
  const shopChips = document.getElementById('product-chips');

  if (shopSearch) {
    shopSearch.addEventListener('input', debounce(handleShopSearch, 250));
  }

  if (priceRange) {
    priceRange.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      AppState.shopFilters.priceMax = value;
      if (priceValue) priceValue.textContent = formatCurrency(value);
      if (sheetPriceRange) sheetPriceRange.value = value;
      if (sheetPriceValue) sheetPriceValue.textContent = formatCurrency(value);
      applyShopFilters();
    });
  }

  if (sheetPriceRange) {
    sheetPriceRange.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      AppState.shopFilters.priceMax = value;
      if (sheetPriceValue) sheetPriceValue.textContent = formatCurrency(value);
      if (priceRange) priceRange.value = value;
      if (priceValue) priceValue.textContent = formatCurrency(value);
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (event) => {
      AppState.shopFilters.sortBy = event.target.value;
      updateSortPillState(event.target.value);
      applyShopFilters();
    });
  }

  sortPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const sortBy = pill.dataset.sort || 'newest';
      AppState.shopFilters.sortBy = sortBy;
      if (sortSelect) sortSelect.value = sortBy;
      updateSortPillState(sortBy);
      applyShopFilters();
    });
  });

  if (clearFilters) {
    clearFilters.addEventListener('click', clearShopFilters);
  }

  if (openSheet) {
    openSheet.addEventListener('click', () => {
      const sheet = document.getElementById('sheet-filters');
      if (sheet) sheet.classList.remove('hidden');
    });
  }

  if (closeSheet) {
    closeSheet.addEventListener('click', () => {
      const sheet = document.getElementById('sheet-filters');
      if (sheet) sheet.classList.add('hidden');
    });
  }

  if (applySheet) {
    applySheet.addEventListener('click', () => {
      const sheet = document.getElementById('sheet-filters');
      if (sheet) sheet.classList.add('hidden');
      syncOriginSelections();
      applyShopFilters();
    });
  }

  renderShopFilters(AppState.products);
  applyShopFilters();
}

function updateSortPillState(selectedSort) {
  document.querySelectorAll('.sort-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.sort === selectedSort);
  });
}

function syncOriginSelections() {
  const choices = Array.from(document.querySelectorAll('#sheet-origin-filters input[type="checkbox"]'))
    .filter(el => el.checked)
    .map(el => el.value);

  AppState.shopFilters.origins = choices;
  document.querySelectorAll('#origin-filters input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = choices.includes(checkbox.value);
  });
}

function clearShopFilters() {
  AppState.shopFilters.origins = [];
  AppState.shopFilters.priceMax = Number(document.getElementById('price-range')?.max || 100000);
  AppState.shopFilters.sortBy = 'newest';
  AppState.shopFilters.search = '';
  AppState.shopFilters.selectedVariants = {};

  const shopSearch = document.getElementById('shop-search');
  const priceRange = document.getElementById('price-range');
  const sheetPriceRange = document.getElementById('sheet-price-range');
  const priceValue = document.getElementById('price-range-value');
  const sheetPriceValue = document.getElementById('sheet-price-value');
  const sortSelect = document.getElementById('sort-select');

  if (shopSearch) shopSearch.value = '';
  if (priceRange) priceRange.value = AppState.shopFilters.priceMax;
  if (sheetPriceRange) sheetPriceRange.value = AppState.shopFilters.priceMax;
  if (priceValue) priceValue.textContent = formatCurrency(AppState.shopFilters.priceMax);
  if (sheetPriceValue) sheetPriceValue.textContent = formatCurrency(AppState.shopFilters.priceMax);
  if (sortSelect) sortSelect.value = 'newest';

  document.querySelectorAll('#origin-filters input[type="checkbox"], #sheet-origin-filters input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = false;
  });

  updateSortPillState('newest');
  applyShopFilters();
}

function renderShopFilters(products) {
  if (!isShopPage()) return;
  const origins = Array.from(new Set(products.map(p => (p.origin || 'Global') || 'Global'))).filter(Boolean);
  const priceMax = Math.max(100, Math.ceil((Math.max(...products.map(p => Number(p.price) || 0), AppState.shopFilters.priceMax || 0) || 100) / 100) * 100);
  const currentPrice = typeof AppState.shopFilters.priceMax === 'number' ? AppState.shopFilters.priceMax : priceMax;
  AppState.shopFilters.priceMax = currentPrice;

  const originContainer = document.getElementById('origin-filters');
  const sheetOriginContainer = document.getElementById('sheet-origin-filters');
  const priceRange = document.getElementById('price-range');
  const sheetPriceRange = document.getElementById('sheet-price-range');
  const priceValue = document.getElementById('price-range-value');
  const sheetPriceValue = document.getElementById('sheet-price-value');
  const sortSelect = document.getElementById('sort-select');

  if (originContainer) originContainer.innerHTML = origins.map(origin => `
    <label class="filter-chip">
      <input type="checkbox" value="${origin}" onchange="handleOriginChange(event)">
      <span>${origin}</span>
    </label>
  `).join('');
  if (sheetOriginContainer) sheetOriginContainer.innerHTML = originContainer?.innerHTML || '';

  if (priceRange) {
    priceRange.max = priceMax;
    priceRange.value = AppState.shopFilters.priceMax || priceMax;
  }
  if (sheetPriceRange) {
    sheetPriceRange.max = priceMax;
    sheetPriceRange.value = AppState.shopFilters.priceMax || priceMax;
  }
  if (priceValue) priceValue.textContent = formatCurrency(priceMax);
  if (sheetPriceValue) sheetPriceValue.textContent = formatCurrency(priceMax);

  if (sortSelect) {
    sortSelect.innerHTML = `
      <option value="newest">Newest</option>
      <option value="price-low">Price: Low to High</option>
      <option value="price-high">Price: High to Low</option>
      <option value="rating">Top Rated</option>
      <option value="stock">Stock Availability</option>
    `;
    sortSelect.value = AppState.shopFilters.sortBy;
  }

  updateSortPillState(AppState.shopFilters.sortBy);
  buildFilterChips();
}

function handleOriginChange(event) {
  const checkbox = event.target;
  if (!checkbox) return;
  const allCheckboxes = Array.from(document.querySelectorAll('#origin-filters input[type="checkbox"], #sheet-origin-filters input[type="checkbox"]'));
  const selected = allCheckboxes.filter(el => el.checked).map(el => el.value);
  AppState.shopFilters.origins = selected;
  allCheckboxes.forEach(el => {
    if (Array.from(selected).includes(el.value)) el.checked = true;
  });
  applyShopFilters();
}

function handleShopSearch(event) {
  AppState.shopFilters.search = event.target.value.trim();
  applyShopFilters();
}

function applyShopFilters() {
  if (!isShopPage()) return;
  let filtered = [...AppState.products];

  if (AppState.shopFilters.search) {
    const query = AppState.shopFilters.search.toLowerCase();
    filtered = filtered.filter((p) => {
      return [p.name, p.origin, p.category, p.sku, p.description].some(field => (field || '').toString().toLowerCase().includes(query));
    });
  }

  if (AppState.shopFilters.origins.length) {
    filtered = filtered.filter(p => AppState.shopFilters.origins.includes(p.origin || 'Global'));
  }

  if (AppState.shopFilters.priceMax) {
    filtered = filtered.filter(p => Number(p.price || 0) <= AppState.shopFilters.priceMax);
  }

  switch (AppState.shopFilters.sortBy) {
    case 'price-low':
      filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case 'price-high':
      filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'rating':
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case 'stock':
      filtered.sort((a, b) => (b.inStock ? 0 : 1) - (a.inStock ? 0 : 1));
      break;
    default:
      filtered.sort((a, b) => {
        const aDate = new Date(a.added_at || a.added_time || a.created_at || Date.now());
        const bDate = new Date(b.added_at || b.added_time || b.created_at || Date.now());
        return bDate - aDate;
      });
      break;
  }

  renderProducts(filtered);
  buildFilterChips();
  const resultCountElem = document.getElementById('result-count');
  if (resultCountElem) {
    resultCountElem.textContent = `Showing ${filtered.length} product groups`;
  }
}

function buildFilterChips() {
  const chipRow = document.getElementById('product-chips');
  if (!chipRow || !isShopPage()) return;
  const chips = [];

  if (AppState.shopFilters.search) {
    chips.push({ label: `Search: ${AppState.shopFilters.search}`, type: 'search' });
  }
  if (AppState.shopFilters.origins.length) {
    AppState.shopFilters.origins.forEach(origin => chips.push({ label: origin, type: 'origin' }));
  }
  if (AppState.shopFilters.priceMax && AppState.shopFilters.priceMax < Number(document.getElementById('price-range')?.max || 100000)) {
    chips.push({ label: `Under ${formatCurrency(AppState.shopFilters.priceMax)}`, type: 'price' });
  }

  chipRow.innerHTML = chips.map(chip => `
    <button class="chip" type="button" onclick="removeShopChip('${chip.type}', '${chip.label.replace(/'/g, "\\'")}')">
      ${chip.label} <span>×</span>
    </button>
  `).join('');
}

function removeShopChip(type, label) {
  if (type === 'search') {
    AppState.shopFilters.search = '';
    const shopSearch = document.getElementById('shop-search');
    if (shopSearch) shopSearch.value = '';
  }

  if (type === 'origin') {
    AppState.shopFilters.origins = AppState.shopFilters.origins.filter(value => value !== label);
    document.querySelectorAll('#origin-filters input[type="checkbox"], #sheet-origin-filters input[type="checkbox"]').forEach((checkbox) => {
      if (checkbox.value === label) checkbox.checked = false;
    });
  }

  if (type === 'price') {
    AppState.shopFilters.priceMax = Number(document.getElementById('price-range')?.max || 100000);
    const priceRange = document.getElementById('price-range');
    const sheetPriceRange = document.getElementById('sheet-price-range');
    if (priceRange) priceRange.value = AppState.shopFilters.priceMax;
    if (sheetPriceRange) sheetPriceRange.value = AppState.shopFilters.priceMax;
    document.getElementById('price-range-value').textContent = formatCurrency(AppState.shopFilters.priceMax);
    document.getElementById('sheet-price-value').textContent = formatCurrency(AppState.shopFilters.priceMax);
  }

  applyShopFilters();
}

function normalizeProduct(raw) {
  const price = Number(raw.price ?? raw.base_price ?? raw.total_cost ?? raw.shipping_fee ?? 0);
  const originalPrice = Number(raw.price ?? raw.base_price ?? raw.total_cost ?? raw.original_price ?? raw.originalPrice ?? 0);
  const inventory = Number(raw.stock ?? raw.inventory_raw ?? raw.inventory ?? raw.cj_inventory_total ?? raw.factory_inventory_total ?? raw.my_inventory_total ?? 0);
  const title = raw.title || raw.name || raw.product_title || 'Untitled product';
  const image = raw.image_url || raw.image || raw.thumbnail || raw.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop';
  const status = raw.status || 'On Sale';
  const published = raw.is_published ?? true;

  return {
    id: raw.id || raw.product_id || raw.variant_id || raw.sku || '',
    product_id: raw.id || raw.product_id || raw.variant_id || raw.sku || '',
    name: title,
    category: raw.category || raw.category_name || raw.categoryName || 'General',
    price,
    originalPrice,
    image,
    rating: Number(raw.rating || raw.stars || 4.5),
    reviews: Number(raw.reviews || raw.review_count || raw.reviewCount || 0),
    supplier: raw.supplier || raw.brand || raw.source || 'Wimp-Drop Catalog',
    description: raw.description || raw.productDescription || raw.status || '',
    stock: inventory,
    inStock: published && status !== 'Out of Stock' && inventory > 0,
    status,
    origin: raw.shipping_from || raw.shippingFrom || raw.origin || raw.country || 'Global',
    variants: Array.isArray(raw.variants) ? raw.variants : [],
    sku: raw.sku || raw.variant_sku || raw.item_sku || '',
    added_at: raw.added_time || raw.added_at || raw.price_update_time || raw.created_at || '',
    shippingTime: raw.shippingTime || raw.lead_time || 'Standard',
    url: raw.url || raw.detailUrl || raw.product_url || raw.link || '',
    is_published: published
  };
}

function groupProductsByProductId(products) {
  return products.reduce((groups, product) => {
    // Group by normalized title, since product_id is unique per SKU row
    // in the flat table (no shared parent id) and would never group
    // variants together. Title is the real signal that rows belong to
    // the same product.
    const key = (product.name || product.title || product.sku || product.id || '')
      .toString()
      .trim()
      .toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(product);
    return groups;
  }, {});
}

function renderProductGroupCard(group) {
  const repr = group[0];
  const groupKey = repr.product_id || repr.id || repr.sku || repr.name;
  const selectedVariantId = AppState.shopFilters.selectedVariants[groupKey];
  const selected = group.find(p => p.id === selectedVariantId) || repr;
  const hasDiscount = group.some(p => p.originalPrice && p.originalPrice > p.price);
  const validOriginals = group.map(p => p.originalPrice || p.price || 0).filter(Boolean);
  const lowPrice = Math.min(...group.map(p => p.price || 0));
  const highPrice = Math.max(...group.map(p => p.price || 0));
  const stockStatus = group.some(p => p.inStock) ? 'Available' : 'Out of stock';
  const discountPercent = hasDiscount && validOriginals.length ? Math.round((1 - (lowPrice / Math.max(...validOriginals))) * 100) : 0;
  const variantButtons = group.slice(0, 5).map((variant) => {
    const label = variant.sku || variant.name || 'Variant';
    const active = selected.id === variant.id;
    return `<button class="variant-pill${active ? ' active' : ''}" type="button" onclick="selectShopVariant('${repr.product_id || repr.id}', '${variant.id}')">${label}</button>`;
  }).join('');

  return `
    <article class="product-group-card">
      ${hasDiscount ? `<div class="discount-badge">-${discountPercent}%</div>` : ''}
      <div class="product-image">
        <a href="product.html?id=${encodeURIComponent(selected.id)}" class="product-link">
          <img src="${selected.image}" alt="${selected.name}" class="product-image-inner">
        </a>
      </div>
      <div class="product-info">
        <div class="product-category">${selected.category}</div>
        <h3 class="product-name"><a href="product.html?id=${encodeURIComponent(selected.id)}">${selected.name}</a></h3>
        <div class="product-meta">
          <span class="product-status ${selected.inStock ? 'in-stock' : 'out-stock'}">${stockStatus}</span>
          <span class="product-origin">${selected.origin}</span>
        </div>
        <div class="product-price">
          <span class="price-current">${formatCurrency(lowPrice)}</span>
          ${lowPrice !== highPrice ? `<span class="price-range">${formatCurrency(lowPrice)} - ${formatCurrency(highPrice)}</span>` : ''}
          ${hasDiscount ? `<span class="price-original">${formatCurrency(Math.max(...validOriginals))}</span>` : ''}
        </div>
        <div class="variant-list">${variantButtons}</div>
        <div class="product-actions">
          <button class="btn btn-primary btn-small" onclick="addToCart('${selected.id}')" ${selected.inStock ? '' : 'disabled'}>Add to cart</button>
          <button class="btn btn-outline btn-small" onclick="quickView('${selected.id}')">Quick view</button>
        </div>
      </div>
    </article>
  `;
}

function selectShopVariant(groupKey, variantId) {
  AppState.shopFilters.selectedVariants[groupKey] = variantId;
  applyShopFilters();
}

function renderProducts(products) {
  const productList = document.getElementById('product-list');
  if (!productList) return;

  if (isShopPage()) {
    const grouped = groupProductsByProductId(products);
    const cards = Object.values(grouped).map(group => renderProductGroupCard(group));
    productList.innerHTML = cards.join('');
    return;
  }

  productList.innerHTML = products.map(product => {
    const pid = product.id;
    const pidUrl = encodeURIComponent(pid);
    const pidJson = JSON.stringify(pid);
    const stars = '★'.repeat(Math.floor(product.rating)) + '☆'.repeat(5 - Math.floor(product.rating));
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
    const discountPercent = hasDiscount ? Math.round((1 - (product.price / product.originalPrice)) * 100) : 0;
    return `
    <div class="product-card">
      ${hasDiscount ? `<div class="discount-badge">-${discountPercent}%</div>` : ''}
      <div class="supplier-badge">${product.supplier || ''}</div>
      <div class="product-image">
        <a href="product.html?id=${pidUrl}" class="product-link">
          <img src="${product.image}" alt="${product.name}" class="product-image-inner">
        </a>
      </div>
      <div class="product-info">
        <div class="product-category">${product.category}</div>
        <h3 class="product-name"><a href="product.html?id=${pidUrl}" style="text-decoration: none; color: inherit; cursor: pointer;">${product.name}</a></h3>
        <div class="product-rating">
          <span class="stars">${stars}</span>
          <span class="rating-count">${product.rating} (${product.reviews})</span>
        </div>
        <div class="product-price">
          <span class="price-current">${formatCurrency(product.price)}</span>
          <span class="price-original">${formatCurrency(product.originalPrice)}</span>
        </div>
        <div class="product-actions">
          <button class="btn btn-primary btn-small flex-1" onclick="addToCart(${pidJson})">Add to Cart</button>
          <button class="btn btn-primary btn-small" onclick="buyNow(${pidJson})">Buy Now</button>
          <button class="btn btn-outline btn-small" onclick="toggleWishlist(${pidJson})" title="Add to Wishlist">♡</button>
          <button class="btn btn-outline btn-small" onclick="quickView(${pidJson})" title="Quick view">👁</button>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

function addToCart(productId, quantity = 1) {
  const product = AppState.products.find(p => p.id === productId);
  if (!product) return false;

  // animate product image to cart
  try { animateAddToCart(productId); } catch (e) { /* ignore animation errors */ }

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

function animateAddToCart(productId) {
  try {
    const pidUrl = encodeURIComponent(productId);
    const img = document.querySelector(`a[href*="product.html?id=${pidUrl}"] img`);
    const cartBtn = document.querySelector('[data-cart-badge]') || document.querySelector('a[title="Shopping Cart"]');
    if (!img || !cartBtn) return;

    const imgRect = img.getBoundingClientRect();
    const cartRect = cartBtn.getBoundingClientRect();

    const clone = img.cloneNode(true);
    clone.className = 'fly-image';
    clone.style.left = imgRect.left + 'px';
    clone.style.top = imgRect.top + 'px';
    clone.style.width = imgRect.width + 'px';
    clone.style.height = imgRect.height + 'px';
    clone.style.opacity = '1';
    document.body.appendChild(clone);

    // force layout
    clone.getBoundingClientRect();

    const translateX = (cartRect.left + cartRect.width/2) - (imgRect.left + imgRect.width/2);
    const translateY = (cartRect.top + cartRect.height/2) - (imgRect.top + imgRect.height/2);

    clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(0.2)`;
    clone.style.opacity = '0.6';

    setTimeout(() => {
      clone.style.transition = 'opacity 200ms ease';
      clone.style.opacity = '0';
    }, 520);

    setTimeout(() => { try { clone.remove(); } catch(e){} }, 820);
  } catch (e) {
    console.warn('animateAddToCart failed', e);
  }
}

function showHomepageSkeletons() {
  const containers = ['home-hero-carousel', 'home-categories', 'home-deals-rail', 'home-new-arrivals'];
  containers.forEach((id) => {
    const container = document.getElementById(id);
    if (!container) return;
    if (id === 'home-hero-carousel') {
      container.innerHTML = '<div class="hero-slide active"><div class="hero-slide-card"><div class="hero-slide-copy"><div class="skeleton text" style="width:60%;height:18px;margin-bottom:12px"></div><div class="skeleton text" style="width:90%;height:12px;margin-bottom:6px"></div><div class="skeleton text" style="width:70%;height:12px"></div></div></div></div>';
      return;
    }
    if (id === 'home-categories') {
      container.innerHTML = ['Electronics','Fashion','Home'].map((label) => `<div class="home-category-chip skeleton"><span>${label}</span></div>`).join('');
      return;
    }
    container.innerHTML = Array.from({ length: 4 }, () => '<div class="product-group-card skeleton" style="min-height: 320px"></div>').join('');
  });
}

function showProductSkeletons(count = 6) {
  const productList = document.getElementById('product-list');
  if (!productList) return;
  productList.innerHTML = '';
  for (let i=0;i<count;i++){
    const el = document.createElement('div');
    el.className = 'product-group-card skeleton';
    el.innerHTML = `<div class="skeleton img" style="height:220px;"></div><div style="padding:20px"><div class="skeleton text" style="width:70%; height:18px; margin-bottom:12px"></div><div class="skeleton text" style="width:50%; height:18px; margin-bottom:12px"></div><div class="skeleton text" style="width:90%; height:12px; margin-bottom:6px"></div><div class="skeleton text" style="width:80%; height:12px;"></div></div>`;
    productList.appendChild(el);
  }
}

function removeFromCart(productId) {
  AppState.cart = AppState.cart.filter(item => item.id !== productId);
  Storage.setCart(AppState.cart);
  updateCartBadge();
  if (typeof window.renderCartItems === 'function') window.renderCartItems();
  if (typeof window.updateOrderSummary === 'function') window.updateOrderSummary();
}

function updateCartQuantity(productId, quantity) {
  const item = AppState.cart.find(item => item.id === productId);
  if (item) {
    item.quantity = Math.max(1, quantity);
    Storage.setCart(AppState.cart);
    updateCartBadge();
    if (typeof window.renderCartItems === 'function') window.renderCartItems();
    if (typeof window.updateOrderSummary === 'function') window.updateOrderSummary();
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
    try {
      // animate badge bounce
      badge.classList.remove('badge-bounce');
      // trigger reflow
      void badge.offsetWidth;
      if (count > 0) badge.classList.add('badge-bounce');
    } catch (e) {
      // ignore
    }
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
    if (!productList && !isHomePage()) return;

    // show skeletons while loading
    if (isHomePage()) {
      showHomepageSkeletons();
    } else {
      showProductSkeletons(12);
    }

    // Pagination and filters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const page = Math.max(1, parseInt(urlParams.get('page')) || 1);
    const perPage = 12;

    let products = [];
    let totalCount = 0;

    // Load products exclusively from Supabase.
    // NOTE: we fetch a large batch of raw SKU rows (not just one page's worth),
    // because multiple rows can share the same product title (variants).
    // Pagination must happen AFTER grouping variants into distinct products,
    // otherwise a page can fill up with 12 raw rows that collapse into 1-2
    // actual products.
    if (typeof supabaseService !== 'undefined' && supabaseService.isInitialized) {
      const queryFilters = { limit: 1000 };
      const category = urlParams.get('category');
      const search = urlParams.get('search');
      if (category) queryFilters.category = category;
      if (search) queryFilters.search = search;

      const res = await supabaseService.getProducts({ ...queryFilters, includeUnpublished: true });
      if (res.success && res.products) {
        const allRows = res.products.map(raw => normalizeProduct(raw));
        // Group variant rows into distinct products by title
        const grouped = groupProductsByProductId(allRows);
        const distinctProducts = Object.values(grouped).map(group => {
          // Use the first variant as the representative card, but attach
          // all variants so the UI can offer a variant picker.
          const primary = group[0];
          return { ...primary, variantRows: group };
        });

        totalCount = distinctProducts.length;
        const offset = (page - 1) * perPage;
        products = distinctProducts.slice(offset, offset + perPage);
      } else {
        products = [];
      }
    } else {
      products = [];
    }

    // Fallback: Use mock products if no real products loaded

    AppState.products = products;
    renderProducts(products);
    if (typeof window.renderWatchlist === 'function') window.renderWatchlist();
    if (typeof window.renderCartItems === 'function') window.renderCartItems();
    if (typeof window.updateOrderSummary === 'function') window.updateOrderSummary();

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
  if (isHomePage()) {
    renderHomepageSections(products);
    return;
  }

  const productList = document.getElementById('product-list');
  if (!productList) return;

  if (isShopPage()) {
    // products here are already one-per-distinct-product (grouped in
    // loadProducts), each carrying its full variant list in variantRows.
    // Re-grouping here would collapse each product back down to just
    // itself and lose the other variants, so use variantRows directly.
    const cards = products.map(p => renderProductGroupCard(p.variantRows && p.variantRows.length ? p.variantRows : [p]));
    productList.innerHTML = cards.join('');
    return;
  }
  
  productList.innerHTML = products.map(product => {
    const pid = product.id;
    const pidUrl = encodeURIComponent(pid);
    const pidJson = JSON.stringify(pid);
    const stars = '★'.repeat(Math.floor(product.rating)) + '☆'.repeat(5 - Math.floor(product.rating));
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
    const discountPercent = hasDiscount ? Math.round((1 - (product.price / product.originalPrice)) * 100) : 0;
    return `
    <div class="product-card">
      ${hasDiscount ? `<div class="discount-badge">-${discountPercent}%</div>` : ''}
      <div class="supplier-badge">${product.supplier || ''}</div>
      <div class="product-image">
        <a href="product.html?id=${pidUrl}" class="product-link">
          <img src="${product.image}" alt="${product.name}" class="product-image-inner">
        </a>
      </div>
      <div class="product-info">
        <div class="product-category">${product.category}</div>
        <h3 class="product-name"><a href="product.html?id=${pidUrl}" style="text-decoration: none; color: inherit; cursor: pointer;">${product.name}</a></h3>
        <div class="product-rating">
          <span class="stars">${stars}</span>
          <span class="rating-count">${product.rating} (${product.reviews})</span>
        </div>
        <div class="product-price">
          <span class="price-current">${formatCurrency(product.price)}</span>
          <span class="price-original">${formatCurrency(product.originalPrice)}</span>
        </div>
        <div class="product-actions">
          <button class="btn btn-primary btn-small flex-1" onclick="addToCart(${pidJson})">Add to Cart</button>
          <button class="btn btn-primary btn-small" onclick="buyNow(${pidJson})">Buy Now</button>
          <button class="btn btn-outline btn-small" onclick="toggleWishlist(${pidJson})" title="Add to Wishlist">♡</button>
          <button class="btn btn-outline btn-small" onclick="quickView(${pidJson})" title="Quick view">👁</button>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

function renderHomepageSections(products) {
  const heroContainer = document.getElementById('home-hero-carousel');
  const heroDots = document.getElementById('home-hero-dots');
  const categoriesContainer = document.getElementById('home-categories');
  const dealsContainer = document.getElementById('home-deals-rail');
  const arrivalsContainer = document.getElementById('home-new-arrivals');
  const trustOrigin = document.getElementById('trust-origin');

  const normalizedProducts = products.map(product => normalizeProduct(product));
  const featuredProducts = normalizedProducts.slice(0, 4);
  const categories = [...normalizedProducts].reduce((acc, product) => {
    const label = inferCategoryLabel(product);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const deals = [...normalizedProducts]
    .filter(product => Number(product.originalPrice || 0) > Number(product.price || 0))
    .sort((a, b) => {
      const discountA = (Number(a.originalPrice || 0) - Number(a.price || 0)) / Math.max(Number(a.originalPrice || 1), 1);
      const discountB = (Number(b.originalPrice || 0) - Number(b.price || 0)) / Math.max(Number(b.originalPrice || 1), 1);
      return discountB - discountA;
    })
    .slice(0, 4);

  const arrivals = [...normalizedProducts]
    .sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0))
    .slice(0, 4);

  if (heroContainer) {
    heroContainer.innerHTML = featuredProducts.length ? featuredProducts.map((product, index) => `
      <div class="hero-slide ${index === 0 ? 'active' : ''}">
        <div class="hero-slide-card">
          <div class="hero-slide-copy">
            <span class="hero-slide-label">${product.category}</span>
            <h3>${product.name}</h3>
            <p>${product.description || 'Live inventory and origin-aware shipping details are surfaced directly from the catalog.'}</p>
            <div class="hero-slide-meta">
              <span>${product.origin || 'Global'}</span>
              <span>${product.inStock ? 'In stock' : 'Limited stock'}</span>
            </div>
          </div>
          <div class="hero-slide-visual">
            <img src="${product.image}" alt="${product.name}">
          </div>
        </div>
      </div>
    `).join('') : '<div class="hero-slide active"><div class="hero-slide-card"><div class="hero-slide-copy"><h3>Curated catalog loading</h3><p>Products will appear as soon as the storefront data is available.</p></div></div></div>';

    if (heroDots) {
      heroDots.innerHTML = featuredProducts.length ? featuredProducts.map((_, index) => `<button class="hero-dot ${index === 0 ? 'active' : ''}" type="button" data-slide-index="${index}"></button>`).join('') : '';
      heroDots.querySelectorAll('.hero-dot').forEach((dot) => {
        dot.addEventListener('click', () => {
          const index = Number(dot.dataset.slideIndex || 0);
          const slides = heroContainer.querySelectorAll('.hero-slide');
          slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === index));
          heroDots.querySelectorAll('.hero-dot').forEach((dotButton, dotIndex) => dotButton.classList.toggle('active', dotIndex === index));
        });
      });
    }

    const slides = heroContainer.querySelectorAll('.hero-slide');
    if (slides.length > 1) {
      clearInterval(window.homeHeroTimer);
      window.homeHeroTimer = setInterval(() => {
        const current = Number(heroContainer.dataset.activeIndex || 0);
        const next = (current + 1) % slides.length;
        heroContainer.dataset.activeIndex = String(next);
        slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === next));
        heroDots.querySelectorAll('.hero-dot').forEach((dotButton, dotIndex) => dotButton.classList.toggle('active', dotIndex === next));
      }, 4500);
    }
  }

  if (categoriesContainer) {
    const categoryCards = Object.entries(categories)
      .slice(0, 6)
      .map(([label, count]) => `
        <a href="pages/shop.html?search=${encodeURIComponent(label.toLowerCase())}" class="home-category-chip">
          <span>${label}</span>
          <small>${count} live picks</small>
        </a>
      `)
      .join('');
    categoriesContainer.innerHTML = categoryCards || '<div class="empty-state">Catalog categories will appear here once products are available.</div>';
  }

  if (dealsContainer) {
    dealsContainer.innerHTML = deals.length ? deals.map(product => renderHomeProductCard(product)).join('') : '<div class="empty-state">No current deals were detected from the product metadata.</div>';
  }

  if (arrivalsContainer) {
    arrivalsContainer.innerHTML = arrivals.length ? arrivals.map(product => renderHomeProductCard(product)).join('') : '<div class="empty-state">New arrivals will appear here once live catalog data is available.</div>';
  }

  if (trustOrigin) {
    const origin = normalizedProducts.find(product => product.origin)?.origin || 'Global';
    trustOrigin.textContent = `Ships from ${origin}`;
  }
}

function inferCategoryLabel(product) {
  const haystack = `${product.name} ${product.category} ${product.description}`.toLowerCase();
  if (/(earbud|headphone|speaker|phone|camera|laptop|tablet|monitor|charger|console|keyboard|mouse|watch|smart)/.test(haystack)) {
    return 'Electronics';
  }
  if (/(jacket|shoe|bag|watch|shirt|dress|sunglass|hat|belt|fashion|accessory)/.test(haystack)) {
    return 'Fashion';
  }
  if (/(lamp|chair|sofa|bed|mug|kitchen|home|decor|storage|organizer|tool)/.test(haystack)) {
    return 'Home';
  }
  if (/(beauty|skin|cosmetic|perfume|cream|serum|makeup)/.test(haystack)) {
    return 'Beauty';
  }
  return 'Essentials';
}

function renderHomeProductCard(product) {
  const pid = product.id || product.product_id || product.sku || product.name;
  const pidUrl = encodeURIComponent(pid);
  const hasDiscount = Number(product.originalPrice || 0) > Number(product.price || 0);
  const discountPercent = hasDiscount ? Math.round((1 - (Number(product.price || 0) / Math.max(Number(product.originalPrice || 1), 1))) * 100) : 0;

  return `
    <article class="product-group-card home-product-card">
      ${hasDiscount ? `<div class="discount-badge">-${discountPercent}%</div>` : ''}
      <div class="product-image">
        <a href="product.html?id=${pidUrl}" class="product-link">
          <img src="${product.image}" alt="${product.name}" class="product-image-inner">
        </a>
      </div>
      <div class="product-info">
        <div class="product-category">${product.category || 'Featured'}</div>
        <h3 class="product-name"><a href="product.html?id=${pidUrl}">${product.name}</a></h3>
        <div class="product-meta">
          <span class="product-status ${product.inStock ? 'in-stock' : 'out-stock'}">${product.inStock ? 'Available' : 'Limited'}</span>
          <span class="product-origin">${product.origin || 'Global'}</span>
        </div>
        <div class="product-price">
          <span class="price-current">${formatCurrency(product.price)}</span>
          ${hasDiscount ? `<span class="price-original">${formatCurrency(product.originalPrice)}</span>` : ''}
        </div>
        <div class="product-actions">
          <button class="btn btn-primary btn-small" onclick="addToCart('${pid}')">${product.inStock ? 'Add to cart' : 'Notify me'}</button>
          <button class="btn btn-outline btn-small" onclick="quickView('${pid}')">Quick view</button>
        </div>
      </div>
    </article>
  `;
}

function buyNow(productId) {
  addToCart(productId, 1);
  // small delay for animation then navigate to cart
  setTimeout(() => { window.location.href = '/pages/cart.html'; }, 450);
}

function quickView(productId) {
  // Basic quick view: open product page in new small window; can be upgraded to modal
  const url = `/pages/product.html?id=${encodeURIComponent(productId)}`;
  window.open(url, '_blank', 'toolbar=0,location=0,status=0,menubar=0,width=420,height=720');
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
        return { success: true, user: result.user, session: result.session };
      } else {
        showNotification(result.error || 'Login failed', 'error');
        return { success: false, error: result.error || 'Login failed' };
      }
    } else {
      showNotification('Auth service not initialized', 'error');
      return { success: false, error: 'Auth service not initialized' };
    }
  } catch (error) {
    console.error('Login error:', error);
    showNotification('Login failed: ' + error.message, 'error');
    return { success: false, error: error.message };
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

// Product sourcing now comes directly from the Supabase `products` table.

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
    // TODO: Integrate tracking with Supabase order records or shipping provider.
    console.log('Tracking order:', orderId);
    return {
      orderId,
      status: 'shipped',
      trackingNumber: 'TRACK123456789',
      carrier: 'Local Carrier'
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
  if (typeof window.renderWatchlist === 'function') window.renderWatchlist();
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
        const products = res.products.map(p => normalizeProduct(p));

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

// ===== APP BOOTSTRAP =====
// This actually starts the app: loads config, initializes Supabase,
// and triggers the first loadProducts() call. Without this, nothing
// in initializePage() ever runs.
// window._appReady is exposed so individual pages (e.g. account.html's
// login guard) can await the real init chain instead of guessing with
// an arbitrary setTimeout.
document.addEventListener('DOMContentLoaded', () => {
  window._appReady = initializePage().catch(err => {
    console.error('initializePage failed:', err);
  });
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AppState, Storage, addToCart, removeFromCart };
}
