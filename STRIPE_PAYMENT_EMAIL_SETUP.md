# Stripe Checkout setup

The product page uses Stripe-hosted Checkout directly. WooCommerce is no longer
part of the purchase flow. Both Buy Now buttons use the create-checkout Netlify
function. No public Stripe key is needed.

## Deployment

1. Set STRIPE_SECRET_KEY in Netlify environment variables for functions. Use a
   test key first, then a live key after verifying a test purchase.
2. Set SITE_URL to https://getneuropouch.com (Netlify URL is the fallback).
3. Deploy this repository, including functions and redirects.
4. Complete Neuropouch LLC business and invoice details in Stripe. Enable
   successful-payment emails in Stripe customer email settings, and merchant
   payment notifications for the team fulfilling orders.
5. Create the advertised 10% promotion code in Stripe. Checkout accepts active
   Stripe promotion codes.

Never commit keys. Static file previews do not run server functions. Use Netlify
Dev or a deployed preview for checkout testing.

## Orders, invoices and delivery

Stripe collects email, billing address, a required phone number, and delivery
address. Customer phone and delivery details are available in Stripe for
fulfillment. Checkout creates the paid invoice. Fulfill only payments marked paid
in Stripe. Confirm receipt/invoice email delivery in test mode.

The return page verifies payment status server-side before showing confirmation.

## Pricing

Server-controlled prices: 5-pack EUR49.90; 1 tower EUR99.00; 2 towers EUR168.30;
3 towers EUR237.60; 4+ towers EUR79.20 per tower. Each tower contains 10 tins.
Quantity is limited to 99 packs or towers.

Shipping is EUR4.95 up to EUR50 and free above EUR50, based on the basket before
promotion codes. Delivery countries are the EU member states and the UK. Review
these settings and applicable tax treatment against business settings before launch.

## Legacy webhook

The earlier /api/stripe-payment handler remains for older Payment Intents.
It skips new payments marked metadata.source=neuropouch_checkout because Checkout
handles their invoices. STRIPE_WEBHOOK_SECRET and BREVO_API_KEY are needed only
if retaining that legacy handler; neither is required to start new checkouts.

## Test before live sales

Check every bundle, multiple quantities, phone/address collection, shipping,
promotion codes, payment cancellation, declined cards and 3DS. After a successful
test, verify the paid order, customer phone, delivery address and invoice in
Stripe, plus receipt delivery and merchant notification. Switch to live keys
only after these checks pass.
