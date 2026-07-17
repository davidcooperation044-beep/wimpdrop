// ===== SUPABASE INTEGRATION =====
// This module handles all Supabase operations for authentication, database, and real-time updates

class SupabaseClient {
  constructor(supabaseUrl, supabaseKey) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
    this.headers = {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    };
  }

  // ===== AUTHENTICATION =====

  async signUp(email, password, userData = {}) {
    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/signup`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          email,
          password,
          ...userData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      return await response.json();
    } catch (error) {
      console.error('SignUp error:', error);
      throw error;
    }
  }

  async signIn(email, password) {
    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      const data = await response.json();
      localStorage.setItem('supabase_token', data.access_token);
      return data;
    } catch (error) {
      console.error('SignIn error:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      localStorage.removeItem('supabase_token');
      return true;
    } catch (error) {
      console.error('SignOut error:', error);
      throw error;
    }
  }

  getSession() {
    return localStorage.getItem('supabase_token');
  }

  // ===== DATABASE OPERATIONS =====

  async query(table, options = {}) {
    try {
      let url = `${this.supabaseUrl}/rest/v1/${table}`;

      // Build query string
      const params = new URLSearchParams();
      if (options.select) params.append('select', options.select);
      if (options.where) params.append('where', options.where);
      if (options.order) params.append('order', options.order);
      if (options.limit) params.append('limit', options.limit);
      if (options.offset) params.append('offset', options.offset);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Database query failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  async insert(table, data) {
    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Insert failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Insert error:', error);
      throw error;
    }
  }

  async update(table, id, data) {
    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          ...this.headers,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Update error:', error);
      throw error;
    }
  }

  async delete(table, id) {
    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
        method: 'DELETE',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }

  // ===== USERS TABLE =====

  async getUser(userId) {
    try {
      const result = await this.query('users', {
        select: '*',
        where: `id=eq.${userId}`
      });
      return result[0] || null;
    } catch (error) {
      console.error('Get user error:', error);
      throw error;
    }
  }

  async updateUserProfile(userId, profileData) {
    try {
      return await this.update('users', userId, profileData);
    } catch (error) {
      console.error('Update user profile error:', error);
      throw error;
    }
  }

  // ===== PRODUCTS TABLE =====

  async getProducts(filters = {}) {
    try {
      let query = 'products';
      let where = '';

      if (filters.category) {
        where += `category=eq.${filters.category}`;
      }

      if (filters.search) {
        where += where ? ' and ' : '';
        where += `name.ilike.%${filters.search}%`;
      }

      if (filters.priceMax) {
        where += where ? ' and ' : '';
        where += `price=lte.${filters.priceMax}`;
      }

      const options = {
        select: '*',
        order: filters.sortBy || 'created_at.desc',
        limit: filters.limit || 50
      };

      if (where) options.where = where;

      return await this.query(query, options);
    } catch (error) {
      console.error('Get products error:', error);
      throw error;
    }
  }

  async getProduct(productId) {
    try {
      const result = await this.query('products', {
        select: '*',
        where: `id=eq.${productId}`
      });
      return result[0] || null;
    } catch (error) {
      console.error('Get product error:', error);
      throw error;
    }
  }

  // ===== ORDERS TABLE =====

  async createOrder(userId, orderData) {
    try {
      const order = {
        user_id: userId,
        status: 'pending',
        total_amount: orderData.totalAmount,
        shipping_address: JSON.stringify(orderData.shippingAddress),
        order_items: JSON.stringify(orderData.items),
        created_at: new Date().toISOString()
      };

      return await this.insert('orders', order);
    } catch (error) {
      console.error('Create order error:', error);
      throw error;
    }
  }

  async getOrder(orderId) {
    try {
      const result = await this.query('orders', {
        select: '*',
        where: `id=eq.${orderId}`
      });
      return result[0] || null;
    } catch (error) {
      console.error('Get order error:', error);
      throw error;
    }
  }

  async getUserOrders(userId) {
    try {
      return await this.query('orders', {
        select: '*',
        where: `user_id=eq.${userId}`,
        order: 'created_at.desc'
      });
    } catch (error) {
      console.error('Get user orders error:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId, status) {
    try {
      return await this.update('orders', orderId, {
        status: status,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update order status error:', error);
      throw error;
    }
  }

  // ===== PAYMENTS TABLE =====

  async recordPayment(orderId, paymentData) {
    try {
      const payment = {
        order_id: orderId,
        payment_method: paymentData.method,
        amount: paymentData.amount,
        status: paymentData.status,
        transaction_id: paymentData.transactionId,
        created_at: new Date().toISOString()
      };

      return await this.insert('payments', payment);
    } catch (error) {
      console.error('Record payment error:', error);
      throw error;
    }
  }

  // ===== ENVIRONMENT SECRETS =====

  async getSecret(secretName) {
    try {
      // Call Edge Function to securely retrieve secrets
      const response = await fetch(`${this.supabaseUrl}/functions/v1/get-secret`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Authorization': `Bearer ${this.headers.Authorization}`
        },
        body: JSON.stringify({ secretName })
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve secret');
      }

      const data = await response.json();
      return data.value;
    } catch (error) {
      console.error('Get secret error:', error);
      throw error;
    }
  }

  // ===== REAL-TIME SUBSCRIPTIONS =====

  subscribe(table, callback) {
    // Note: This requires Supabase Realtime to be set up
    // Implementation depends on Supabase client library
    console.log(`Subscribing to ${table} changes`);
    return null;
  }
}

// Initialize Supabase client
const supabase = new SupabaseClient(
  CONFIG.supabaseUrl,
  CONFIG.supabaseKey
);

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SupabaseClient, supabase };
}
