import { db, handleOptions, json } from '../_shared/cj.ts';

const FLW_SECRET_KEY = Deno.env.get('FLW_SECRET_KEY') || '';
const WEBHOOK_HASH = Deno.env.get('FLW_WEBHOOK_SECRET_HASH') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'Wimp-Drop <noreply@wimp-drop.com>';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'wimpycooperation@gmail.com';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function normalizeCustomerEmail(value: unknown): string {
  return String(value || '').trim();
}

function extractAddressText(address: any): string {
  if (!address || typeof address !== 'object') return 'Not provided';
  const lines = [
    `${address.firstName || address.first_name || ''} ${address.lastName || address.last_name || ''}`.trim(),
    `${address.street || address.street_address || address.address || ''}`.trim(),
    [address.city || address.town || '', address.state || address.region || '', address.postalCode || address.postal_code || ''].filter(Boolean).join(', '),
    address.country || 'Nigeria'
  ].filter(Boolean);
  return lines.join('<br>') || 'Not provided';
}

async function sendResendEmail(payload: { from: string; to: string[]; subject: string; html: string }): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not configured; skipping transactional email.');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend email failed (${response.status}): ${text}`);
  }
}

async function sendOrderConfirmationEmail(order: any, userEmail: string): Promise<void> {
  if (!userEmail) {
    return;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const address = order.shipping_address || {};
  const orderHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f7f4ee;color:#1a1f2c;">
      <div style="background:#d4af37;color:#050816;padding:24px 20px;text-align:center;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:28px;">Order confirmed</h1>
      </div>
      <div style="background:#ffffff;padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;">
        <p>Hi there,</p>
        <p>Your order has been received and is now being processed.</p>
        <p><strong>Order ID:</strong> ${order.order_number || order.id}</p>
        <p><strong>Total:</strong> ${formatMoney(Number(order.total_amount || 0))}</p>
        <p><strong>Shipping to:</strong><br>${extractAddressText(address)}</p>
        <p><strong>Items:</strong></p>
        <ul>
          ${items.map((item: any) => `<li>${item.name || item.title || 'Item'} x ${Number(item.quantity || 1)}</li>`).join('') || '<li>Order details pending</li>'}
        </ul>
        <p>We will send tracking details as soon as your order ships.</p>
        <p>For support, contact <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a>.</p>
      </div>
    </div>
  `;

  const adminHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f7f4ee;color:#1a1f2c;">
      <div style="background:#050816;color:#ffffff;padding:24px;text-align:center;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:28px;">New order received</h1>
      </div>
      <div style="background:#ffffff;padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;">
        <p><strong>Order ID:</strong> ${order.order_number || order.id}</p>
        <p><strong>Customer email:</strong> ${userEmail}</p>
        <p><strong>Total:</strong> ${formatMoney(Number(order.total_amount || 0))}</p>
        <p><strong>Payment reference:</strong> ${order.payment_ref || 'Pending'}</p>
        <p><strong>Shipping address:</strong><br>${extractAddressText(address)}</p>
        <p><strong>Items:</strong></p>
        <ul>${items.map((item: any) => `<li>${item.name || item.title || 'Item'} x ${Number(item.quantity || 1)}</li>`).join('') || '<li>Order details pending</li>'}</ul>
      </div>
    </div>
  `;

  const customerPayload = {
    from: RESEND_FROM,
    to: [userEmail],
    subject: `Order confirmed - ${order.order_number || order.id}`,
    html: orderHtml
  };

  const adminPayload = {
    from: RESEND_FROM,
    to: [ADMIN_EMAIL],
    subject: `New Wimp-Drop order: ${order.order_number || order.id}`,
    html: adminHtml
  };

  await Promise.allSettled([
    sendResendEmail(customerPayload),
    sendResendEmail(adminPayload)
  ]);
}

async function verifyTransaction(transactionId: string): Promise<any> {
  const response = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: { Authorization: `Bearer ${FLW_SECRET_KEY}`, 'Content-Type': 'application/json' }
  });
  const data = await response.json();
  if (!response.ok || data.status !== 'success' || data.data?.status !== 'successful') {
    throw new Error(data.message || 'Flutterwave transaction verification failed');
  }
  return data.data;
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (!WEBHOOK_HASH || request.headers.get('verif-hash') !== WEBHOOK_HASH) return json({ success: false, error: 'Invalid webhook signature' }, 401);
  if (!FLW_SECRET_KEY) return json({ success: false, error: 'Flutterwave secret is not configured' }, 500);

  try {
    const event = await request.json();
    const transactionId = String(event.data?.id || event.data?.transaction_id || '');
    const txRef = String(event.data?.tx_ref || event.data?.txRef || '');
    if (!transactionId || !txRef) return json({ success: false, error: 'Missing transaction identifiers' }, 400);

    const transaction = await verifyTransaction(transactionId);
    const { data: intent, error: intentError } = await db.from('payment_intents').select('*').eq('tx_ref', txRef).single();
    if (intentError || !intent) throw new Error('Payment intent not found');
    if (Number(transaction.amount) !== Number(intent.expected_amount) || transaction.currency !== intent.currency) {
      throw new Error('Verified payment amount or currency does not match payment intent');
    }
    if (intent.status === 'fulfilled' || intent.status === 'paid') return json({ success: true, duplicate: true });

    const { data: order, error: orderError } = await db.from('orders').insert({
      user_id: intent.user_id,
      order_number: txRef,
      status: 'paid',
      total_amount: intent.expected_amount,
      shipping_address: intent.shipping_address,
      items: intent.cart_items,
      payment_ref: txRef,
      fulfillment_status: 'pending',
      fulfillment_attempts: 0
    }).select().single();
    if (orderError) throw orderError;

    await db.from('payments').insert({
      order_id: order.id,
      user_id: intent.user_id,
      amount: intent.expected_amount,
      currency: intent.currency,
      payment_method: 'flutterwave',
      payment_status: 'successful',
      provider: 'flutterwave',
      provider_transaction_id: transactionId,
      transaction_id: transactionId,
      verified_at: new Date().toISOString(),
      metadata: transaction
    });
    await db.from('payment_intents').update({ status: 'paid', provider_transaction_id: transactionId, updated_at: new Date().toISOString() }).eq('id', intent.id);

    const customerEmail = normalizeCustomerEmail(intent.shipping_address?.email || intent.shipping_address?.customer_email || (await db.from('user_profiles').select('email').eq('id', intent.user_id).maybeSingle()).data?.email);
    try {
      await sendOrderConfirmationEmail(order, customerEmail);
    } catch (emailError) {
      console.warn('Order confirmation email could not be sent:', (emailError as Error).message);
    }

    await fetch(`${SUPABASE_URL}/functions/v1/order-forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
      body: JSON.stringify({ orderId: order.id })
    });
    return json({ success: true, orderId: order.id });
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 400);
  }
});
