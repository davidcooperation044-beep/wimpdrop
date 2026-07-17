// ===== ENVIRONMENT CONFIGURATION LOADER =====
// This module handles loading environment variables and configuration
// For vanilla JS, we read from .env.local or window variables

class EnvConfig {
  constructor() {
    this.vars = {};
    this.isLoaded = false;
    this.isDevelopment = true;
  }

  // Load environment variables
  async load() {
    try {
      // Try to load from .env.local file (development)
      if (this.isDevelopment) {
        await this.loadFromFile();
      }
      
      // Override with window variables if available
      this.loadFromWindow();
      
      // Set defaults for missing values
      this.setDefaults();
      
      this.isLoaded = true;
      return this.vars;
    } catch (error) {
      console.warn('Failed to load env variables:', error);
      this.setDefaults();
      return this.vars;
    }
  }

  // Load from .env.local file (requires file to be served)
  async loadFromFile() {
    try {
      const rootPath = window.location.origin;
      const candidates = [
        '/env.local',
        '/.env.local',
        `${rootPath}/env.local`,
        `${rootPath}/.env.local`
      ];
      let content = null;

      for (const path of candidates) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            content = await response.text();
            console.log(`Loaded env from ${path}`);
            break;
          }
        } catch (e) {
          // ignore and try next
        }
      }

      if (!content) {
        console.log('.env.local not found, using defaults');
        return;
      }

      // content loaded from file
      const lines = content.split('\n');
      
      lines.forEach(line => {
        line = line.trim();
        // Skip comments and empty lines
        if (!line || line.startsWith('#')) return;
        
        const [key, value] = line.split('=');
        if (key) {
          this.vars[key.trim()] = this.parseValue(value?.trim() || '');
        }
      });
      
      console.log('✓ Environment variables loaded from .env.local');
    } catch (error) {
      console.warn('Could not load .env.local:', error.message);
    }
  }

  // Load from window object (set via script tag or console)
  loadFromWindow() {
    if (window.ENV_CONFIG) {
      this.vars = { ...this.vars, ...window.ENV_CONFIG };
    }
  }

  // Parse environment variable value
  parseValue(value) {
    if (!value) return '';
    
    // Handle JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    
    // Handle booleans
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Handle numbers
    if (!isNaN(value) && value !== '') return Number(value);
    
    return value;
  }

  // Set default values
  setDefaults() {
    const defaults = {
      'VITE_SUPABASE_URL': 'https://your-project.supabase.co',
      'VITE_SUPABASE_ANON_KEY': '',
      'VITE_FLUTTERWAVE_PUBLIC_KEY': '',
      'VITE_CJ_API_KEY': '',
      'VITE_CJ_API_URL': 'https://developers.cjdropshipping.com/api2.0/v1',
      'VITE_CJ_STORE_ID': '',
      'VITE_APP_NAME': 'Wimp-Drop',
      'VITE_APP_VERSION': '1.0.0',
      'VITE_ENVIRONMENT': 'development',
      'VITE_DEBUG_MODE': false,
      'VITE_LOG_API_CALLS': false,
      'VITE_DEFAULT_CURRENCY': 'NGN',
      'VITE_TAX_RATE': 0.075,
      'VITE_SHIPPING_STANDARD_COST': 5000,
      'VITE_SHIPPING_EXPRESS_COST': 10000
    };
    
    Object.keys(defaults).forEach(key => {
      if (!(key in this.vars)) {
        this.vars[key] = defaults[key];
      }
    });
  }

  // Get a variable
  get(key, defaultValue = null) {
    if (key in this.vars) {
      return this.vars[key];
    }
    return defaultValue;
  }

  // Get all variables
  getAll() {
    return { ...this.vars };
  }

  // Check if variable is missing
  isMissing(key) {
    return !this.vars[key] || this.vars[key] === '';
  }

  // Get all missing variables
  getMissing() {
    const required = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_FLUTTERWAVE_PUBLIC_KEY',
      'VITE_CJ_API_KEY',
      'VITE_CJ_STORE_ID'
    ];
    
    return required.filter(key => this.isMissing(key));
  }

  // Validate all required variables
  validate() {
    const missing = this.getMissing();
    
    if (missing.length > 0) {
      console.warn('⚠️ Missing environment variables:');
      missing.forEach(key => {
        console.warn(`  - ${key}`);
      });
      console.log('See .env.example for required variables');
      return false;
    }
    
    console.log('✓ All environment variables loaded');
    return true;
  }

  // Print status
  printStatus() {
    console.group('🔧 Environment Configuration');
    console.log('Loaded:', this.isLoaded);
    console.log('Environment:', this.get('VITE_ENVIRONMENT'));
    console.log('App:', this.get('VITE_APP_NAME'), 'v' + this.get('VITE_APP_VERSION'));
    
    const missing = this.getMissing();
    if (missing.length > 0) {
      console.warn('Missing variables:', missing);
    } else {
      console.log('✓ All required variables configured');
    }
    console.groupEnd();
  }
}

// Create global instance
const env = new EnvConfig();

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await env.load();
  env.printStatus();
});

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EnvConfig, env };
}
