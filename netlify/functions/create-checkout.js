const COUNTRIES = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE GB'.split(' ');

exports.handler = async event => {
  const reply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });
  let cart;
  try { cart = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid request' }); }
  const { kind, count } = cart;
  if (!['pack', 'tower'].includes(kind) || !Number.isSafeInteger(count) || count < 1 || count > 99) {
    return reply(400, { error: 'Choose between 1 and 99 packs or towers.' });
  }
  if (!process.env.STRIPE_SECRET_KEY) return reply(503, { error: 'Checkout is temporarily unavailable. Please contact info@getneuropouch.com.' });
  // Calculate in cents; never accept amounts or product descriptions from the browser.
  const amount = kind === 'pack' ? count * 4990 : ({ 1: 9900, 2: 16830, 3: 23760 }[count] || count * 7920);
  const tins = count * (kind === 'pack' ? 5 : 10);
  const origin = (process.env.SITE_URL || process.env.URL || 'https://getneuropouch.com').replace(/\/$/, '');
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${origin}/product?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/product?checkout=cancelled`,
    customer_creation: 'always',
    billing_address_collection: 'required',
    'phone_number_collection[enabled]': 'true',
    'invoice_creation[enabled]': 'true',
    allow_promotion_codes: 'true',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': `NeuroPouch Energy & Focus - ${tins} tins`,
    'line_items[0][price_data][product_data][description]': 'Peppermint & Lemongrass. 16 pouches per tin.',
    'line_items[0][quantity]': '1',
    'metadata[source]': 'neuropouch_checkout',
    'metadata[kind]': kind,
    'metadata[count]': String(count),
    'payment_intent_data[metadata][source]': 'neuropouch_checkout',
    'shipping_options[0][shipping_rate_data][type]': 'fixed_amount',
    'shipping_options[0][shipping_rate_data][fixed_amount][amount]': amount > 5000 ? '0' : '495',
    'shipping_options[0][shipping_rate_data][fixed_amount][currency]': 'eur',
    'shipping_options[0][shipping_rate_data][display_name]': 'Standard delivery',
  });
  COUNTRIES.forEach((country, index) => form.set(`shipping_address_collection[allowed_countries][${index}]`, country));
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const session = await response.json();
    if (!response.ok || !session.url) throw new Error('Stripe session creation failed');
    return reply(200, { url: session.url });
  } catch (error) {
    console.error('Checkout creation failed', error.message);
    return reply(502, { error: 'Unable to start checkout. Please try again or email info@getneuropouch.com.' });
  }
};
