// netlify/functions/subscribe.js
// Proxies Brevo contact creation — keeps the API key server-side only.
// Deploy env var: BREVO_API_KEY

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { email, firstName, lastName, listId, attributes = {} } = body;
  if (!email || !listId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'email and listId are required' }) };
  }

  const payload = {
    email,
    listIds: [listId],
    updateEnabled: true,
    attributes: {
      ...attributes,
      ...(firstName ? { FIRSTNAME: firstName } : {}),
      ...(lastName  ? { LASTNAME:  lastName  } : {}),
    },
  };

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // 201 created, 204 updated — both success
    if (res.status === 201 || res.status === 204) {
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    const json = await res.json().catch(() => ({}));
    return {
      statusCode: res.status,
      body: JSON.stringify({ error: json.message || `Brevo error ${res.status}` }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
