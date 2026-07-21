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

function getSupabaseConfig() {
  const envFile = loadEnvFile();
  return {
    url: process.env.VITE_SUPABASE_URL || envFile.VITE_SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || envFile.VITE_SUPABASE_ANON_KEY || ''
  };
}

function getSupabaseServiceRoleKey() {
  const envFile = loadEnvFile();
  return process.env.SUPABASE_SERVICE_ROLE_KEY || envFile.SUPABASE_SERVICE_ROLE_KEY || '';
}

function getAdminCreationSecret() {
  const envFile = loadEnvFile();
  return process.env.ADMIN_CREATION_SECRET || envFile.ADMIN_CREATION_SECRET || '';
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

// Admin: create a new admin user using Supabase service role key
async function handleAdminCreateAdmin(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { success: false, error: 'Method not allowed' });
  try {
    const secret = request.headers['x-admin-secret'] || '';
    const configured = getAdminCreationSecret();
    if (!configured) {
      return sendJson(response, 403, { success: false, error: 'Admin creation disabled on this server (no ADMIN_CREATION_SECRET configured)' });
    }
    if (!secret || secret !== configured) {
      return sendJson(response, 401, { success: false, error: 'Unauthorized: invalid admin creation secret' });
    }

    const body = await readRequestBody(request);
    const data = JSON.parse(body);
    const email = data.email;
    const password = data.password;
    const fullName = data.full_name || '';

    if (!email || !password) return sendJson(response, 400, { success: false, error: 'email and password are required' });

    const serviceRole = getSupabaseServiceRoleKey();
    const sb = getSupabaseConfig();
    if (!serviceRole || !sb.url) return sendJson(response, 500, { success: false, error: 'Supabase service role key or URL not configured' });

    // Create user via Supabase Admin API
    const createUserUrl = `${sb.url.replace(/\/$/, '')}/auth/v1/admin/users`;
    const createResp = await fetch(createUserUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`
      },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } })
    });

    const createText = await createResp.text();
    let created; try { created = JSON.parse(createText); } catch (e) { created = createText; }
    if (!createResp.ok) {
      return sendJson(response, createResp.status, { success: false, error: created });
    }

    const userId = created?.id;
    if (!userId) return sendJson(response, 500, { success: false, error: 'Failed to parse created user ID' });

    // Insert into user_profiles and mark is_admin true using service role
    const profilesUrl = `${sb.url.replace(/\/$/, '')}/rest/v1/user_profiles`;
    const profileResp = await fetch(profilesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        Prefer: 'return=representation'
      },
      body: JSON.stringify([{ id: userId, full_name: fullName, is_admin: true }])
    });

    const profileText = await profileResp.text();
    let profileResult; try { profileResult = JSON.parse(profileText); } catch (e) { profileResult = profileText; }
    if (!profileResp.ok) {
      return sendJson(response, profileResp.status, { success: false, error: profileResult });
    }

    return sendJson(response, 200, { success: true, user: created, profile: profileResult });
  } catch (error) {
    console.error('Admin create error', error);
    return sendJson(response, 500, { success: false, error: error.message });
  }
}

// Admin: run connectivity tests for Supabase (read-only)
async function handleAdminRunTests(request, response) {
  try {
    const sb = getSupabaseConfig();

    const results = { supabase: null };

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

    if (!sb.url || !sb.anonKey) {
      sendEvent('error', 'Supabase URL or anon key missing on server');
      response.end();
      return;
    }

    sendEvent('log', `Importing ${payloadToImport.length} products to Supabase`);
    const targetUrl = `${sb.url.replace(/\/$/, '')}/rest/v1/products`;
    const importResp = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: sb.anonKey,
        Authorization: `Bearer ${sb.anonKey}`,
        Prefer: 'return=representation'
      },
      body: JSON.stringify(payloadToImport)
    });

    const importText = await importResp.text();
    let importResult; try { importResult = JSON.parse(importText); } catch(e) { importResult = importText; }

    if (!importResp.ok) {
      sendEvent('error', `Import failed: ${JSON.stringify(importResult)}`);
      response.end();
      return;
    }

    const inserted = Array.isArray(importResult) ? importResult.length : 0;
    sendEvent('progress', { pct: 100 });
    sendEvent('log', `Import complete — inserted ${inserted} products`);
    sendEvent('done', { inserted });
    response.end();
  } catch (error) {
    console.error('SSE sync error', error);
    sendEvent('error', error.message || 'Unknown server error');
    response.end();
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
  console.log('[HTTP]', request.method, request.url);
  if (request.url && request.url.startsWith('/api/admin/create-admin')) {
    await handleAdminCreateAdmin(request, response);
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
