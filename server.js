const http = require('http');
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');

const port = process.env.PORT || 8080;
const rootDir = process.cwd();

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

function sanitizeUrl(url) {
  const parsedPath = new URL(url, `http://localhost:${port}`).pathname;
  return path.normalize(parsedPath).replace(/^\.+/, '');
}

function loadEnvFile() {
  const envPath = path.join(rootDir, 'env.local');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const vars = {};
  const content = fs.readFileSync(envPath, 'utf8');

  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    vars[key] = value;
  });

  return vars;
}

function getCJConfig() {
  const envFile = loadEnvFile();
  return {
    apiKey: process.env.VITE_CJ_API_KEY || envFile.VITE_CJ_API_KEY || '',
    apiUrl: process.env.VITE_CJ_API_URL || envFile.VITE_CJ_API_URL || 'https://developers.cjdropshipping.com/api2.0/v1',
    storeId: process.env.VITE_CJ_STORE_ID || envFile.VITE_CJ_STORE_ID || ''
  };
}

function sendResponse(response, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      response.writeHead(500, { 'Content-Type': 'text/plain' });
      response.end('Internal Server Error');
      return;
    }

    response.writeHead(200, { 'Content-Type': contentType });
    response.end(data);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let data = '';

    request.on('data', (chunk) => {
      data += chunk.toString();
    });

    request.on('end', () => resolve(data));
    request.on('error', reject);
  });
}

async function proxyCJRequest(request, response) {
  const cjConfig = getCJConfig();
  const requestUrl = new URL(request.url, `http://localhost:${port}`);
  let pathname = requestUrl.pathname.replace(/^\/api\/cj\/?/, '/');

  if (pathname === '/search') {
    pathname = '/products/search';
  }

  if (pathname === '/orders') {
    pathname = '/orders/create';
  }

  if (!cjConfig.apiKey) {
    return sendJson(response, 500, {
      success: false,
      error: 'CJ API key is not configured on the server.'
    });
  }

  const targetUrl = new URL(`${cjConfig.apiUrl}${pathname}${requestUrl.search}`);
  if (cjConfig.storeId) {
    targetUrl.searchParams.set('storeId', cjConfig.storeId);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    Authorization: `Bearer ${cjConfig.apiKey}`,
    'X-API-Key': cjConfig.apiKey
  };

  let body;
  if (!['GET', 'HEAD'].includes(request.method)) {
    body = await readRequestBody(request);
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body || undefined
    });

    const rawText = await upstreamResponse.text();
    let payload;
    try {
      payload = JSON.parse(rawText);
    } catch (error) {
      payload = rawText;
    }

    response.writeHead(upstreamResponse.status, {
      'Content-Type': upstreamResponse.headers.get('content-type') || 'application/json'
    });
    response.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
  } catch (error) {
    return sendJson(response, 502, {
      success: false,
      error: 'Failed to reach CJ Dropshipping API.',
      details: error.message
    });
  }
}

function getSupabaseConfig() {
  const envFile = loadEnvFile();
  return {
    url: process.env.VITE_SUPABASE_URL || envFile.VITE_SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || envFile.VITE_SUPABASE_ANON_KEY || ''
  };
}

// Admin: fetch products from CJ and return summary
async function handleAdminCJSync(request, response) {
  try {
    const url = new URL(request.url, `http://localhost:${port}`);
    const search = url.searchParams.get('search') || 'electronics';
    const page = Number(url.searchParams.get('page') || 1);
    const perPage = Number(url.searchParams.get('perPage') || 50);

    const cjConfig = getCJConfig();
    if (!cjConfig.apiKey) {
      return sendJson(response, 500, { success: false, error: 'CJ API key not configured' });
    }

    const target = new URL(`${cjConfig.apiUrl}/products/search`);
    target.searchParams.set('keyword', search);
    target.searchParams.set('page', String(page));
    target.searchParams.set('limit', String(perPage));
    if (cjConfig.storeId) target.searchParams.set('storeId', cjConfig.storeId);

    const upstream = await fetch(target.toString(), { headers: { Authorization: `Bearer ${cjConfig.apiKey}`, 'X-API-Key': cjConfig.apiKey } });
    const text = await upstream.text();
    let payload;
    try { payload = JSON.parse(text); } catch (e) { payload = text; }

    const products = Array.isArray(payload?.products) ? payload.products : (payload?.data || []);
    return sendJson(response, 200, { success: true, fetched: products.length, products, raw: payload });
  } catch (error) {
    console.error('Admin CJ sync error', error);
    return sendJson(response, 500, { success: false, error: error.message });
  }
}

// Admin: import products to Supabase via REST (uses anon key from env.local)
async function handleAdminImportProducts(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { success: false, error: 'Method not allowed' });
  try {
    const body = await readRequestBody(request);
    const payload = JSON.parse(body);
    const products = Array.isArray(payload.products) ? payload.products : [];
    if (!products.length) return sendJson(response, 400, { success: false, error: 'No products provided' });

    const sb = getSupabaseConfig();
    if (!sb.url || !sb.anonKey) return sendJson(response, 500, { success: false, error: 'Supabase config missing on server' });

    const target = `${sb.url.replace(/\/$/, '')}/rest/v1/products`;
    const res = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: sb.anonKey,
        Authorization: `Bearer ${sb.anonKey}`,
        Prefer: 'return=representation'
      },
      body: JSON.stringify(products)
    });

    const text = await res.text();
    let result;
    try { result = JSON.parse(text); } catch (e) { result = text; }

    if (!res.ok) {
      return sendJson(response, res.status, { success: false, status: res.status, error: result });
    }

    return sendJson(response, 200, { success: true, inserted: Array.isArray(result) ? result.length : 0, result });
  } catch (error) {
    console.error('Admin import products error', error);
    return sendJson(response, 500, { success: false, error: error.message });
  }
}

// Admin: run connectivity tests for CJ and Supabase (read-only)
async function handleAdminRunTests(request, response) {
  try {
    const cjConfig = getCJConfig();
    const sb = getSupabaseConfig();

    const results = { cj: null, supabase: null };

    // CJ test: attempt a simple search
    try {
      if (!cjConfig.apiKey) {
        results.cj = { ok: false, error: 'CJ API key missing' };
      } else {
        const t = new URL(`${cjConfig.apiUrl}/products/search`);
        t.searchParams.set('keyword', 'test');
        t.searchParams.set('page', '1');
        t.searchParams.set('limit', '1');
        if (cjConfig.storeId) t.searchParams.set('storeId', cjConfig.storeId);
        const r = await fetch(t.toString(), { headers: { Authorization: `Bearer ${cjConfig.apiKey}`, 'X-API-Key': cjConfig.apiKey } });
        const txt = await r.text();
        let json; try { json = JSON.parse(txt); } catch(e) { json = txt; }
        results.cj = { ok: r.ok, status: r.status, body: json };
      }
    } catch (e) {
      results.cj = { ok: false, error: e.message };
    }

    // Supabase test: try a read from public products (REST) using anon key
    try {
      if (!sb.url || !sb.anonKey) {
        results.supabase = { ok: false, error: 'Supabase URL or anon key missing' };
      } else {
        const target = `${sb.url.replace(/\/$/, '')}/rest/v1/products?select=id&limit=1`;
        const r2 = await fetch(target, { headers: { apikey: sb.anonKey, Authorization: `Bearer ${sb.anonKey}` } });
        const txt2 = await r2.text();
        let json2; try { json2 = JSON.parse(txt2); } catch(e) { json2 = txt2; }
        results.supabase = { ok: r2.ok, status: r2.status, body: json2 };
      }
    } catch (e) {
      results.supabase = { ok: false, error: e.message };
    }

    return sendJson(response, 200, { success: true, results });
  } catch (error) {
    console.error('Admin run tests error', error);
    return sendJson(response, 500, { success: false, error: error.message });
  }
}

async function handleEmailRequest(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { success: false, error: 'Method not allowed' });
  }

  try {
    const body = await readRequestBody(request);
    const emailData = JSON.parse(body);
    const resendApiKey = process.env.RESEND_API_KEY;

    // Log email for debugging
    console.log('📧 Order confirmation email triggered:', {
      orderId: emailData.orderId,
      userEmail: emailData.userEmail,
      adminEmail: emailData.adminEmail,
      amount: emailData.totalAmount,
      timestamp: new Date().toISOString()
    });

    // Format email content
    const orderItems = emailData.orderItems?.map(i => `- ${i.name} x ${i.quantity}`).join('\n') || 'N/A';
    const address = emailData.shippingAddress;
    const addressStr = address ? `${address.street}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}` : 'Not provided';

    // Admin email HTML
    const adminEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
    .header { background-color: #d4af37; color: #050816; padding: 20px; text-align: center; }
    .content { background-color: white; padding: 20px; margin-top: 10px; }
    .order-details { background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-left: 4px solid #d4af37; }
    .items { margin: 15px 0; }
    .item { padding: 8px 0; border-bottom: 1px solid #eee; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Order - Wimp-Drop</h1>
    </div>
    <div class="content">
      <p>A new order has been received on your platform.</p>
      
      <div class="order-details">
        <h3>Order Details</h3>
        <p><strong>Order ID:</strong> ${emailData.orderId}</p>
        <p><strong>Customer Email:</strong> ${emailData.userEmail}</p>
        <p><strong>Total Amount:</strong> ₦${(emailData.totalAmount / 100).toLocaleString()}</p>
        <p><strong>Payment Reference:</strong> ${emailData.paymentRef || 'Pending'}</p>
        <p><strong>Status:</strong> ${emailData.status}</p>
      </div>

      <div>
        <h4>Items Ordered:</h4>
        <div class="items">
          ${emailData.orderItems?.map(i => `<div class="item">• ${i.name} x ${i.quantity}</div>`).join('') || '<div>No items</div>'}
        </div>
      </div>

      <div class="order-details">
        <h4>Shipping Address</h4>
        <p>${addressStr}</p>
      </div>

      <p><small>Order Created: ${new Date(emailData.createdAt).toLocaleString()}</small></p>
    </div>
    <div class="footer">
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `;

    // User email HTML
    const userEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
    .header { background-color: #2d6cdf; color: white; padding: 20px; text-align: center; }
    .content { background-color: white; padding: 20px; margin-top: 10px; }
    .order-details { background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-left: 4px solid #2d6cdf; }
    .items { margin: 15px 0; }
    .item { padding: 8px 0; border-bottom: 1px solid #eee; }
    .button { display: inline-block; background-color: #2d6cdf; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thank You for Your Order!</h1>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p>Your order has been confirmed and will be processed shortly. We'll keep you updated every step of the way.</p>
      
      <div class="order-details">
        <h3>Order Confirmation</h3>
        <p><strong>Order ID:</strong> ${emailData.orderId}</p>
        <p><strong>Total Amount:</strong> ₦${(emailData.totalAmount / 100).toLocaleString()}</p>
      </div>

      <div>
        <h4>Items Ordered:</h4>
        <div class="items">
          ${emailData.orderItems?.map(i => `<div class="item">• ${i.name} x ${i.quantity}</div>`).join('') || '<div>No items</div>'}
        </div>
      </div>

      <div class="order-details">
        <h4>Shipping To:</h4>
        <p>${addressStr}</p>
      </div>

      <p>We'll send you a tracking number as soon as your order ships. This usually happens within 24 hours.</p>
      
      <p>If you have any questions, please contact us at <strong>wimpycooperation@gmail.com</strong></p>
      
      <a href="https://wimp-drop.com" class="button">Track Your Order</a>
    </div>
    <div class="footer">
      <p>Thank you for shopping at Wimp-Drop!</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send emails using Resend if API key is configured
    let emailsSent = { admin: false, user: false };
    let emailError = null;

    if (resendApiKey && resendApiKey !== 'your_resend_api_key_here') {
      try {
        const resend = new Resend(resendApiKey);

        // Send admin email
        try {
          await resend.emails.send({
            from: 'Wimp-Drop <noreply@wimp-drop.com>',
            to: emailData.adminEmail,
            subject: `New Order Received - Order #${emailData.orderId}`,
            html: adminEmailHtml
          });
          emailsSent.admin = true;
          console.log('✅ Admin email sent successfully');
        } catch (adminError) {
          console.warn('⚠️ Failed to send admin email:', adminError.message);
        }

        // Send user email
        try {
          await resend.emails.send({
            from: 'Wimp-Drop <noreply@wimp-drop.com>',
            to: emailData.userEmail,
            subject: 'Order Confirmed - Thank You!',
            html: userEmailHtml
          });
          emailsSent.user = true;
          console.log('✅ User confirmation email sent successfully');
        } catch (userError) {
          console.warn('⚠️ Failed to send user email:', userError.message);
        }
      } catch (error) {
        console.warn('⚠️ Resend service error:', error.message);
        emailError = error.message;
      }
    } else {
      console.log('ℹ️ Resend API key not configured. Logging emails instead:');
      console.log('\n📧 Admin Email Content:');
      console.log(adminEmailHtml);
      console.log('\n📧 User Email Content:');
      console.log(userEmailHtml);
      emailsSent.fallback = true;
    }

    return sendJson(response, 200, {
      success: true,
      message: emailsSent.fallback ? 'Emails logged (Resend not configured)' : 'Order confirmation emails sent',
      orderId: emailData.orderId,
      emailsSent,
      error: emailError
    });

  } catch (error) {
    console.error('Email request error:', error);
    return sendJson(response, 400, {
      success: false,
      error: 'Failed to process email request',
      details: error.message
    });
  }
}

const server = http.createServer(async (request, response) => {
  if (request.url && request.url.startsWith('/api/cj')) {
    await proxyCJRequest(request, response);
    return;
  }

  if (request.url && request.url.startsWith('/api/admin/cj-sync')) {
    await handleAdminCJSync(request, response);
    return;
  }

  if (request.url && request.url.startsWith('/api/admin/import-products')) {
    await handleAdminImportProducts(request, response);
    return;
  }

  if (request.url && request.url.startsWith('/api/admin/run-tests')) {
    await handleAdminRunTests(request, response);
    return;
  }

  if (request.url && request.url.startsWith('/api/send-email')) {
    await handleEmailRequest(request, response);
    return;
  }

  const safePath = sanitizeUrl(request.url);
  let filePath = path.join(rootDir, safePath);

  if (filePath.endsWith(path.sep)) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      sendResponse(response, filePath);
      return;
    }

    const fallbackPath = path.join(rootDir, 'index.html');
    fs.access(fallbackPath, fs.constants.R_OK, (fallbackErr) => {
      if (!fallbackErr) {
        sendResponse(response, fallbackPath);
      } else {
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('404 Not Found');
      }
    });
  });
});

server.listen(port, () => {
  console.log(`Static server running at http://localhost:${port}`);
});
