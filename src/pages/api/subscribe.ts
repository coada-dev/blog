import type { APIRoute } from 'astro';
import { hashnodeAuthed, publicationHost, hashnode } from '../../lib/client';
import { SUBSCRIBE_TO_NEWSLETTER } from '../../lib/queries';
import { gql } from 'graphql-request';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PUBLICATION_ID_QUERY = gql`
  query PublicationId($host: String!) {
    publication(host: $host) {
      id
    }
  }
`;

let cachedPublicationId: string | null = null;

async function getPublicationId(): Promise<string> {
  if (cachedPublicationId) return cachedPublicationId;
  const host = publicationHost();
  const data: any = await hashnode.request(PUBLICATION_ID_QUERY, { host });
  const id = data?.publication?.id;
  if (!id) {
    throw new Error(`Could not resolve publication id for host ${host}`);
  }
  cachedPublicationId = id;
  return id;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
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

  try {
    const publicationId = await getPublicationId();
    const client = hashnodeAuthed();
    const data: any = await client.request(SUBSCRIBE_TO_NEWSLETTER, {
      input: { email, publicationId },
    });
    const status = data?.subscribeToNewsletter?.status;
    if (!status) {
      return json({ success: false, error: 'Subscription failed.' }, 502);
    }
    return json({ success: true, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ success: false, error: message }, 500);
  }
};
