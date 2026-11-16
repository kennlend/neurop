exports.handler = async event => {
  const reply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
  if (event.httpMethod !== 'GET') return reply(405, { error: 'Method not allowed' });
  const id = event.queryStringParameters?.session_id || '';
  if (!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(id)) return reply(400, { error: 'Invalid session' });
  if (!process.env.STRIPE_SECRET_KEY) return reply(503, { error: 'Unable to verify payment' });
  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}?expand[]=line_items`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    const session = await response.json();
    if (!response.ok || session.metadata?.source !== 'neuropouch_checkout') return reply(404, { error: 'Order not found' });
    const paid = session.payment_status === 'paid';
    const shipping = session.total_details?.amount_shipping || 0;
    const tax = session.total_details?.amount_tax || 0;
    // Return only verified commerce fields, never customer contact/payment details.
    const ecommerce = paid ? {
      transaction_id: session.id,
      currency: session.currency.toUpperCase(),
      value: (session.amount_total - shipping - tax) / 100,
      shipping: shipping / 100,
      tax: tax / 100,
      items: (session.line_items?.data || []).map(item => ({
        item_id: session.metadata.kind === 'pack' ? 'np-pack-5' : 'np-tower',
        item_name: item.description,
        item_brand: 'NeuroPouch',
        price: (item.amount_total - (item.amount_tax || 0)) / 100 / (item.quantity || 1),
        quantity: item.quantity || 1,
      })),
    } : undefined;
    return reply(200, { paid, status: session.status, ecommerce });
  } catch { return reply(502, { error: 'Unable to verify payment' }); }
};
