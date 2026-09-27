import { db, handleOptions, json } from '../_shared/cj.ts';
import { getSupplierAdapter } from '../_shared/cj-adapter.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'Wimp-Drop <noreply@wimp-drop.com>';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'wimpycooperation@gmail.com';

async function sendResendEmail(payload: { from: string; to: string[]; subject: string; html: string }): Promise<void> {
  if (!RESEND_API_KEY) return;
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

async function sendTrackingNotification(order: any, tracking: any): Promise<void> {
  const shippingAddress = order.shipping_address || {};
  const customerEmail = String(shippingAddress.email || '').trim();
  if (!customerEmail || !tracking?.trackingNumber) return;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f7f4ee;color:#1a1f2c;">
      <div style="background:#d4af37;color:#050816;padding:24px 20px;text-align:center;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:28px;">Your order is on the move</h1>
      </div>
      <div style="background:#ffffff;padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;">
        <p>Hi there,</p>
        <p>Your order has been updated with tracking information.</p>
        <p><strong>Order ID:</strong> ${order.order_number || order.id}</p>
        <p><strong>Carrier:</strong> ${tracking.carrier || 'Carrier pending'}</p>
        <p><strong>Tracking number:</strong> ${tracking.trackingNumber}</p>
        <p><strong>Status:</strong> ${tracking.status || 'In transit'}</p>
        <p>For support, contact <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a>.</p>
      </div>
    </div>
  `;

  await Promise.allSettled([
    sendResendEmail({ from: RESEND_FROM, to: [customerEmail], subject: `Tracking update for order ${order.order_number || order.id}`, html }),
    sendResendEmail({ from: RESEND_FROM, to: [ADMIN_EMAIL], subject: `Tracking update for ${order.order_number || order.id}`, html: `<p>Tracking notification sent for order ${order.order_number || order.id}: ${tracking.trackingNumber}</p>` })
  ]);
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  const secret = Deno.env.get('CRON_SECRET') || '';
  if (!secret || request.headers.get('x-cron-secret') !== secret) return json({ error: 'Internal function' }, 401);
  const { data: orders, error } = await db.from('orders').select('id,order_number,shipping_address,supplier_order_id,user_id,status').eq('supplier', 'cj').not('supplier_order_id', 'is', null).not('fulfillment_status', 'in', '(delivered,cancelled)').limit(100);
  if (error) return json({ success: false, error: error.message }, 500);
  let updated = 0;
  const supplier = getSupplierAdapter('cj');
  for (const order of orders || []) {
    try {
      const tracking = await supplier.getTracking(order.supplier_order_id);
      const previousTrackingNumber = String(order.tracking_number || '').trim();
      const previousCarrier = String(order.carrier || '').trim();
      const trackingChanged = previousTrackingNumber !== String(tracking.trackingNumber || '').trim() || previousCarrier !== String(tracking.carrier || '').trim();
      await db.from('orders').update({ tracking_number: tracking.trackingNumber, carrier: tracking.carrier, status: tracking.status, fulfillment_updated_at: new Date().toISOString() }).eq('id', order.id);
      if (trackingChanged) {
        try {
          await sendTrackingNotification(order, tracking);
        } catch (emailError) {
          console.warn('Tracking notification email failed:', (emailError as Error).message);
        }
      }
      updated += 1;
    } catch {

    }
  }
  return json({ success: true, updated });
});
