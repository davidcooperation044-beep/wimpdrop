// ===== CJ DROPSHIPPING API INTEGRATION =====
// This module handles all CJ Dropshipping API operations
// NOTE: All API calls should be made through your backend (Supabase Edge Functions)
// to keep the API key secure

class CJDropshippingAPI {
  constructor() {
    this.baseUrl = (typeof env !== 'undefined' ? env.get('VITE_CJ_API_URL') : '') || 'https://developers.cjdropshipping.com/api2.0/v1';
    this.backendBase = '/api/cj';
    this.apiKey = '';
    this.storeId = '';
  }

  async getApiKey() {
    if (this.apiKey) return this.apiKey;
    if (typeof env !== 'undefined' && env.get) {
      if (!env.isLoaded && typeof env.load === 'function') {
        await env.load();
      }
      const envKey = env.get('VITE_CJ_API_KEY') || '';
      if (envKey) {
        this.apiKey = envKey;
        return envKey;
      }
    }
    if (window.ENV_CONFIG?.VITE_CJ_API_KEY) {
      this.apiKey = window.ENV_CONFIG.VITE_CJ_API_KEY;
      return this.apiKey;
    }
    return this.apiKey;
  }

  async getStoreIdValue() {
    const envStoreId = (typeof env !== 'undefined' && env.get) ? env.get('VITE_CJ_STORE_ID') : '';
    const storeId = envStoreId || this.storeId || window.CJ_STORE_ID || '';
    return storeId.toString();
  }

  async buildUrl(path) {
    const url = new URL(path, window.location.origin);
    const storeId = await this.getStoreIdValue();
    if (storeId) {
      url.searchParams.set('storeId', storeId);
    }
    return url.toString();
  }

  async buildPayload(payload = {}) {
    const body = { ...payload };
    const storeId = await this.getStoreIdValue();
    if (storeId) {
      body.storeId = storeId;
      body.store_id = storeId;
    }
    return body;
  }

  async request(path, options = {}) {
    const url = path.startsWith('http') ? path : await this.buildUrl(path);
    const apiKey = await this.getApiKey();
    const isProxyRequest = path.startsWith('/api/cj') || url.startsWith(`${window.location.origin}/api/cj`);
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (!isProxyRequest && apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      headers['X-API-Key'] = apiKey;
    }
    Object.keys(headers).forEach((key) => {
      if (headers[key] === undefined || headers[key] === null || headers[key] === '') {
        delete headers[key];
      }
    });
    const init = {
      method: options.method || 'GET',
      headers
    };

    if (options.body !== undefined && options.body !== null) {
      const bodyValue = typeof options.body === 'string' ? options.body : JSON.stringify(await this.buildPayload(options.body));
      init.body = bodyValue;
    }

    let response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      throw new Error(`Network request to CJ failed: ${error.message}`);
    }

    const text = await response.text();
    let result = null;
    try {
      result = text ? JSON.parse(text) : null;
    } catch (error) {
      // leave result as null if response is not JSON
    }

    if (!response.ok) {
      const errMsg = (result && (result.message || result.error)) || `CJ API responded with status ${response.status}`;
      throw new Error(errMsg);
    }

    return result || { success: true, data: options.body };
  }


  // ===== PRODUCT OPERATIONS =====

  /**
   * Search products from CJ Dropshipping catalog
   * @param {string} keyword - Search keyword
   * @param {number} pageNo - Page number for pagination
   * @param {number} pageSize - Items per page
   */
  async searchProducts(keyword, page = 1, limit = 50) {
    try {
      return await this.request('/api/cj/products/search', {
        method: 'POST',
        body: {
          keyword,
          page,
          limit
        }
      });
    } catch (error) {
      console.error('CJ search error:', error);
      throw error;
    }
  }

  /**
   * Get product details from CJ Dropshipping
   * @param {string} productId - CJ product ID
   */
  async getProductDetails(productId) {
    try {
      return await this.request(`/api/cj/products/${productId}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('CJ get product error:', error);
      throw error;
    }
  }

  /**
   * Get product variants (sizes, colors, etc.)
   * @param {string} productId - CJ product ID
   */
  async getProductVariants(productId) {
    try {
      return await this.request(`/api/cj/products/${productId}/variants`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('CJ get variants error:', error);
      throw error;
    }
  }

  /**
   * Get product images
   * @param {string} productId - CJ product ID
   */
  async getProductImages(productId) {
    try {
      return await this.request(`/api/cj/products/${productId}/images`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('CJ get images error:', error);
      throw error;
    }
  }

  // ===== INVENTORY & STOCK =====

  /**
   * Check product stock/inventory
   * @param {string} productId - CJ product ID
   */
  async checkStock(productId) {
    try {
      return await this.request(`/api/cj/products/${productId}/stock`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('CJ check stock error:', error);
      throw error;
    }
  }

  /**
   * Sync inventory across multiple products
   */
  async syncInventory(productIds) {
    try {
      return await this.request('/api/cj/inventory/sync', {
        method: 'POST',
        body: { productIds }
      });
    } catch (error) {
      console.error('CJ inventory sync error:', error);
      throw error;
    }
  }

  // ===== SHIPPING & RATES =====

  /**
   * Calculate shipping rates for a product
   * @param {object} shippingInfo - Contains destination, weight, etc.
   */
  async calculateShippingRate(shippingInfo) {
    try {
      return await this.request('/api/cj/shipping/calculate', {
        method: 'POST',
        body: shippingInfo
      });
    } catch (error) {
      console.error('CJ shipping calculation error:', error);
      throw error;
    }
  }

  /**
   * Get available shipping methods
   * @param {string} country - Destination country code
   */
  async getShippingMethods(country) {
    try {
      return await this.request(`/api/cj/shipping/methods?country=${country}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('CJ get shipping methods error:', error);
      throw error;
    }
  }

  // ===== ORDERS =====

  /**
   * Create order with CJ Dropshipping
   * @param {object} orderData - Order details
   */
  async createOrder(orderData) {
    try {
      return await this.request('/api/cj/orders/create', {
        method: 'POST',
        body: orderData
      });
    } catch (error) {
      console.error('CJ order creation error:', error);
      throw error;
    }
  }

  /**
   * Get order details from CJ
   * @param {string} cjOrderId - CJ Order ID
   */
  async getOrderDetails(cjOrderId) {
    try {
      return await this.request(`/api/cj/orders/${cjOrderId}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('CJ get order error:', error);
      throw error;
    }
  }

  /**
   * Get order status
   * @param {string} cjOrderId - CJ Order ID
   */
  async getOrderStatus(cjOrderId) {
    try {
      return await this.request(`/api/cj/orders/${cjOrderId}/status`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('CJ get order status error:', error);
      throw error;
    }
  }

  // ===== TRACKING =====

  /**
   * Get tracking information for an order
   * @param {string} cjOrderId - CJ Order ID
   */
  async getTrackingInfo(cjOrderId) {
    try {
      return await this.request(`/api/cj/orders/${cjOrderId}/tracking`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('CJ tracking error:', error);
      throw error;
    }
  }

  // ===== PRICING =====

  /**
   * Get product pricing
   * @param {string} productId - CJ product ID
   */
  async getPricing(productId) {
    try {
      return await this.request(`/api/cj/products/${productId}/pricing`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('CJ pricing error:', error);
      throw error;
    }
  }

  /**
   * Get bulk pricing for multiple products
   */
  async getBulkPricing(productIds) {
    try {
      return await this.request('/api/cj/products/pricing/bulk', {
        method: 'POST',
        body: { productIds }
      });
    } catch (error) {
      console.error('CJ bulk pricing error:', error);
      throw error;
    }
  }

  // ===== CATEGORIES & BROWSE =====

  /**
   * Get product categories
   */
  async getCategories() {
    try {
      return await this.request('/api/cj/categories', {
        method: 'GET'
      });
    } catch (error) {
      console.error('CJ categories error:', error);
      throw error;
    }
  }

  /**
   * Get trending products
   */
  async getTrendingProducts(limit = 10) {
    try {
      return await this.request(`/api/cj/products/trending?limit=${limit}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('CJ trending products error:', error);
      throw error;
    }
  }
}

// Initialize CJ Dropshipping client
const cjAPI = new CJDropshippingAPI();

// Helper function to import products to store
async function importProductToCatalog(cjProductId) {
  try {
    const productDetails = await cjAPI.getProductDetails(cjProductId);
    const images = await cjAPI.getProductImages(cjProductId);
    const variants = await cjAPI.getProductVariants(cjProductId);
    const pricing = await cjAPI.getPricing(cjProductId);

    const importedProduct = {
      cj_product_id: cjProductId,
      name: productDetails.name,
      description: productDetails.description,
      category: productDetails.category,
      images: images,
      variants: variants,
      price: pricing.retail_price,
      cost: pricing.wholesale_price,
      supplier: 'CJ Dropshipping',
      created_at: new Date().toISOString()
    };

    // Save to Wimp-Drop database using Supabase client
    const sb = (typeof supabaseService !== 'undefined') ? await supabaseService.getClient() : null;
    if (!sb || !sb.from) {
      throw new Error('Database client is not available. Ensure Supabase is initialized.');
    }

    const { data, error } = await sb.from('products').insert(importedProduct).select().single();
    if (error) {
      throw error;
    }

    showNotification('Product imported successfully!', 'success');
    return data;
  } catch (error) {
    console.error('Product import error:', error);
    showNotification('Failed to import product', 'error');
    throw error;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CJDropshippingAPI, cjAPI };
}
