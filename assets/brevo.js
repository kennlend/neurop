/**
 * NeuroPouch — Brevo contact API helper
 *
 * Lists:
 *   WHITELIST    = 7  (waitlist / general subscribers)
 *   DISTRIBUTORS = 8  (wholesale / reseller applicants)
 *
 * The API key is injected at runtime via a Netlify serverless function
 * (/api/subscribe) so it is never exposed in client-side code.
 */

const LIST_WHITELIST    = 7;
const LIST_DISTRIBUTORS = 8;

/**
 * addToBrevo({ email, firstName, lastName, listId, attributes })
 * Posts to our own Netlify function which proxies to Brevo.
 * Returns { ok: true } on success or { ok: false, error } on failure.
 */
async function addToBrevo({ email, firstName = '', lastName = '', listId, attributes = {} }) {
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, firstName, lastName, listId, attributes }),
    });

    const json = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    return { ok: false, error: json.error || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
