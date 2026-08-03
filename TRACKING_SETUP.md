# NeuroPouch Tracking Setup

## Current source of truth

- GTM container: `GTM-PH2N6VKS`
- GA4 measurement ID: `G-XK4T95QPB0`
- Storefront domain: `getneuropouch.com`
- WooCommerce order domain: `order.getneuropouch.com`

All site tracking should route through Google Tag Manager. The static storefront loads GTM only and pushes ecommerce events into `dataLayer`.

## Required WordPress changes

The order domain currently loads Google Site Kit with `GT-5M3GVL6X`, not the GTM container used by the storefront. Fix this in WordPress before expecting sales to appear in the same GA4 ecommerce reports.

1. Install or enable a GTM plugin on `order.getneuropouch.com`.
2. Add container `GTM-PH2N6VKS` to every WordPress/WooCommerce page.
3. Disable the standalone Site Kit Google Analytics tag unless it is explicitly configured to send to the same GA4 property and does not duplicate page views.
4. Enable WooCommerce ecommerce events for GA4:
   - `view_item`
   - `add_to_cart`
   - `begin_checkout`
   - `purchase`
5. Confirm the purchase event includes:
   - `transaction_id`
   - `currency: EUR`
   - `value`
   - `items[].item_id`
   - `items[].item_name`
   - `items[].price`
   - `items[].quantity`

## Required GTM / GA4 settings

In GTM, the GA4 tag should send to `G-XK4T95QPB0`.

Cross-domain tracking must include both domains:

- `getneuropouch.com`
- `order.getneuropouch.com`

In GA4 Admin, add both domains under unwanted referrals / cross-domain configuration as appropriate, so checkout does not show as a fresh referral from the order subdomain.

## Acquisition reports

Once tracking is unified, use these GA4 reports:

- Reports -> Acquisition -> User acquisition
- Reports -> Acquisition -> Traffic acquisition
- Reports -> Business objectives -> Drive sales -> Ecommerce purchases
- Explore -> Free form with dimensions:
  - Session source / medium
  - First user source / medium
  - Campaign
  - Landing page
  - Hostname

Use `Hostname` to confirm traffic from both domains is entering the same property.
