const DEFAULT_CONTACT_EMAIL = 'info@getneuropouch.com';

function json(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
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

function row(label, value) {
  if (!value) return '';
  return `<tr><th align="left" style="padding:0 16px 8px 0;vertical-align:top;color:#1C2B4A">${escapeHtml(label)}</th><td style="padding:0 0 8px">${escapeHtml(value)}</td></tr>`;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.BREVO_API_KEY) return json(500, { error: 'Server misconfiguration' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const {
    form = 'contact', name = '', email = '', company = '', phone = '',
    subject = '', volume = '', deadline = '', message = '',
  } = body;
  const cleanEmail = String(email).trim();
  const cleanMessage = String(message).trim();
  if (!cleanEmail || !cleanMessage) {
    return json(400, { error: 'Email and message are required' });
  }

  const recipient = process.env.CONTACT_TO_EMAIL || DEFAULT_CONTACT_EMAIL;
  const sender = process.env.CONTACT_FROM_EMAIL
    || process.env.TRANSACTIONAL_FROM_EMAIL
    || DEFAULT_CONTACT_EMAIL;
  const rows = [
    row('Form', form),
    row('Name', name),
    row('Email', cleanEmail),
    row('Company / outlet', company),
    row('Phone', phone),
    row('Topic', subject),
    row('Estimated volume', volume),
    row('Deadline', deadline),
  ].join('');

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: sender, name: 'NeuroPouch' },
        to: [{ email: recipient, name: 'NeuroPouch' }],
        replyTo: { email: cleanEmail, ...(name ? { name: String(name).trim() } : {}) },
        subject: `New NeuroPouch ${String(form).replace(/^contact-/, '')} enquiry`,
        htmlContent: `<h2 style="color:#1C2B4A">New NeuroPouch enquiry</h2>
          <table style="font-family:Arial,sans-serif;color:#2D3142">${rows}</table>
          <h3 style="color:#1C2B4A">Message</h3>
          <p style="white-space:pre-wrap;font-family:Arial,sans-serif;color:#2D3142">${escapeHtml(cleanMessage)}</p>`,
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || `Email delivery failed (${response.status})`);
    }
    return json(200, { ok: true });
  } catch (error) {
    console.error('Contact form delivery failed', error.message);
    return json(500, { error: 'Unable to send message' });
  }
};
