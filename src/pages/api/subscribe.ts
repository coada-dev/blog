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
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => null);
    }
    console.error('[subscribe] Kit error', res.status, detail);
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
