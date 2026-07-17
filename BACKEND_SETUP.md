# WIMP-DROP PLATFORM - BACKEND SETUP & INTEGRATION GUIDE

## Overview
Wimp-Drop is a full-stack dropshipping eCommerce platform built with:
- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Payments**: Flutterwave
- **Product Sourcing**: CJ Dropshipping API

## Table of Contents
1. [Supabase Setup](#supabase-setup)
2. [Environment Variables](#environment-variables)
3. [Database Schema](#database-schema)
4. [Edge Functions](#edge-functions)
5. [CJ Dropshipping Integration](#cj-dropshipping-integration)
6. [Flutterwave Integration](#flutterwave-integration)
7. [Deployment](#deployment)

---

## Supabase Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Choose your region (closest to your users)
4. Create database with strong password

### 2. Get Your Credentials
In Supabase Dashboard:
- Go to **Settings > API**
- Copy **Project URL** → `SUPABASE_URL`
- Copy **anon public** key → `SUPABASE_ANON_KEY`
- Copy **Service Role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

### 3. Enable Authentication
1. Go to **Authentication > Providers**
2. Enable Email/Password (default)
3. Optional: Enable Google, Facebook OAuth

### 4. Create Tables

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Products Table
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  image_url TEXT,
  images JSONB,
  variants JSONB,
  cj_product_id TEXT,
  supplier TEXT DEFAULT 'CJ Dropshipping',
  stock_quantity INTEGER,
  rating DECIMAL(3,2) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_category (category),
  INDEX idx_cj_product_id (cj_product_id)
);
```

#### Orders Table
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  order_number TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  total_amount DECIMAL(10,2),
  shipping_cost DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  shipping_address JSONB,
  billing_address JSONB,
  order_items JSONB,
  cj_order_id TEXT,
  tracking_number TEXT,
  carrier TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_cj_order_id (cj_order_id)
);
```

#### Payments Table
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  user_id UUID REFERENCES users(id),
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'NGN',
  payment_method TEXT,
  payment_status TEXT,
  flutterwave_ref TEXT,
  transaction_id TEXT,
  receipt_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_order_id (order_id),
  INDEX idx_flutterwave_ref (flutterwave_ref)
);
```

#### Wishlist Table
```sql
CREATE TABLE wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  product_id UUID REFERENCES products(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, product_id),
  INDEX idx_user_id (user_id)
);
```

#### Reviews Table
```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  user_id UUID REFERENCES users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_product_id (product_id),
  INDEX idx_user_id (user_id)
);
```

### 5. Row Level Security (RLS)

Enable RLS on all tables for security:

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can only view/update their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Everyone can view products
CREATE POLICY "Products are viewable by everyone" ON products
  FOR SELECT USING (is_active = true);

-- Users can view their own orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);
```

---

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# CJ Dropshipping
CJ_API_KEY=your-cj-api-key
CJ_API_SECRET=your-cj-api-secret

# Flutterwave
VITE_FLUTTERWAVE_PUBLIC_KEY=your-flutterwave-public-key
FLUTTERWAVE_SECRET_KEY=your-flutterwave-secret-key

# Backend
BACKEND_URL=http://localhost:3000
```

Store sensitive keys in Supabase **Settings > Secrets**:
- `CJ_API_KEY`
- `FLUTTERWAVE_SECRET_KEY`

---

## Edge Functions

Supabase Edge Functions allow server-side operations to keep API keys secret.

### 1. Setup Edge Functions
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref
```

### 2. Create Functions

#### `supabase/functions/cj-proxy/index.ts`
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CJ_API_KEY = Deno.env.get("CJ_API_KEY");
const CJ_API_SECRET = Deno.env.get("CJ_API_SECRET");

serve(async (req) => {
  const { action, payload } = await req.json();

  const headers = {
    "Authorization": `Bearer ${CJ_API_KEY}`,
    "Content-Type": "application/json"
  };

  try {
    let url = "";
    let method = "GET";
    let body = null;

    switch(action) {
      case "search-products":
        url = "https://developers.cjdropshipping.com/api2.0/v1/search";
        method = "POST";
        body = payload;
        break;
      case "get-product":
        url = `https://developers.cjdropshipping.com/api2.0/v1/product/${payload.productId}`;
        break;
      case "create-order":
        url = "https://developers.cjdropshipping.com/api2.0/v1/order/create";
        method = "POST";
        body = payload;
        break;
    }

    const options: RequestInit = {
      method,
      headers
    };

    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
```

#### `supabase/functions/flutterwave-proxy/index.ts`
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FLUTTERWAVE_SECRET_KEY = Deno.env.get("FLUTTERWAVE_SECRET_KEY");

serve(async (req) => {
  const { action, payload } = await req.json();

  const headers = {
    "Authorization": `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
    "Content-Type": "application/json"
  };

  try {
    let url = "";
    let method = "GET";

    switch(action) {
      case "verify":
        url = `https://api.flutterwave.com/v3/transactions/${payload.transactionId}/verify`;
        break;
      case "refund":
        url = `https://api.flutterwave.com/v3/transactions/${payload.transactionId}/refund`;
        method = "POST";
        break;
    }

    const response = await fetch(url, { method, headers });
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
```

### 3. Deploy Functions
```bash
supabase functions deploy cj-proxy
supabase functions deploy flutterwave-proxy
```

---

## CJ Dropshipping Integration

### API Setup
1. Get API credentials from [CJ Dropshipping Developer](https://developers.cjdropshipping.com)
2. Store in Supabase secrets
3. Use Edge Functions to proxy requests (keep key secure)

### Key Endpoints
- **Search**: `POST /search`
- **Get Product**: `GET /product/{id}`
- **Create Order**: `POST /order/create`
- **Get Tracking**: `GET /order/{id}/tracking`

### Implementation
All CJ API calls are made through `/api/cj/*` backend endpoints.

---

## Flutterwave Integration

### Setup
1. Create [Flutterwave account](https://dashboard.flutterwave.com)
2. Get Public Key and Secret Key
3. Store Secret Key in Supabase
4. Use Public Key in frontend

### Payment Flow
1. Customer adds items to cart
2. At checkout, open Flutterwave modal
3. Customer completes payment
4. Verify with backend
5. Create order and CJ order
6. Send confirmation email

### Testing
Use Flutterwave test credentials:
- Test Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVV: Any 3 digits

---

## Deployment

### Frontend Deployment (Vercel/Netlify)
```bash
# Build (if using bundler)
npm run build

# Deploy
# Vercel: vercel deploy
# Netlify: netlify deploy
```

### Environment Variables in Production
Set all `VITE_*` variables in your hosting platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FLUTTERWAVE_PUBLIC_KEY`

### Domain & SSL
- Use custom domain
- Enable HTTPS/SSL
- Update CORS in Supabase Settings

---

## Security Checklist

- ✅ Never expose secret keys in frontend code
- ✅ Use Supabase RLS policies
- ✅ Enable HTTPS everywhere
- ✅ Validate all user input
- ✅ Use Edge Functions for sensitive operations
- ✅ Keep dependencies updated
- ✅ Regular security audits
- ✅ Monitor for suspicious activity

---

## Support & Resources

- [Supabase Docs](https://supabase.com/docs)
- [CJ Dropshipping API](https://developers.cjdropshipping.com)
- [Flutterwave Docs](https://developer.flutterwave.com)
- [OWASP Security](https://owasp.org)

---

**Last Updated**: December 2025
**Version**: 1.0
