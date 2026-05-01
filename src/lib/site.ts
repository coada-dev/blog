const RESOLVED_SITE_URL = (
  import.meta.env.SITE_URL ?? 'https://blog.coada.dev'
).replace(/\/$/, '');

export const site = {
  name: 'Coada',
  url: RESOLVED_SITE_URL,
  language: 'en-US',
  description:
    'Notes on engineering, infrastructure, and the systems we build at Coada.',
} as const;

export const author = {
  name: 'Mike Dyer',
  alternateName: 'listenrightmeow',
  email: 'hello@coada.dev',
  address: {
    locality: 'Los Angeles',
    region: 'CA',
    country: 'US',
  },
  sameAs: [
    'https://github.com/listenrightmeow',
    'https://x.com/hichkntoes',
    'https://linkedin.com/in/listenrightmeow',
    'https://listenrightmeow.hashnode.dev',
  ],
} as const;

export const organization = {
  name: 'Coada',
  url: 'https://coada.dev',
  logo: `${RESOLVED_SITE_URL}/assets/coada.svg`,
} as const;

export const ids = {
  website: `${RESOLVED_SITE_URL}/#website`,
  organization: `${RESOLVED_SITE_URL}/#organization`,
  person: `${RESOLVED_SITE_URL}/#person`,
} as const;
