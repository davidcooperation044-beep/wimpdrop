import { db, handleOptions, json } from '../_shared/cj.ts';

const FLW_SECRET_KEY = Deno.env.get('FLW_SECRET_KEY') || '';
const WEBHOOK_HASH = Deno.env.get('FLW_WEBHOOK_SECRET_HASH') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';

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
