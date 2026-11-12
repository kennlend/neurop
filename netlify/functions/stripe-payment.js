// Creates a paid Stripe invoice and sends a customer confirmation after a
// successful payment. Configure this function as a Stripe webhook endpoint.
const crypto = require('crypto');

const STRIPE_API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const DEFAULT_FROM_EMAIL = 'info@getneuropouch.com';

function json(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

function verifyStripeSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;

  const parts = Object.fromEntries(
    signature.split(',').map(part => {
      const [key, value] = part.split('=');
      return [key, value];
    }),
  );
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || !parts.v1) return false;
  if (Math.abs((Date.now() / 1000) - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody}`, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(parts.v1, 'utf8');
  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function formBody(values) {
  return new URLSearchParams(
    Object.entries(values).flatMap(([key, value]) => {
      if (value === undefined || value === null || value === '') return [];
      return [[key, String(value)]];
    }),
  ).toString();
}

async function stripeRequest(path, { method = 'GET', data, idempotencyKey } = {}) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(data ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    ...(data ? { body: formBody(data) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error?.message || `Stripe request failed (${response.status})`);
  }
  return result;
}

function detailsFor(paymentIntent) {
  const charge = typeof paymentIntent.latest_charge === 'object'
    ? paymentIntent.latest_charge
    : {};
  const billing = charge.billing_details || {};
  const shipping = paymentIntent.shipping || charge.shipping || {};
  const address = billing.address || shipping.address || {};
  return {
    email: paymentIntent.receipt_email || billing.email || shipping.email,
    name: billing.name || shipping.name,
    address,
  };
}

async function getOrCreateInvoice(paymentIntent) {
  const existingInvoiceId = paymentIntent.metadata?.neurop_invoice_id;
  if (existingInvoiceId) {
    return stripeRequest(`/invoices/${existingInvoiceId}`);
  }

  const details = detailsFor(paymentIntent);
  let customerId = paymentIntent.customer;
  if (!customerId) {
    const customer = await stripeRequest('/customers', {
      method: 'POST',
      idempotencyKey: `neurop-customer-${paymentIntent.id}`,
      data: {
        email: details.email,
        name: details.name,
        'address[line1]': details.address.line1,
        'address[line2]': details.address.line2,
        'address[city]': details.address.city,
        'address[postal_code]': details.address.postal_code,
        'address[state]': details.address.state,
        'address[country]': details.address.country,
        'metadata[source_payment_intent]': paymentIntent.id,
      },
    });
    customerId = customer.id;
  }

  const orderReference = paymentIntent.metadata?.order_number
    || paymentIntent.metadata?.order_id
    || paymentIntent.description
    || `Order ${paymentIntent.id}`;
  const draft = await stripeRequest('/invoices', {
    method: 'POST',
    idempotencyKey: `neurop-invoice-${paymentIntent.id}`,
    data: {
      customer: customerId,
      // The card payment has already succeeded. We finalise this as a record
      // and mark it paid out of band, rather than attempting another charge.
      collection_method: 'charge_automatically',
      auto_advance: false,
      description: orderReference,
      'metadata[source_payment_intent]': paymentIntent.id,
    },
  });
  await stripeRequest('/invoiceitems', {
    method: 'POST',
    idempotencyKey: `neurop-invoice-item-${paymentIntent.id}`,
    data: {
      customer: customerId,
      invoice: draft.id,
      amount: paymentIntent.amount_received || paymentIntent.amount,
      currency: paymentIntent.currency,
      description: orderReference,
      'metadata[source_payment_intent]': paymentIntent.id,
    },
  });
  const finalised = await stripeRequest(`/invoices/${draft.id}/finalize`, {
    method: 'POST',
    idempotencyKey: `neurop-invoice-finalize-${paymentIntent.id}`,
  });
  const paid = await stripeRequest(`/invoices/${finalised.id}/pay`, {
    method: 'POST',
    idempotencyKey: `neurop-invoice-pay-${paymentIntent.id}`,
    data: { paid_out_of_band: true },
  });

  // Storing the generated invoice on the payment prevents Stripe's retries
  // from creating another invoice for the same charge.
  await stripeRequest(`/payment_intents/${paymentIntent.id}`, {
    method: 'POST',
    data: { 'metadata[neurop_invoice_id]': paid.id },
  });
  return paid;
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: (currency || 'eur').toUpperCase(),
  }).format((amount || 0) / 100);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

async function sendConfirmation({ paymentIntent, invoice }) {
  const details = detailsFor(paymentIntent);
  if (!details.email) return false;

  const total = formatMoney(paymentIntent.amount_received || paymentIntent.amount, paymentIntent.currency);
  const orderReference = paymentIntent.metadata?.order_number
    || paymentIntent.metadata?.order_id
    || paymentIntent.description
    || paymentIntent.id;
  const invoiceLinks = [
    invoice.hosted_invoice_url && `<a href="${escapeHtml(invoice.hosted_invoice_url)}">View your invoice</a>`,
    invoice.invoice_pdf && `<a href="${escapeHtml(invoice.invoice_pdf)}">Download the PDF invoice</a>`,
  ].filter(Boolean).join(' &nbsp;|&nbsp; ');

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: process.env.TRANSACTIONAL_FROM_EMAIL || DEFAULT_FROM_EMAIL,
        name: process.env.TRANSACTIONAL_FROM_NAME || 'NeuroPouch',
      },
      to: [{ email: details.email, ...(details.name ? { name: details.name } : {}) }],
      subject: 'Your NeuroPouch order is confirmed',
      htmlContent: `<p>Hi${details.name ? ` ${escapeHtml(details.name)}` : ''},</p>
        <p>Thanks for your order. Your payment of <strong>${total}</strong> has been received.</p>
        <p><strong>Order reference:</strong> ${escapeHtml(orderReference)}</p>
        <p>${invoiceLinks || 'Your paid invoice is being prepared.'}</p>
        <p>We’ll send a separate update when your order is on its way.</p>
        <p>NeuroPouch</p>`,
    }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || `Brevo request failed (${response.status})`);
  }
  return true;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY || !process.env.BREVO_API_KEY) {
    return json(500, { error: 'Server misconfiguration' });
  }

  const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!verifyStripeSignature(event.body, signature, process.env.STRIPE_WEBHOOK_SECRET)) {
    return json(400, { error: 'Invalid Stripe signature' });
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(event.body);
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  if (stripeEvent.type !== 'payment_intent.succeeded') return json(200, { received: true });

  try {
    // Re-fetch so the charge's billing details are available even when they
    // were not expanded in Stripe's webhook payload.
    const paymentIntent = await stripeRequest(
      `/payment_intents/${stripeEvent.data.object.id}?expand[]=latest_charge`,
    );
    // Hosted Checkout creates its own paid invoice and Stripe sends receipts.
    if (paymentIntent.metadata?.source === 'neuropouch_checkout') {
      return json(200, { received: true });
    }
    const invoice = await getOrCreateInvoice(paymentIntent);
    if (!paymentIntent.metadata?.neurop_confirmation_sent_at) {
      const sent = await sendConfirmation({ paymentIntent, invoice });
      if (sent) {
        await stripeRequest(`/payment_intents/${paymentIntent.id}`, {
          method: 'POST',
          data: { 'metadata[neurop_confirmation_sent_at]': new Date().toISOString() },
        });
      }
    }
    return json(200, { received: true });
  } catch (error) {
    console.error('Stripe payment webhook failed', error.message);
    // Non-2xx tells Stripe to retry. The invoice ID on the payment intent
    // makes the retry continue safely after an intermittent failure.
    return json(500, { error: 'Unable to process payment notification' });
  }
};
