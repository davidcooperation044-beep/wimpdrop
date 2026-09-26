



class EnvConfig {
  constructor() {
    this.vars = {};
    this.isLoaded = false;
    this.isDevelopment = true;
  }


  async load() {
    try {

      if (window.ENV_CONFIG) {
        this.loadFromWindow();
      } else if (this.isDevelopment) {
        await this.loadFromFile();
      }


      this.loadFromWindow();


      this.setDefaults();

      this.isLoaded = true;
      return this.vars;
    } catch (error) {
      console.warn('Failed to load env variables:', error);
      this.setDefaults();
      return this.vars;
    }
  }


  async loadFromFile() {
    try {
      const rootPath = window.location.origin;
      const candidates = [
        '/.env.local',
        `${rootPath}/.env.local`
      ];
      let content = null;

      for (const path of candidates) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            content = await response.text();
            break;
          }
        } catch (e) {

        }
      }

      if (!content) {
        return;
      }


      const lines = content.split('\n');

      lines.forEach(line => {
        line = line.trim();

        if (!line || line.startsWith('#')) return;

        const [key, value] = line.split('=');
        if (key) {
          this.vars[key.trim()] = this.parseValue(value?.trim() || '');
        }
      });

    } catch (error) {
      console.warn('Could not load .env.local:', error.message);
    }
  }


  loadFromWindow() {
    if (window.ENV_CONFIG) {
      this.vars = { ...this.vars, ...window.ENV_CONFIG };
    }
  }


  parseValue(value) {
    if (!value) return '';


    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }


    if (value === 'true') return true;
    if (value === 'false') return false;


    if (!isNaN(value) && value !== '') return Number(value);

    return value;
  }


  setDefaults() {
    const defaults = {
      'VITE_SUPABASE_URL': 'https://your-project.supabase.co',
      'VITE_SUPABASE_ANON_KEY': '',
      'VITE_FLUTTERWAVE_PUBLIC_KEY': '',
      'VITE_APP_NAME': 'Wimp-Drop',
      'VITE_APP_VERSION': '1.0.0',
      'VITE_ENVIRONMENT': 'development',
      'VITE_DEBUG_MODE': false,
      'VITE_LOG_API_CALLS': false,
      'VITE_DEFAULT_CURRENCY': 'NGN',
      'VITE_TAX_RATE': 0.075,
      'VITE_SHIPPING_STANDARD_COST': 5000,
      'VITE_SHIPPING_EXPRESS_COST': 10000,

      'VITE_ENABLE_LOCAL_ADMIN_OVERRIDE': false,
      'VITE_LOCAL_ADMIN_EMAIL': '',
      'VITE_LOCAL_ADMIN_PASSWORD': ''
    };

    Object.keys(defaults).forEach(key => {
      if (!(key in this.vars)) {
        this.vars[key] = defaults[key];
      }
    });
  }


  get(key, defaultValue = null) {
    if (key in this.vars) {
      return this.vars[key];
    }
    return defaultValue;
  }


  getAll() {
    return { ...this.vars };
  }


  isMissing(key) {
    return !this.vars[key] || this.vars[key] === '';
  }


  getMissing() {
    const required = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_FLUTTERWAVE_PUBLIC_KEY'
    ];

    return required.filter(key => this.isMissing(key));
  }


  validate() {
    const missing = this.getMissing();

    if (missing.length > 0) {
      console.warn('⚠️ Missing environment variables:');
      missing.forEach(key => {
        console.warn(`  - ${key}`);
      });
      return false;
    }
    return true;
  }


  printStatus() {
    const missing = this.getMissing();
    return {
      loaded: this.isLoaded,
      environment: this.get('VITE_ENVIRONMENT'),
      app: this.get('VITE_APP_NAME'),
      version: this.get('VITE_APP_VERSION'),
      missing
    };
  }
}


const env = new EnvConfig();


document.addEventListener('DOMContentLoaded', async () => {
  await env.load();
  env.printStatus();
});


if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EnvConfig, env };
}
