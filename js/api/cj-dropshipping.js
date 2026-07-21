// ===== CJ DROPSHIPPING API v2 (Improved Integration) =====
// This is a direct client-side integration with CJ Dropshipping API
// For production, consider using Supabase Edge Functions as a proxy to keep API key secure

class CJDropshippingAPI {
  constructor() {
    this.baseUrl = 'https://developers.cjdropshipping.com/api2.0/v1';
    this.apiKey = null;
    this.storeId = null;
    this.initialized = false;
    this.rateLimitDelay = 500; // ms between requests
    this.lastRequestTime = 0;
  }

  /**
   * Initialize the API with credentials
   */
  async initialize() {
    if (this.initialized) return true;

    try {
      // Load env variables
      if (typeof env !== 'undefined' && env.load && !env.isLoaded) {
        await env.load();
      }

      this.apiKey = (typeof env !== 'undefined' && env.get) 
        ? env.get('VITE_CJ_API_KEY') 
        : '';
      this.storeId = (typeof env !== 'undefined' && env.get) 
        ? env.get('VITE_CJ_STORE_ID') 
        : '';

      if (!this.apiKey) {
        console.warn('⚠️ CJ API Key not configured');
        return false;
      }

      console.log('✓ CJ Dropshipping API initialized');
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize CJ API:', error);
      return false;
    }
  }

  /**
   * Respect rate limiting
   */
  async _rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Make API request to CJ
   */
  async _request(endpoint, method = 'GET', payload = null) {
    await this._rateLimit();

    if (!this.apiKey) {
      throw new Error('CJ API not initialized');
    }

    const url = new URL(endpoint, this.baseUrl).toString();
    
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const options = {
      method,
      headers,
      credentials: 'omit' // Don't send cookies
    };

    if (payload) {
      // Add store ID to payload automatically
      const body = { ...payload };
      if (this.storeId) {
        body.store_id = this.storeId;
        body.storeId = this.storeId;
      }
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.message || data.error || `HTTP ${response.status}`;
        console.error(`CJ API Error: ${endpoint}`, errorMsg);
        throw new Error(errorMsg);
      }

      return data;
    } catch (error) {
      console.error('CJ API request failed:', error);
      throw error;
    }
  }

  // ===== PRODUCT SEARCH =====

  /**
   * Search products
   * @param {string} keyword - Search keyword
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Items per page
   */
  async searchProducts(keyword = 'electronics', page = 1, pageSize = 20) {
    try {
      await this.initialize();

      const payload = {
        keyword,
        pageNo: page,
        pageSize,
        sortOrder: 'normal'
      };

      // Try direct product search endpoint
      try {
        const result = await this._request('/v1/product/search', 'POST', payload);
        
        // CJ returns data in different formats depending on endpoint
        let products = [];
        if (result.data && Array.isArray(result.data.products)) {
          products = result.data.products;
        } else if (Array.isArray(result.data)) {
          products = result.data;
        } else if (result.products) {
          products = result.products;
        }

        return {
          success: true,
          products: products.map(p => this._normalizeProduct(p)),
          total: result.total || result.totalCount || products.length,
          page,
          pageSize
        };
      } catch (error) {
        // Fallback: Use catalog endpoint
        console.log('Search failed, trying catalog endpoint...');
        return await this._getCatalogProducts(keyword, page, pageSize);
      }
    } catch (error) {
      console.error('Product search error:', error);
      throw error;
    }
  }

  /**
   * Get catalog products (fallback search)
   */
  async _getCatalogProducts(category = 'electronics', page = 1, pageSize = 20) {
    try {
      const payload = {
        category,
        pageNo: page,
        pageSize
      };

      const result = await this._request('/v1/product/list', 'POST', payload);
      
      let products = [];
      if (result.data && Array.isArray(result.data)) {
        products = result.data;
      } else if (Array.isArray(result)) {
        products = result;
      }

      return {
        success: true,
        products: products.map(p => this._normalizeProduct(p)),
        total: result.total || products.length,
        page,
        pageSize
      };
    } catch (error) {
      console.error('Catalog fetch error:', error);
      throw error;
    }
  }

  /**
   * Get product details
   */
  async getProductDetails(productId) {
    try {
      await this.initialize();

      const result = await this._request(`/v1/product/${productId}`, 'GET');
      
      const product = result.data || result;
      return {
        success: true,
        product: this._normalizeProduct(product)
      };
    } catch (error) {
      console.error('Get product details error:', error);
      throw error;
    }
  }

  /**
   * Normalize product data from CJ to standard format
   */
  _normalizeProduct(p) {
    return {
      id: p.id || p.productId || p.product_id || '',
      name: p.productTitle || p.title || p.name || 'Untitled',
      description: p.productDescription || p.description || '',
      category: p.category || p.categoryName || 'general',
      
      // Pricing (CJ prices usually in USD)
      price: Number(p.salePrice || p.price || 0) * 100, // Convert to cents
      originalPrice: Number(p.listPrice || p.originalPrice || p.price || 0) * 100,
      currency: 'USD',
      
      // Images
      image: p.thumbnail || p.thumbImage || p.mainImage || 
             (Array.isArray(p.images) && p.images[0]) || '',
      images: Array.isArray(p.images) ? p.images : 
              (p.image ? [p.image] : []),
      
      // Ratings
      rating: Number(p.rating || p.stars || 4.5),
      reviews: Number(p.reviewCount || p.reviews || 0),
      
      // Stock
      stock: Number(p.stock || p.quantity || 0),
      inStock: (p.stock || p.quantity || 0) > 0,
      
      // Supplier
      supplier: 'CJ Dropshipping',
      supplierId: p.supplierId || p.supplier_id || '',
      
      // Variants
      variants: Array.isArray(p.variants) ? p.variants : [],
      
      // Additional
      sku: p.sku || '',
      weight: p.weight || 0,
      shippingTime: p.shippingTime || 'Standard',
      url: p.detailUrl || ''
    };
  }

  // ===== CATEGORIES =====

  async getCategories() {
    try {
      await this.initialize();

      const result = await this._request('/v1/category/list', 'GET');
      
      let categories = [];
      if (result.data && Array.isArray(result.data)) {
        categories = result.data;
      } else if (Array.isArray(result)) {
        categories = result;
      }

      return {
        success: true,
        categories: categories.map(c => ({
          id: c.id || c.categoryId,
          name: c.name || c.categoryName,
          description: c.description || ''
        }))
      };
    } catch (error) {
      console.error('Get categories error:', error);
      return { success: false, categories: [], error: error.message };
    }
  }

  // ===== SHIPPING =====

  async calculateShipping(productId, destination, quantity = 1) {
    try {
      await this.initialize();

      const payload = {
        productId,
        destination,
        quantity
      };

      const result = await this._request('/v1/shipping/calculate', 'POST', payload);
      
      return {
        success: true,
        shipping: result.data || result
      };
    } catch (error) {
      console.error('Calculate shipping error:', error);
      throw error;
    }
  }

  async getShippingMethods(destination = 'US') {
    try {
      await this.initialize();

      const result = await this._request(`/v1/shipping/methods?destination=${destination}`, 'GET');
      
      let methods = [];
      if (result.data && Array.isArray(result.data)) {
        methods = result.data;
      } else if (Array.isArray(result)) {
        methods = result;
      }

      return {
        success: true,
        methods: methods.map(m => ({
          id: m.id || m.methodId,
          name: m.name || m.methodName,
          cost: Number(m.cost || 0) * 100,
          estimatedDays: m.estimatedDays || 7,
          description: m.description || ''
        }))
      };
    } catch (error) {
      console.error('Get shipping methods error:', error);
      return { success: false, methods: [], error: error.message };
    }
  }

  // ===== ORDERS =====

  async createOrder(orderData) {
    try {
      await this.initialize();

      // Build CJ order format
      const payload = {
        orderNo: orderData.orderNo || `WD-${Date.now()}`,
        recipient: {
          name: orderData.customerName || '',
          phone: orderData.phone || '',
          email: orderData.email || '',
          address: orderData.address || '',
          city: orderData.city || '',
          state: orderData.state || '',
          postalCode: orderData.postalCode || '',
          country: orderData.country || ''
        },
        products: (orderData.items || []).map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        remark: orderData.notes || '',
        shippingMethod: orderData.shippingMethod || ''
      };

      const result = await this._request('/v1/order/create', 'POST', payload);
      
      return {
        success: true,
        cjOrderId: result.cjOrderId || result.order_id || result.id,
        data: result
      };
    } catch (error) {
      console.error('Create order error:', error);
      throw error;
    }
  }

  async getOrder(cjOrderId) {
    try {
      await this.initialize();

      const result = await this._request(`/v1/order/${cjOrderId}`, 'GET');
      
      return {
        success: true,
        order: result.data || result
      };
    } catch (error) {
      console.error('Get order error:', error);
      throw error;
    }
  }

  async getOrderStatus(cjOrderId) {
    try {
      const order = await this.getOrder(cjOrderId);
      return {
        success: true,
        status: order.order?.status || 'unknown',
        tracking: order.order?.tracking || null
      };
    } catch (error) {
      console.error('Get order status error:', error);
      throw error;
    }
  }

  // ===== TRACKING =====

  async getTrackingInfo(cjOrderId) {
    try {
      await this.initialize();

      const result = await this._request(`/v1/order/${cjOrderId}/tracking`, 'GET');
      
      return {
        success: true,
        tracking: result.data || result
      };
    } catch (error) {
      console.error('Get tracking info error:', error);
      throw error;
    }
  }

  // ===== SYNC & UTILITIES =====

  async syncInventory(productIds = []) {
    try {
      await this.initialize();

      const payload = { productIds };
      const result = await this._request('/v1/inventory/sync', 'POST', payload);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Inventory sync error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      await this.initialize();
      
      // Try a simple request
      const categories = await this.getCategories();
      return {
        success: categories.success,
        message: categories.success ? 'CJ API connection successful' : 'Connection failed'
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }
}

// Initialize global instance
const cjAPI = new CJDropshippingAPI();

// Auto-initialize on first access
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    cjAPI.initialize().catch(e => console.warn('CJ API init:', e));
  });
} else {
  cjAPI.initialize().catch(e => console.warn('CJ API init:', e));
}
