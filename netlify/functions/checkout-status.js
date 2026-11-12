exports.handler = async event => {
  const reply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
  if (event.httpMethod !== 'GET') return reply(405, { error: 'Method not allowed' });
  const id = event.queryStringParameters?.session_id || '';
  if (!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(id)) return reply(400, { error: 'Invalid session' });
  if (!process.env.STRIPE_SECRET_KEY) return reply(503, { error: 'Unable to verify payment' });
  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    const session = await response.json();
    if (!response.ok || session.metadata?.source !== 'neuropouch_checkout') return reply(404, { error: 'Order not found' });
    return reply(200, { paid: session.payment_status === 'paid', status: session.status });
  } catch { return reply(502, { error: 'Unable to verify payment' }); }
};
