// Configuration Template for Wimp-Drop
// Copy this to a new file: js/config.js
// Fill in your actual credentials

const CONFIG = {
  // ===== SUPABASE CONFIGURATION =====
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  
  // ===== FLUTTERWAVE CONFIGURATION =====
  flutterwaveKey: 'FLWPUBK-xxxxxxxxxxxxxxxxxxxxx-X',
  
  // ===== APP CONFIGURATION =====
  appName: 'Wimp-Drop',
  appVersion: '1.0.0',
  environment: 'production', // 'development' or 'production'
  
  // ===== API ENDPOINTS =====
  // These are Edge Function endpoints from Supabase
  apiEndpoints: {
    flutterwaveProxy: '/functions/v1/flutterwave-proxy',
    sendEmail: '/functions/v1/send-email',
    syncInventory: '/functions/v1/sync-inventory'
  },
  
  // ===== FEATURE FLAGS =====
  features: {
    enableProductReviews: true,
    enableWishlist: true,
    enableGuestCheckout: false,
    enableMultipleAddresses: true,
    enablePromoCode: true,
    enableReferralProgram: false
  },
  
  // ===== PAYMENT SETTINGS =====
  payment: {
    currency: 'NGN',
    minimumOrderAmount: 1000,
    shippingCost: 9.99,
    taxRate: 0.10, // 10%
    supportedCurrencies: ['NGN', 'USD', 'GHS', 'KES']
  },
  
  // ===== SHIPPING SETTINGS =====
  shipping: {
    standardDays: '7-14',
    standardCost: 9.99,
    expressDays: '3-5',
    expressCost: 19.99,
    freeShippingThreshold: 100
  },
  
  // ===== PAGINATION =====
  pagination: {
    productsPerPage: 12,
    ordersPerPage: 10,
    commentsPerPage: 5
  },
  
  // ===== CACHE SETTINGS =====
  cache: {
    productCacheTTL: 3600, // 1 hour
    categoryCacheTTL: 7200, // 2 hours
    userCacheTTL: 1800 // 30 minutes
  }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
