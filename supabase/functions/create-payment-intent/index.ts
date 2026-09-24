import { db, handleOptions, json, readJson } from '../_shared/cj.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ success: false, error: 'Authentication required' }, 401);
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return json({ success: false, error: 'Authentication required' }, 401);

    const body = await readJson(request);
    if (!body.txRef || !body.amount || !body.shippingAddress || !Array.isArray(body.cartItems) || !body.cartItems.length) {
      return json({ success: false, error: 'txRef, amount, shippingAddress, and cartItems are required' }, 400);
    }
    const { error } = await db.from('payment_intents').insert({
      tx_ref: body.txRef,
      user_id: userData.user.id,
      expected_amount: Number(body.amount),
      currency: body.currency || 'NGN',
      shipping_address: body.shippingAddress,
      cart_items: body.cartItems,
      status: 'pending'
    });
    if (error) throw error;
    return json({ success: true, txRef: body.txRef });
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 400);
  }
});
