# Environment Configuration Debugging Guide

## Quick Diagnostics

### Check 1: Is env.js loaded?

Open browser console (F12) and type:
```javascript
typeof env
```

**Expected:** `"object"`

**If you see:** `"undefined"`
- Add `<script src="js/env.js"></script>` to your HTML head
- Check file path is correct
- Reload page

---

### Check 2: Are variables loaded?

```javascript
env.isLoaded
```

**Expected:** `true` (after page loads)

**If false:**
- Check network tab (F12 → Network) for .env.local load failures
- Make sure .env.local exists in project root
- Check browser console for error messages

---

### Check 3: Print Full Status

```javascript
env.printStatus()
```

**This will show:**
- Environment loaded status
- Current environment (development/production)
- App name and version
- Missing variables list

---

### Check 4: List All Variables

```javascript
env.getAll()
```

Returns object with all loaded variables. Check if your keys are there.

---

### Check 5: Find Missing Variables

```javascript
env.getMissing()
```

**Example output:**
```javascript
['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
```

These are required for app to work.

---

## Common Issues & Solutions

### ❌ "Missing environment variables"

**Symptoms:**
- Warning in console about missing variables
- App features not working
- Can't log in or make payments

**Solution:**
```bash
# 1. Create .env.local
cp .env.example .env.local

# 2. Edit and add your credentials
nano .env.local  # or use your editor

# 3. Reload page
```

---

### ❌ .env.local Not Found

**Symptoms:**
- Warning: "Could not load .env.local"
- Variables show as defaults

**Solution:**
```bash
# 1. Check file exists
ls -la .env.local  # Linux/Mac
dir .env.local     # Windows

# 2. Create if missing
cp .env.example .env.local

# 3. Verify permissions
chmod 644 .env.local  # Linux/Mac

# 4. Reload page
```

---

### ❌ Variables Not Updating

**Symptoms:**
- Changed .env.local but not seeing changes
- Old values still showing

**Solution:**
```javascript
// 1. Clear cache
location.reload()      // Soft reload

// 2. If that doesn't work
Ctrl+Shift+R          // Hard reload (Windows/Linux)
Cmd+Shift+R           // Hard reload (Mac)

// 3. Manual override (for testing)
window.ENV_CONFIG = {
  'VITE_SUPABASE_URL': 'https://new-url.supabase.co'
};
location.reload();
```

---

### ❌ File Format Wrong

**Symptoms:**
- Blank values
- Variables undefined
- Parse errors

**Check .env.local format:**
```env
# ✅ CORRECT
VITE_SUPABASE_URL=https://example.supabase.co
VITE_SUPABASE_ANON_KEY=abc123xyz789

# ❌ WRONG - No quotes around values
VITE_SUPABASE_URL="https://example.supabase.co"

# ❌ WRONG - Spaces around =
VITE_SUPABASE_URL = https://example.supabase.co

# ❌ WRONG - Missing value
VITE_SUPABASE_URL=
```

---

### ❌ API Keys Not Working

**Symptoms:**
- "Invalid API key" errors
- API calls failing 401/403

**Debug steps:**
```javascript
// 1. Check value is correct
env.get('VITE_SUPABASE_URL')
env.get('VITE_SUPABASE_ANON_KEY')

// 2. Check it's not surrounded by quotes
env.get('VITE_SUPABASE_URL').includes('"')  // Should be false

// 3. Verify format
// Should start with: https://
// Key should be long string without quotes

// 4. Check against dashboard
// Copy-paste directly from dashboard to .env.local
```

---

### ❌ Production Deployment Broken

**Symptoms:**
- Works locally but not on deployed site
- Blank screen or API errors
- 400/500 errors

**Solution:**
1. Check environment variables set in deployment platform:
   - Vercel: Settings → Environment Variables
   - Netlify: Settings → Build & Deploy → Environment
   - GitHub Pages: Settings → Secrets → Actions

2. Verify all required variables are set:
   ```javascript
   // In browser console on deployed site
   env.getMissing()
   ```

3. Check for typos in variable names

4. Redeploy after setting variables

---

## Advanced Debugging

### View Raw .env.local Content

```javascript
// Load and display file content
fetch('.env.local')
  .then(r => r.text())
  .then(text => console.log(text))
```

### Check Environment in Code

```javascript
// Anywhere in your JavaScript
if (CONFIG.isDevelopment) {
  console.log('Running in development mode');
  console.log('Debug mode:', CONFIG.debugMode);
}

// In API modules
if (env.get('VITE_DEBUG_MODE')) {
  console.log('API Call:', url);
  console.log('Response:', data);
}
```

### Validate Before Using

```javascript
// In js/api/supabase.js
if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
  console.error('❌ Supabase not configured');
  console.error('Missing:', [
    !CONFIG.supabaseUrl && 'VITE_SUPABASE_URL',
    !CONFIG.supabaseKey && 'VITE_SUPABASE_ANON_KEY'
  ].filter(Boolean));
  return null;
}
```

---

## Testing Checklist

### Before Deployment

- [ ] Run `env.printStatus()` in console
- [ ] Verify no warnings about missing variables
- [ ] Test add to cart
- [ ] Test login
- [ ] Test payment (use test keys!)
- [ ] Check browser console for errors
- [ ] Test on mobile view

### Before Production Switch

- [ ] Replace test keys with production keys
- [ ] Set deployment environment variables
- [ ] Set `VITE_ENVIRONMENT=production`
- [ ] Disable `VITE_DEBUG_MODE`
- [ ] Test on deployed site
- [ ] Monitor console for errors

---

## Emergency Reset

If everything is broken:

### Option 1: Reload Page
```javascript
location.reload()
```

### Option 2: Clear Variables & Reload
```javascript
// Clear everything
delete window.ENV_CONFIG;

// Reset env
window.location.reload();
```

### Option 3: Use Defaults
```javascript
// Manually set empty .env.local
echo "" > .env.local

# Then reload page
# App will use all defaults
```

---

## Getting Help

### 1. Check Console for Errors

```javascript
// Read all console logs
// Look for:
// - Red errors
// - Yellow warnings
// - Undefined variables
```

### 2. Print Configuration

```javascript
env.printStatus()
env.getAll()
env.getMissing()
```

### 3. Check Files

- Is `.env.local` in root directory? (Not in subdirectories)
- Does it have correct format? (`KEY=value` on each line)
- Do values match your actual API keys?

### 4. Test Variables

```javascript
// Test each one
env.get('VITE_SUPABASE_URL')      // Should return URL
env.get('VITE_SUPABASE_ANON_KEY') // Should return key
env.get('VITE_FLUTTERWAVE_PUBLIC_KEY')  // Should return key

// Any showing empty or "undefined"?
// That's what you need to fix!
```

---

## Performance Notes

- env.js loads asynchronously on page load
- Variables available after `DOMContentLoaded` event
- Takes <1ms to load (no performance impact)
- Cached in memory after first load

---

## Security Checklist

- [ ] .env.local in .gitignore? (don't commit it!)
- [ ] Production keys never in .env.local? (use platform settings)
- [ ] No API keys logged to console in production?
- [ ] Service role keys on backend only?
- [ ] Regular key rotation? (monthly or quarterly)

---

**Still stuck? Check the main documentation in ENV_SETUP.md or README.md** 📖
