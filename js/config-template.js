



const CONFIG = {

  supabaseUrl: 'https://your-project.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',


  flutterwaveKey: 'FLWPUBK-xxxxxxxxxxxxxxxxxxxxx-X',


  appName: 'Wimp-Drop',
  appVersion: '1.0.0',
  environment: 'production',



  apiEndpoints: {
    flutterwaveProxy: '/functions/v1/flutterwave-proxy',
    sendEmail: '/functions/v1/send-email',
    syncInventory: '/functions/v1/sync-inventory'
  },


  features: {
    enableProductReviews: true,
    enableWishlist: true,
    enableGuestCheckout: false,
    enableMultipleAddresses: true,
    enablePromoCode: true,
    enableReferralProgram: false
  },


  payment: {
    currency: 'NGN',
    minimumOrderAmount: 1000,
    shippingCost: 9.99,
    taxRate: 0.10,
    supportedCurrencies: ['NGN', 'USD', 'GHS', 'KES']
  },


  shipping: {
    standardDays: '7-14',
    standardCost: 9.99,
    expressDays: '3-5',
    expressCost: 19.99,
    freeShippingThreshold: 100
  },


  pagination: {
    productsPerPage: 12,
    ordersPerPage: 10,
    commentsPerPage: 5
  },


  cache: {
    productCacheTTL: 3600,
    categoryCacheTTL: 7200,
    userCacheTTL: 1800
  }
};


if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
