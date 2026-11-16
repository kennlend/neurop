# NeuroPouch Analytics

- GA4 property: neurogroup, 540427404
- Web stream: neuropouch lander, 15013697534
- Measurement ID: G-KFBM8WT6HR
- GTM container: GTM-PH2N6VKS
- Website: https://getneuropouch.com

The storefront loads GTM only. Do not add a second standalone gtag config.

## Container configuration

Google Analytics destination: G-KFBM8WT6HR, Initialization - All Pages.
GA4 event tag: dynamic event name {{Event}}, ecommerce from the Data Layer.
Custom event regex: ^(begin_checkout|purchase|sign_up|view_item)$

## Events

- page_view: sent by the Google Analytics destination.
- view_item: initial product page view.
- begin_checkout: after a Stripe session is created; waits for the tag callback
  or a short timeout before leaving for Stripe.
- sign_up: successful homepage/product newsletter signup only.
- purchase: only after the return page verifies payment with Stripe.

Purchase totals and items come from Stripe, excluding shipping and tax from the
revenue value. Contact, delivery and payment details are never included.
The Stripe session ID is the transaction ID. Local storage suppresses repeat
purchase events on reload; GA4 transaction ID deduplication is an additional
protection.

## Purchase coverage

This is browser return-page tracking, not a server-to-server webhook. Customers
who do not return from Stripe, block analytics, or complete delayed payments
after leaving may not appear as purchases in GA4. Stripe remains the payment and
fulfillment source of truth. Historical sales are not backfilled.

## Verification

Use GA4 Realtime and Tag Assistant to verify page_view, view_item and
begin_checkout. Test purchase tracking with a real completed test-mode Stripe
session; never fabricate production purchase events. Standard reports can take
24-48 hours to update.

The old WooCommerce stream is retired and is not used for the current checkout.
