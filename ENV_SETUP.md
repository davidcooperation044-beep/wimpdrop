# Environment Setup Guide

## Quick Setup (2 minutes)

### Option 1: Using .env.local File (Recommended for Development)

1. **Copy the template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit .env.local** and add your credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-key-here
   VITE_FLUTTERWAVE_PUBLIC_KEY=your-key-here
   VITE_CJ_API_KEY=your-key-here
   ```

3. **File is automatically loaded** - The app reads .env.local on startup

### Option 2: Set in Browser Console (Quick Testing)

In browser DevTools console:
```javascript
window.ENV_CONFIG = {
  'VITE_SUPABASE_URL': 'https://your-project.supabase.co',
  'VITE_SUPABASE_ANON_KEY': 'your-key-here',
  'VITE_FLUTTERWAVE_PUBLIC_KEY': 'your-key-here',
  'VITE_CJ_API_KEY': 'your-key-here'
};

// Then reload page
location.reload();
```

### Option 3: Production Environment Variables

For Vercel/Netlify, set in deployment platform:
- Go to Settings → Environment Variables
- Add each VITE_* variable
- They're automatically injected at build time

---

## Getting Your API Keys

### Supabase
1. Go to [supabase.com](https://supabase.com)
2. Sign up / Log in
3. Create new project
4. Go to Settings → API
5. Copy:
   - **VITE_SUPABASE_URL** = Project URL
   - **VITE_SUPABASE_ANON_KEY** = anon public key

### Flutterwave
1. Go to [flutterwave.com](https://flutterwave.com)
2. Sign up / Log in
3. Go to Settings → API Keys
4. Copy:
   - **VITE_FLUTTERWAVE_PUBLIC_KEY** = Public Key (test or live)

### CJ Dropshipping
1. Go to [developers.cjdropshipping.com](https://developers.cjdropshipping.com)
2. Sign up / Log in
3. Create API credentials
4. Copy:
   - **VITE_CJ_API_KEY** = API Key

---

## Verify Setup

### Check if Environment is Loaded

Open browser console (F12):
```javascript
// Check if env is loaded
env.printStatus();

// Get all variables
env.getAll();

// Check for missing variables
env.getMissing();

// Get a specific variable
env.get('VITE_SUPABASE_URL');
```

### Look for Errors

If you see warnings in console like:
```
⚠️ Missing environment variables:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY
```

You need to add those variables to .env.local or set them in the console.

---

## Security

### What NOT to Do
❌ Don't commit .env to git (it's in .gitignore)
❌ Don't share your secret keys
❌ Don't put service role keys in frontend
❌ Don't log keys to console in production

### What to Do
✅ Keep .env.local private (in .gitignore)
✅ Use test keys during development
✅ Use environment variables in production
✅ Keep service keys on backend only

---

## All Available Variables

### Required
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `VITE_FLUTTERWAVE_PUBLIC_KEY` - Flutterwave public key
- `VITE_CJ_API_KEY` - CJ Dropshipping API key

### Optional
- `VITE_ENVIRONMENT` - 'development' or 'production' (default: development)
- `VITE_DEBUG_MODE` - true/false (default: false)
- `VITE_LOG_API_CALLS` - true/false (default: false)
- `VITE_DEFAULT_CURRENCY` - Currency code (default: NGN)
- `VITE_TAX_RATE` - Tax rate decimal (default: 0.10)
- `VITE_SHIPPING_STANDARD_COST` - Standard shipping (default: 9.99)
- `VITE_SHIPPING_EXPRESS_COST` - Express shipping (default: 19.99)

---

## Development vs Production

### Development (.env.local)
- Use test API keys
- Enable DEBUG_MODE for logging
- Set ENVIRONMENT=development

### Production (Deployment Platform)
- Use live API keys
- Disable DEBUG_MODE
- Set ENVIRONMENT=production
- Never expose service role keys

---

## Troubleshooting

### Variables Not Loading?
1. Check .env.local exists in project root
2. Check file has correct format: `KEY=value`
3. Reload page (Ctrl+R or Cmd+R)
4. Check browser console for errors

### Can't Access API?
1. Check VITE_SUPABASE_URL is correct
2. Check VITE_SUPABASE_ANON_KEY matches project
3. Verify Supabase project is active
4. Check browser console for API errors

### Payment Not Working?
1. Check VITE_FLUTTERWAVE_PUBLIC_KEY is correct
2. Verify Flutterwave account is active
3. Check test vs live keys
4. Look for errors in browser console

---

## File Structure

```
wimp-drop/
├── .env.example          ← Template (safe to commit)
├── .env.local            ← Your credentials (NEVER commit)
├── .gitignore            ← Prevents committing .env
├── js/
│   ├── env.js            ← Environment loader
│   ├── main.js           ← Uses env variables
│   └── api/
├── index.html
└── ...
```

---

## Quick Commands

```bash
# Copy template to local
cp .env.example .env.local

# View current environment
cat .env.local

# Check what's missing
# (In browser console: env.getMissing())
```

---

## Need Help?

1. **Check the docs** - QUICK_START.md, README.md
2. **Read the code comments** - js/env.js is well documented
3. **Check browser console** - Errors show there
4. **Use env.printStatus()** - See what's loaded

---

**Environment configuration is ready! Add your keys to .env.local and you're good to go.** 🚀
