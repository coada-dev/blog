import type { APIRoute } from 'astro';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KIT_ENDPOINT = 'https://api.kit.com/v4/forms';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const EMAIL_GLOBAL_RE = /[^\s"<>]+@[^\s"<>]+\.[^\s"<>]+/g;

/** Recursively strip email addresses from an upstream payload before logging. */
function redactEmail(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(EMAIL_GLOBAL_RE, '[redacted]');
  if (Array.isArray(value)) return value.map(redactEmail);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = k.toLowerCase().includes('email') ? '[redacted]' : redactEmail(v);
    }
    return out;
  }
  return value;
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.KIT_API_KEY;
  const formId = import.meta.env.KIT_FORM_ID;
  if (!apiKey || !formId) {
    console.error('[subscribe] KIT_API_KEY or KIT_FORM_ID is not set');
    return json(
      { success: false, error: 'Subscriptions are not configured.' },
      503
    );
  }

  let email: string | undefined;
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email.trim() : undefined;
  } catch {
    return json({ success: false, error: 'Invalid request body.' }, 400);
  }

  if (!email || !EMAIL_RE.test(email)) {
    return json({ success: false, error: 'Please enter a valid email.' }, 400);
  }

  const referrer = request.headers.get('referer') ?? undefined;

  try {
    const res = await fetch(`${KIT_ENDPOINT}/${formId}/subscribers`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Kit-Api-Key': apiKey,
      },
      body: JSON.stringify({ email_address: email, referrer }),
    });

    // Kit returns 201 for a brand-new subscription and 200 if the address
    // was already subscribed to this form.
    if (res.status === 201) {
      return json({ success: true });
    }
    if (res.status === 200) {
      return json({ success: true, alreadySubscribed: true });
    }

    let detail: unknown = null;
    try {
      // Read the body once — calling res.json() then res.text() consumes the
      // stream and the second read returns nothing. Read text first, then try
      // to parse, falling back to the raw string.
      const raw = await res.text();
      if (raw) {
        try {
          detail = JSON.parse(raw);
        } catch {
          detail = raw;
        }
      }
    } catch {
      detail = null;
    }
    // Avoid logging the submitted email — Kit echoes subscriber fields in
    // error payloads. Pull a status/message summary instead.
    const safeDetail = redactEmail(detail);
    console.error('[subscribe] Kit error', res.status, safeDetail);
    return json(
      { success: false, error: 'Subscription failed. Please try again later.' },
      502
    );
  } catch (err) {
    console.error('[subscribe] network error', err);
    return json(
      { success: false, error: 'Network error. Please try again.' },
      502
    );
  }
};
