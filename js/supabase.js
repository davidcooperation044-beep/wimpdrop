// ===== SUPABASE SERVICE =====
// Fixed version - uses correct Supabase auth endpoints
// and official @supabase/supabase-js SDK loaded via CDN
// Add to every HTML page <head>:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

class SupabaseService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this._initPromise = null;
    this.manualUrl = '';
    this.manualKey = '';
    this.currentUser = null;
  }

  async initialize(supabaseUrl, supabaseKey) {
    if (supabaseUrl) this.manualUrl = supabaseUrl;
    if (supabaseKey) this.manualKey = supabaseKey;
    return this.init();
  }

  // ── Initialize client (called once env is ready) ──
  async init() {
    if (this.isInitialized) return this.client;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise(async (resolve, reject) => {
      // Resolve env/config
      let supabaseUrl = this.manualUrl || '';
      let supabaseKey = this.manualKey || '';

      if (!supabaseUrl && typeof CONFIG !== 'undefined') {
        supabaseUrl = CONFIG.supabaseUrl;
        supabaseKey = CONFIG.supabaseKey;
      }

      if (!supabaseUrl && typeof env !== 'undefined') {
        await env.load();
        supabaseUrl = env.get('VITE_SUPABASE_URL') || '';
        supabaseKey = env.get('VITE_SUPABASE_ANON_KEY') || '';
      }

      if (!supabaseUrl && window.ENV_CONFIG) {
        supabaseUrl = window.ENV_CONFIG.VITE_SUPABASE_URL || '';
        supabaseKey = window.ENV_CONFIG.VITE_SUPABASE_ANON_KEY || '';
      }

      if (!supabaseUrl || !supabaseKey) {
        const msg = 'Supabase URL or Key missing. Realtime mode requires Supabase SDK and keys.';
        console.error('❌ ' + msg);
        this.isInitialized = false;
        reject(new Error(msg));
        return;
      }

      // Require official SDK for realtime-only mode
      if (!(window.supabase && window.supabase.createClient)) {
        const msg = 'Supabase JS SDK not found. Realtime mode requires @supabase/supabase-js v2 loaded via CDN.';
        console.error('❌ ' + msg);
        this.isInitialized = false;
        reject(new Error(msg));
        return;
      }

      try {
        this.client = window.supabase.createClient(supabaseUrl, supabaseKey);
        window._supabase = this.client;
        this.isInitialized = true;
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        this.channels = {};
        console.log('✓ Supabase SDK initialized (realtime-only mode)');
        resolve(this.client);
        return;
      } catch (err) {
        console.error('Failed to initialize Supabase SDK:', err);
        this.isInitialized = false;
        reject(err);
        return;
      }
    });

    window._supabaseReady = this._initPromise;
    return this._initPromise;
  }

  // ── Get initialized client ──
  async getClient() {
    if (!this.isInitialized) await this.init();
    if (!this.client) throw new Error('Supabase client is not initialized. Realtime mode requires the SDK.');
    return this.client;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  // ══════════════════════════════════════
  // AUTHENTICATION
  // ══════════════════════════════════════

  async signUp(email, password, metadata = {}) {
    try {
      const sb = await this.getClient();

      if (sb.auth) {
        // Official SDK path - attempt and gracefully fallback on network/auth fetch errors
        try {
          const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: { data: metadata }
          });
          if (error) throw error;
          if (data?.user) {
            this.currentUser = {
              id: data.user.id,
              email: data.user.email,
              user_metadata: data.user.user_metadata || {}
            };
          }
          return { success: true, user: data.user, session: data.session };
        } catch (sdkErr) {
          // Log detailed SDK error for diagnostics
          console.error('Supabase SDK signUp error:', sdkErr);
          // If it's a fetch/retryable error, fall back to REST endpoint to capture full response
          try {
            const restResp = await fetch(`${this.supabaseUrl}/auth/v1/signup`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': this.supabaseKey,
                'Authorization': `Bearer ${this.supabaseKey}`
              },
              body: JSON.stringify({ email, password, data: metadata })
            });

            const text = await restResp.text();
            let json = null;
            try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }

            if (!restResp.ok) {
              const bodyMsg = json && (json.error_description || json.message || json.error) ? (json.error_description || json.message || json.error) : text;
              const errMsg = `Supabase REST signup failed: ${restResp.status} ${restResp.statusText} - ${bodyMsg}`;
              console.error(errMsg, json || text);
              return { success: false, error: errMsg };
            }

            // Success path for REST fallback
            const user = json?.user || null;
            if (user) {
              this.currentUser = { id: user.id, email: user.email, user_metadata: user.user_metadata || {} };
            }
            return { success: true, user: user, session: json?.session };
          } catch (restErr) {
            console.error('Supabase REST fallback error during signUp:', restErr);
            return { success: false, error: restErr.message || 'AuthRetryableFetchError' };
          }
        }
      }

      // REST fallback
      const response = await fetch(`${this.supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey
        },
        body: JSON.stringify({ email, password, data: metadata })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.msg || result.error_description || 'Signup failed');
      return { success: true, user: result.user };

    } catch (error) {
      console.error('SignUp error:', error);
      return { success: false, error: error.message };
    }
  }

  async signIn(email, password) {
    try {
      const sb = await this.getClient();

      if (sb.auth) {
        // Official SDK path
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (data?.user) {
          this.currentUser = {
            id: data.user.id,
            email: data.user.email,
            user_metadata: data.user.user_metadata || {}
          };
          if (typeof AppState !== 'undefined') {
            AppState.user = {
              id: data.user.id,
              email: data.user.email,
              fullName: data.user.user_metadata?.full_name || '',
              phone: data.user.user_metadata?.phone || ''
            };
          }
          if (typeof updateUserUI === 'function') updateUserUI();
        }

        return { success: true, user: data.user, session: data.session };
      }

      // REST fallback
      const response = await fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();
      if (!response.ok) {
        const message = result.error_description || result.error || result.message || 'Login failed';
        throw new Error(message);
      }

      localStorage.setItem('supabase_token', result.access_token);
      localStorage.setItem('supabase_refresh_token', result.refresh_token || '');

      if (result.user) {
        this.currentUser = {
          id: result.user.id,
          email: result.user.email,
          user_metadata: result.user.user_metadata || {}
        };
        if (typeof AppState !== 'undefined') {
          AppState.user = {
            id: result.user.id,
            email: result.user.email,
            fullName: result.user.user_metadata?.full_name || '',
            phone: result.user.user_metadata?.phone || ''
          };
        }
      }

      return { success: true, user: result.user };

    } catch (error) {
      console.error('SignIn error:', error);
      const msg = error.message?.includes('Invalid login credentials')
        ? 'Wrong email or password. Please try again.'
        : error.message || 'Login failed';
      return { success: false, error: msg };
    }
  }

  async signOut() {
    try {
      const sb = await this.getClient();

      if (sb.auth) {
        await sb.auth.signOut();
      } else {
        localStorage.removeItem('supabase_token');
        localStorage.removeItem('supabase_refresh_token');
      }

      this.currentUser = null;
      if (typeof AppState !== 'undefined') {
        AppState.user = null;
        AppState.cart = [];
        AppState.wishlist = [];
      }

      if (typeof updateUserUI === 'function') updateUserUI();
      if (typeof updateCartBadge === 'function') updateCartBadge();
      return { success: true };

    } catch (error) {
      console.error('SignOut error:', error);
      return { success: false, error: error.message };
    }
  }

  async signInWithGoogle() {
    return this.signInWithProvider('google');
  }

  async signInWithProvider(provider) {
    try {
      const sb = await this.getClient();
      if (!sb.auth) throw new Error('Social login requires Supabase SDK');

      const validProvider = provider.toLowerCase();
      const { error } = await sb.auth.signInWithOAuth({
        provider: validProvider,
        options: {
          redirectTo: `${window.location.origin}/pages/account.html`
        }
      });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Social SignIn error:', error);
      return { success: false, error: error.message };
    }
  }

  async resetPassword(email) {
    try {
      const sb = await this.getClient();
      if (!sb.auth) throw new Error('Password reset requires Supabase SDK');

      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/pages/reset-password.html`
      });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: error.message };
    }
  }

  async getSession() {
    try {
      const sb = await this.getClient();
      if (sb.auth) {
        const { data: { session } } = await sb.auth.getSession();
        return session;
      }
      const token = localStorage.getItem('supabase_token');
      return token ? { access_token: token } : null;
    } catch (error) {
      return null;
    }
  }

  async restoreSession() {
    try {
      const sb = await this.getClient();
      if (!sb.auth) return;

      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        this.currentUser = {
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata || {}
        };
        if (typeof AppState !== 'undefined') {
          AppState.user = {
            id: session.user.id,
            email: session.user.email,
            fullName: session.user.user_metadata?.full_name || '',
            phone: session.user.user_metadata?.phone || ''
          };
        }
        if (typeof updateUserUI === 'function') updateUserUI();
      }

      // Listen for auth changes
      sb.auth.onAuthStateChange((_event, session) => {
        if (typeof AppState === 'undefined') return;
        if (session?.user) {
          this.currentUser = {
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata || {}
          };
          AppState.user = {
            id: session.user.id,
            email: session.user.email,
            fullName: session.user.user_metadata?.full_name || '',
            phone: session.user.user_metadata?.phone || ''
          };
        } else {
          this.currentUser = null;
          AppState.user = null;
        }
        if (typeof updateUserUI === 'function') updateUserUI();
      });

    } catch (error) {
      console.error('Restore session error:', error);
    }
  }

  // ══════════════════════════════════════
  // DATABASE OPERATIONS
  // ══════════════════════════════════════

  getPublicProductSelectColumns() {
    return [
      'id',
      'title',
      'image_url',
      'sku',
      'variant',
      'shipping_from',
      'inventory_raw',
      'stock',
      'cj_inventory_total',
      'factory_inventory_total',
      'my_inventory_total',
      'cn_warehouse_cj_inventory',
      'us_warehouse_cj_inventory',
      'us_warehouse_verified_factory_inventory',
      'cn_warehouse_unverified_factory_inventory',
      'price',
      'added_time',
      'price_updated',
      'price_change',
      'price_update_time',
      'dimensions_mm',
      'weight_g',
      'packing_weight_g',
      'pickup_supported',
      'status',
      'is_published',
      'created_at',
      'updated_at'
    ].join(',');
  }

  async getProducts(filters = {}) {
    try {
      const sb = await this.getClient();
      const selectColumns = this.getPublicProductSelectColumns();
      const sortField = filters.sortBy === 'newest' ? 'added_time' : filters.sortBy === 'price-low' ? 'price' : filters.sortBy;
      const includeUnpublished = filters.includeUnpublished === true;

      if (sb.from) {
        const buildQuery = ({ withSort = true } = {}) => {
          let query = sb.from('products').select(selectColumns);
          if (!includeUnpublished) {
            query = query.eq('is_published', true);
          }
          if (filters.search) {
            query = query.or(`title.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,variant.ilike.%${filters.search}%`);
          }
          if (filters.priceMax) query = query.lte('price', filters.priceMax);
          if (filters.limit) query = query.limit(filters.limit);
          if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 12) - 1);
          if (withSort && sortField) {
            query = query.order(sortField, { ascending: filters.sortAsc !== false });
          }
          return query;
        };

        const executeQuery = async (query) => {
          const { data, error, count } = await query;
          if (error) throw error;
          return { success: true, products: data || [], count };
        };

        try {
          return await executeQuery(buildQuery({ withSort: true }));
        } catch (error) {
          if (filters.sortBy && /order.*does not exist/i.test(error.message)) {
            return await executeQuery(buildQuery({ withSort: false }));
          }
          throw error;
        }
      }

      const buildUrl = (includeOrder = !!filters.sortBy) => {
        let url = `${this.supabaseUrl}/rest/v1/products?select=${encodeURIComponent(selectColumns)}`;
        if (!includeUnpublished) {
          url += '&is_published=eq.true';
        }
        if (filters.search) {
          url += `&or=(title.ilike.%${encodeURIComponent(filters.search)}%,sku.ilike.%${encodeURIComponent(filters.search)}%,variant.ilike.%${encodeURIComponent(filters.search)}%)`;
        }
        if (filters.priceMax) url += `&price=lte.${filters.priceMax}`;
        if (filters.limit) url += `&limit=${filters.limit}`;
        if (filters.offset) url += `&offset=${filters.offset}`;
        if (includeOrder && sortField) url += `&order=${encodeURIComponent(`${sortField}.${filters.sortAsc === false ? 'asc' : 'desc'}`)}`;
        return url;
      };

      const response = await fetch(buildUrl(!!filters.sortBy), {
        headers: { ...this.headers, 'Prefer': 'count=exact' }
      });
      const data = await response.json();
      return { success: true, products: Array.isArray(data) ? data : [] };
    } catch (error) {
      console.error('Get products error:', error);
      return { success: false, products: [], error: error.message };
    }
  }

  async getProduct(productId, filters = {}) {
    try {
      const sb = await this.getClient();
      const selectColumns = this.getPublicProductSelectColumns();
      const includeUnpublished = filters.includeUnpublished === true;
      if (sb.from) {
        let query = sb.from('products').select(selectColumns).eq('id', productId);
        if (!includeUnpublished) {
          query = query.eq('is_published', true);
        }
        const { data, error } = await query.single();
        if (error) throw error;
        return { success: true, product: data };
      }

      let url = `${this.supabaseUrl}/rest/v1/products?id=eq.${productId}&select=${encodeURIComponent(selectColumns)}`;
      if (!includeUnpublished) {
        url += '&is_published=eq.true';
      }
      const response = await fetch(url, { headers: this.headers });
      const data = await response.json();
      return { success: true, product: data[0] || null };
    } catch (error) {
      console.error('Get product error:', error);
      return { success: false, product: null, error: error.message };
    }
  }

  async getProductVariants(productIdentifier, filters = {}) {
    try {
      const sb = await this.getClient();
      const selectColumns = this.getPublicProductSelectColumns();
      const includeUnpublished = filters.includeUnpublished === true;
      if (sb.from) {
        let query = sb.from('products').select(selectColumns);
        if (!includeUnpublished) {
          query = query.eq('is_published', true);
        }
        if (productIdentifier) {
          const identifier = String(productIdentifier).trim();
          if (identifier.length === 36 && identifier.includes('-')) {
            query = query.eq('id', identifier);
          } else {
            query = query.or(`sku.eq.${identifier},title.eq.${identifier}`);
          }
        }
        const { data, error } = await query.order('added_time', { ascending: false });
        if (error) throw error;
        return { success: true, products: data || [] };
      }

      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/products?is_published=eq.true&select=${encodeURIComponent(selectColumns)}`,
        { headers: this.headers }
      );
      const data = await response.json();
      return { success: true, products: Array.isArray(data) ? data : [] };
    } catch (error) {
      console.error('Get product variants error:', error);
      return { success: false, products: [], error: error.message };
    }
  }

  async createOrder(orderData) {
    try {
      const sb = await this.getClient();
      const session = await this.getSession();

      const order = {
        user_id: session?.user?.id || null,
        items: orderData.items,
        total_amount: orderData.totalAmount,
        shipping_address: orderData.shippingAddress,
        shipping_method: orderData.shippingMethod || 'standard',
        shipping_cost: orderData.shippingCost || 0,
        payment_ref: orderData.paymentRef || '',
        status: 'pending',
        country: orderData.shippingAddress?.country || 'NG'
      };

      if (sb.from) {
        const { data, error } = await sb.from('orders').insert(order).select().single();
        if (error) throw error;
        return { success: true, order: data };
      }

      const response = await fetch(`${this.supabaseUrl}/rest/v1/orders`, {
        method: 'POST',
        headers: { ...this.headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(order)
      });
      const data = await response.json();
      return { success: true, order: Array.isArray(data) ? data[0] : data };

    } catch (error) {
      console.error('Create order error:', error);
      return { success: false, error: error.message };
    }
  }

  async getOrder(orderId) {
    try {
      const sb = await this.getClient();
      if (sb.from) {
        const { data, error } = await sb.from('orders').select('*').eq('id', orderId).single();
        if (error) throw error;
        return { success: true, order: data };
      }

      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/orders?id=eq.${orderId}&select=*`,
        { headers: this.headers }
      );
      const data = await response.json();
      return { success: true, order: data[0] || null };
    } catch (error) {
      return { success: false, order: null, error: error.message };
    }
  }

  async getUserOrders() {
    try {
      const sb = await this.getClient();
      const session = await this.getSession();
      if (!session) return { success: false, orders: [] };

      const userId = session.user?.id;
      if (!userId) return { success: false, orders: [] };

      if (sb.from) {
        const { data, error } = await sb.from('orders')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return { success: true, orders: data || [] };
      }

      const token = localStorage.getItem('supabase_token');
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/orders?user_id=eq.${userId}&select=*&order=created_at.desc`,
        { headers: { ...this.headers, 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      return { success: true, orders: Array.isArray(data) ? data : [] };
    } catch (error) {
      return { success: false, orders: [], error: error.message };
    }
  }

  async getUserProfile() {
    try {
      const sb = await this.getClient();
      const session = await this.getSession();
      if (!session) return { success: false, profile: null };

      const userId = session.user?.id;
      if (sb.from) {
        const { data, error } = await sb.from('user_profiles').select('*').eq('id', userId).single();
        if (error && error.code !== 'PGRST116') throw error;
        return { success: true, profile: data };
      }
      return { success: false, profile: null };
    } catch (error) {
      return { success: false, profile: null, error: error.message };
    }
  }

  async updateUserProfile(profileData) {
    try {
      const sb = await this.getClient();
      const session = await this.getSession();
      if (!session) return { success: false };

      const userId = session.user?.id;
      if (sb.from) {
        const { data, error } = await sb.from('user_profiles')
          .upsert({ id: userId, ...profileData })
          .select().single();
        if (error) throw error;
        return { success: true, profile: data };
      }
      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  normalizeAddress(address) {
    if (!address) return null;
    return {
      id: address.id || '',
      label: address.label || '',
      recipient: address.recipient || '',
      line1: address.line1 || '',
      line2: address.line2 || '',
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postal_code || address.postalCode || '',
      country: address.country || '',
      phone: address.phone || '',
      isDefault: Boolean(address.is_default ?? address.isDefault),
      createdAt: address.created_at || address.createdAt || null
    };
  }

  async getUserAddresses() {
    try {
      const sb = await this.getClient();
      const session = await this.getSession();
      if (!session) return { success: false, addresses: [] };

      const userId = session.user?.id;
      if (sb.from) {
        const { data, error } = await sb.from('user_addresses')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return {
          success: true,
          addresses: (data || []).map((address) => this.normalizeAddress(address))
        };
      }
      return { success: false, addresses: [] };
    } catch (error) {
      return { success: false, addresses: [], error: error.message };
    }
  }

  async saveUserAddress(addressData) {
    try {
      const sb = await this.getClient();
      const session = await this.getSession();
      if (!session) return { success: false };

      const userId = session.user?.id;
      if (!userId) return { success: false };

      const payload = {
        id: addressData.id || `address-${Date.now()}`,
        user_id: userId,
        label: addressData.label || '',
        recipient: addressData.recipient || '',
        line1: addressData.line1 || '',
        line2: addressData.line2 || '',
        city: addressData.city || '',
        state: addressData.state || '',
        postal_code: addressData.postalCode || '',
        country: addressData.country || '',
        phone: addressData.phone || '',
        is_default: Boolean(addressData.isDefault)
      };

      if (sb.from) {
        if (payload.is_default) {
          await sb.from('user_addresses').update({ is_default: false }).eq('user_id', userId);
        }
        const { data, error } = await sb.from('user_addresses')
          .upsert(payload)
          .select()
          .single();
        if (error) throw error;
        return { success: true, address: this.normalizeAddress(data) };
      }
      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteUserAddress(addressId) {
    try {
      const sb = await this.getClient();
      const session = await this.getSession();
      if (!session) return { success: false };

      const userId = session.user?.id;
      if (sb.from) {
        const { error } = await sb.from('user_addresses')
          .delete()
          .eq('id', addressId)
          .eq('user_id', userId);
        if (error) throw error;
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setDefaultUserAddress(addressId) {
    try {
      const sb = await this.getClient();
      const session = await this.getSession();
      if (!session) return { success: false };

      const userId = session.user?.id;
      if (sb.from) {
        await sb.from('user_addresses').update({ is_default: false }).eq('user_id', userId);
        const { data, error } = await sb.from('user_addresses')
          .update({ is_default: true })
          .eq('id', addressId)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        return { success: true, address: this.normalizeAddress(data) };
      }
      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getWishlist() {
    try {
      const sb = await this.getClient();
      const session = await this.getSession();
      if (!session) return { success: false, items: [] };

      const userId = session.user?.id;
      if (sb.from) {
        const { data, error } = await sb.from('wishlist')
          .select('product_id, products(*)')
          .eq('user_id', userId);
        if (error) throw error;
        return { success: true, items: data || [] };
      }
      return { success: false, items: [] };
    } catch (error) {
      return { success: false, items: [], error: error.message };
    }
  }

  async addToWishlist(productId) {
    try {
      const sb = await this.getClient();
      const session = await this.getSession();
      if (!session) return { success: false };

      if (sb.from) {
        const { error } = await sb.from('wishlist').upsert({
          user_id: session.user.id,
          product_id: productId
        });
        if (error) throw error;
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async removeFromWishlist(productId) {
    try {
      const sb = await this.getClient();
      const session = await this.getSession();
      if (!session) return { success: false };

      if (sb.from) {
        const { error } = await sb.from('wishlist')
          .delete()
          .eq('user_id', session.user.id)
          .eq('product_id', productId);
        if (error) throw error;
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async subscribeNewsletter(email, country = '') {
    try {
      const sb = await this.getClient();
      if (sb.from) {
        const { error } = await sb.from('newsletter_subscribers')
          .upsert({ email, country });
        if (error && !error.message?.includes('duplicate')) throw error;
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPromoCode(code) {
    try {
      const sb = await this.getClient();
      if (sb.from) {
        const { data, error } = await sb.from('promo_codes')
          .select('*')
          .eq('code', code.toUpperCase())
          .eq('is_active', true)
          .single();
        if (error) return { success: false, promoCode: null, error: 'Promo code not found' };

        // Check expiry
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          return { success: false, promoCode: null, error: 'Promo code has expired' };
        }

        return { success: true, promoCode: data };
      }
      return { success: false, promoCode: null, error: 'Promo service unavailable' };
    } catch (error) {
      return { success: false, promoCode: null, error: error.message };
    }
  }

  async checkPromoCode(code) {
    return this.getPromoCode(code);
  }

  async isUserAdmin(userId) {
    try {
      const sb = await this.getClient();
      if (!userId) return { success: false, isAdmin: false };

      if (sb.from) {
        const { data, error } = await sb.from('user_profiles')
          .select('is_admin')
          .eq('id', userId)
          .single();
        if (error) {
          return { success: true, isAdmin: false };
        }
        return { success: true, isAdmin: Boolean(data?.is_admin) };
      }

      const session = await this.getSession();
      const isAdmin = session?.user?.user_metadata?.role === 'admin';
      return { success: true, isAdmin: Boolean(isAdmin) };
    } catch (error) {
      return { success: false, isAdmin: false, error: error.message };
    }
  }

  // ── Realtime subscriptions ──
  subscribe(table, callback, opts = {}) {
    if (!this.isInitialized || !this.client) throw new Error('Supabase client not initialized. Cannot subscribe.');
    const channelName = `table:${table}`;
    if (this.channels[channelName]) {
      // already subscribed
      return this.channels[channelName];
    }

    const filter = opts.filter || null; // optional filter for postgres_changes
    const match = filter ? { schema: 'public', table, filter } : { schema: 'public', table };

    const channel = this.client.channel(channelName, { config: {}})
      .on('postgres_changes', match, (payload) => {
        try {
          callback(payload);
        } catch (e) {
          console.error('Realtime callback error:', e);
        }
      }).subscribe();

    this.channels[channelName] = channel;
    return channel;
  }

  unsubscribe(table) {
    const channelName = `table:${table}`;
    const ch = this.channels[channelName];
    if (!ch) return;
    try {
      ch.unsubscribe();
    } catch (e) {
      console.warn('Failed to unsubscribe channel', channelName, e);
    }
    delete this.channels[channelName];
  }

  unsubscribeAll() {
    Object.keys(this.channels).forEach(name => {
      try { this.channels[name].unsubscribe(); } catch (e) { /* ignore */ }
      delete this.channels[name];
    });
  }
}

// ── Create singleton ──
const supabaseService = new SupabaseService();

// ── Initialize on page load ──
document.addEventListener('DOMContentLoaded', async () => {
  window._supabaseReady = supabaseService.init();
  await window._supabaseReady;
  await supabaseService.restoreSession();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SupabaseService, supabaseService };
}