import type { APIRoute } from 'astro';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KIT_API = 'https://api.kit.com/v4';

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

async function readDetail(res: Response): Promise<unknown> {
  try {
    const raw = await res.text();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
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

  const headers = {
    'content-type': 'application/json',
    'X-Kit-Api-Key': apiKey,
  };

  try {
    // Step 1 — upsert the subscriber. POST /v4/subscribers behaves as an
    // upsert and returns the subscriber object whether it's new or existing.
    // (Kit's /v4/forms/{id}/subscribers add-by-email endpoint 404s on
    // newer Designer-style forms; the create-then-attach flow is reliable.)
    const createRes = await fetch(`${KIT_API}/subscribers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email_address: email }),
    });

    if (createRes.status !== 200 && createRes.status !== 201) {
      const detail = await readDetail(createRes);
      console.error(
        '[subscribe] Kit create-subscriber failed',
        createRes.status,
        redactEmail(detail)
      );
      return json(
        { success: false, error: 'Subscription failed. Please try again later.' },
        502
      );
    }

    const createBody = (await createRes.json().catch(() => null)) as
      | { subscriber?: { id?: number; created_at?: string } }
      | null;
    const subscriberId = createBody?.subscriber?.id;
    if (!subscriberId) {
      console.error(
        '[subscribe] Kit returned no subscriber id',
        redactEmail(createBody)
      );
      return json(
        { success: false, error: 'Subscription failed. Please try again later.' },
        502
      );
    }

    // Heuristic for "already subscribed": create returned 200 (existing) and
    // we'll still attach to the form to be idempotent.
    const alreadyExisted = createRes.status === 200;

    // Step 2 — attach the subscriber to our form so any form-specific
    // automations / sequences fire.
    const attachRes = await fetch(
      `${KIT_API}/forms/${formId}/subscribers/${subscriberId}`,
      { method: 'POST', headers }
    );
    if (attachRes.status !== 200 && attachRes.status !== 201) {
      const detail = await readDetail(attachRes);
      console.error(
        '[subscribe] Kit attach-to-form failed',
        attachRes.status,
        redactEmail(detail)
      );
      // The subscriber was created — surface success to the user but log
      // the attach failure so we can fix it server-side.
      return json({ success: true, alreadySubscribed: alreadyExisted });
    }

    return json({ success: true, alreadySubscribed: alreadyExisted });
  } catch (err) {
    console.error('[subscribe] network error', err);
    return json(
      { success: false, error: 'Network error. Please try again.' },
      502
    );
  }
};
