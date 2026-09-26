import { cjRequest, db, handleOptions, json } from '../_shared/cj.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const ALERT_EMAIL = Deno.env.get('CJ_BALANCE_ALERT_EMAIL') || '';
const LOW_BALANCE_THRESHOLD = Number(Deno.env.get('CJ_LOW_BALANCE_THRESHOLD') || '50');
const ALERT_COOLDOWN_HOURS = 12; // don't re-email more than once per this window

async function sendAlertEmail(amount: number) {
  if (!RESEND_API_KEY || !ALERT_EMAIL) {
    throw new Error('RESEND_API_KEY or CJ_BALANCE_ALERT_EMAIL is not configured');
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Wimp-Drop <noreply@wimp-drop.com>', // reuse the domain already verified for order emails in server.js
      to: [ALERT_EMAIL],
      subject: `Low CJ Dropshipping balance: $${amount.toFixed(2)}`,
      html: `
        <p>Your CJ Dropshipping wallet balance is <strong>$${amount.toFixed(2)}</strong>,
        at or below your alert threshold of $${LOW_BALANCE_THRESHOLD.toFixed(2)}.</p>
        <p>New paid orders will still be created on your site, but automatic
        forwarding to CJ (order-forward) will start failing once the balance
        runs out — those orders will need manual fulfillment until you top up.</p>
        <p>Top up here: <a href="https://cjdropshipping.com">https://cjdropshipping.com</a></p>
      `
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend request failed: ${response.status} ${text}`);
  }
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  // Same internal-only pattern as stock-sync/tracking-sync/order-forward —
  // only callable with the shared cron secret, never from the browser.
  if (!CRON_SECRET || request.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'Internal function' }, 401);
  }

  try {
    const result = await cjRequest('/shopping/pay/getBalance');
    const amount = Number(result.data?.amount ?? 0);

    if (amount > LOW_BALANCE_THRESHOLD) {
      return json({ success: true, amount, alerted: false });
    }

    // Skip if we already sent an alert recently, so a persistently low
    // balance doesn't spam an email every time this runs.
    const cutoff = new Date(Date.now() - ALERT_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recentAlert } = await db
      .from('admin_alerts')
      .select('id')
      .eq('alert_type', 'cj_low_balance')
      .is('resolved_at', null)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentAlert) {
      return json({ success: true, amount, alerted: false, reason: 'cooldown' });
    }

    await sendAlertEmail(amount);
    await db.from('admin_alerts').insert({
      alert_type: 'cj_low_balance',
      message: `CJ Dropshipping wallet balance is low: $${amount.toFixed(2)} (threshold: $${LOW_BALANCE_THRESHOLD.toFixed(2)})`
    });

    return json({ success: true, amount, alerted: true });
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 500);
  }
});