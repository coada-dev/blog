# blog

The source for [`blog.coada.dev`](https://blog.coada.dev). A minimal personal
blog: typography-first, zero client-side JavaScript on every page that doesn't
need it, light + dark via `prefers-color-scheme`, deployed as static HTML to
Vercel.

Content is authored on [Hashnode](https://hashnode.com) and pulled in at build
time over GraphQL. The site itself is a [presentation
layer](#why-headless) — Hashnode owns drafting, scheduling, and the editor;
this repo owns rendering.

## Stack

| Layer            | Choice                              |
| ---------------- | ----------------------------------- |
| Static generator | [Astro](https://astro.build) 6      |
| Adapter          | `@astrojs/vercel` 10                |
| Content source   | Hashnode GraphQL (`gql.hashnode.com`) |
| GraphQL client   | `graphql-request`                   |
| Newsletter       | [Kit](https://kit.com) (formerly ConvertKit) |
| Styling          | One vanilla CSS file (~660 lines)   |
| Hosting          | Vercel + custom subdomain           |
| Analytics        | Vercel Web Analytics                |

No CSS framework, no JS framework, no build tooling beyond what Astro ships.
The full architecture and rationale lives in
[`PROJECT_SPEC.md`](./PROJECT_SPEC.md), including the eight ADRs that shaped
the major decisions.

## Why headless

Hashnode has a great editor, drafts, scheduling, subscribers, and CDN-hosted
images. It also has a default theme that I didn't want to use. Headless mode
keeps the parts I want and lets me own the frontend completely.

The data flow:

```
┌───────────┐    GraphQL (build-time)    ┌─────────┐
│ Hashnode  │ ◄──────────────────────────│  Astro  │
│ (headless)│                            │ (build) │
└───────────┘                            └────┬────┘
                                              │
                                          astro build
                                              │
                                       ┌──────▼──────┐
                                       │  dist/      │
                                       │  static     │
                                       │  HTML + CSS │
                                       └──────┬──────┘
                                              │
                                            Vercel
                                              │
                                       ┌──────▼──────┐
                                       │  blog.      │
                                       │  coada.dev  │
                                       └─────────────┘
```

Publishing on Hashnode fires a webhook into a Vercel deploy hook, which
re-runs `astro build`. The new post is live in about a minute.

## Project layout

```
.
├── astro.config.mjs            # site URL + sitemap + Vercel adapter
├── public/
│   ├── assets/coada.svg        # logo (with embedded gradient fills)
│   └── robots.txt
├── src/
│   ├── components/             # SiteHeader, SiteFooter, PostList,
│   │                           # PostMeta, SeriesNav, AdjacentNav,
│   │                           # Tags, SubscribeForm
│   ├── layouts/BaseLayout.astro
│   ├── lib/
│   │   ├── client.ts           # GraphQL client
│   │   ├── data.ts             # paginated fetchers
│   │   ├── jsonld.ts           # WebSite/Org/Person/BlogPosting graph
│   │   ├── queries.ts          # GraphQL strings
│   │   └── site.ts             # author + site constants
│   ├── pages/
│   │   ├── index.astro         # post listing
│   │   ├── about.astro
│   │   ├── [slug].astro        # post pages (getStaticPaths)
│   │   ├── series/[slug].astro # series landing pages
│   │   ├── api/subscribe.ts    # the only server route — Kit proxy
│   │   └── rss.xml.ts
│   └── styles/global.css       # the entire stylesheet
└── PROJECT_SPEC.md             # architecture spec + ADRs
```

## Local development

```bash
git clone https://github.com/coada-dev/blog.git
cd blog
cp .env.example .env            # fill in the values described below
npm install
npm run dev                     # serve on http://localhost:4321
npm run build                   # produces dist/ and .vercel/output/
```

Astro 6 requires Node ≥ 22.12.

### Environment variables

| Variable                      | Required          | What it does                             |
| ----------------------------- | ----------------- | ---------------------------------------- |
| `HASHNODE_PUBLICATION_HOST`   | always            | e.g. `yourblog.hashnode.dev` — the GraphQL `host` arg used at build time. |
| `SITE_URL`                    | always            | Canonical site URL. Drives RSS, OG, JSON-LD, sitemap. |
| `KIT_API_KEY`                 | for `/api/subscribe` | Server-side Kit secret. Generate at *Kit → Settings → Developer*. Never reaches the client. |
| `KIT_FORM_ID`                 | for `/api/subscribe` | Numeric id of the Kit form to attach subscribers to. |

There is no Hashnode access token — the public GraphQL endpoint exposes
published posts without authentication, and newsletter is on Kit.

## How content flows

- **Posts** — every `getStaticPaths` walk hits Hashnode's `posts(first, after)`
  connection, paginated 20 per page (Hashnode's hard cap), until
  `pageInfo.hasNextPage` is false.
- **Body rendering** — `content.html` is injected via Astro's `set:html`
  (see [ADR-006 in the spec](./PROJECT_SPEC.md)). Hashnode pre-highlights code
  blocks and emits embed markup for `%[url]` shortcodes, so we don't run a
  remark pipeline.
- **Series** — handled the same way; `series.posts` is paginated separately
  and ordered by `series.sortOrder`.
- **RSS** — `/rss.xml` re-fetches each post's full HTML and emits it as
  `<content:encoded>`, so feed readers don't need a click-through.

## Subscribe path

There's exactly one server-rendered route: `/api/subscribe.ts`. Everything
else is prerendered HTML.

```
browser ── POST /api/subscribe (email + utm payload)
   ↓
Vercel serverless function
   ↓
1. POST https://api.kit.com/v4/subscribers           (upsert; 201 new, 200 existing)
2. POST /v4/forms/{form_id}/subscribers/{sub_id}     (attach to form)
   ↓ both calls carry a ?utm_*-encoded `referrer` so Kit records attribution
Kit
```

Kit's by-email add-to-form endpoint returns 404 on Designer-style forms; the
two-step flow is the workaround. The handler logs upstream errors with email
addresses redacted.

## SEO + analytics

| Thing                             | Where                                   |
| --------------------------------- | --------------------------------------- |
| `WebSite`/`Organization`/`Person` JSON-LD | every page (one `@graph`)        |
| `BlogPosting` JSON-LD             | post pages (extra graph node)           |
| `article:*` OG meta cluster       | post pages                              |
| `<meta name="author">`            | every page                              |
| Sitemap                           | `/sitemap-index.xml`, generated by `@astrojs/sitemap` |
| Robots                            | `public/robots.txt`                     |
| Analytics                         | Vercel Web Analytics (no consent banner needed) |
| First-touch UTM attribution       | Inline script in `BaseLayout` → `localStorage` → forwarded to Kit on subscribe |

The geo signal (Los Angeles, CA) lives in `Person.address` inside the
JSON-LD graph — invisible to readers, available to crawlers. There is no
keyword stuffing in body copy on purpose; it doesn't help technical content
rank, and it dilutes editorial voice.

## Deployment

The first time:

1. Create a Vercel project pointing at the repo. Vercel auto-detects Astro and
   sets `astro build` / `dist/` correctly.
2. In **Settings → Environment Variables**, add the four env vars above for
   both **Production** and **Preview**.
3. In **Settings → Git → Deploy Hooks**, create a hook on `main`. Copy the URL.
4. In Hashnode (**Settings → Webhooks**), point a webhook at the deploy hook
   URL. Subscribe to the publish/update/delete events.
5. In Hashnode (**Settings → Domain → Advanced → Headless CMS**), turn on
   headless mode and point it at your custom subdomain.

After that, publishing on Hashnode triggers a Vercel rebuild within ~60s.
Pushing code to `main` rebuilds via the standard Git integration.

## Performance + accessibility

Lighthouse on desktop, all four categories:

| Route   | Performance | Accessibility | Best Practices | SEO |
| ------- | ----------: | ------------: | -------------: | --: |
| Index   |         100 |           100 |            100 | 100 |
| Post    |         100 |           100 |            100 | 100 |
| Series  |         100 |           100 |            100 | 100 |
| About   |         100 |           100 |            100 | 100 |

The colour palette clears WCAG AA contrast in both light and dark modes.

## License

[MIT](./LICENSE) © Mike Dyer.

The code in this repo is MIT — fork it, lift the architecture, or copy the
styles. The post content (under `listenrightmeow.hashnode.dev`) is not in
this repo; it lives on Hashnode and is mine.

## Acknowledgements

- [Astro](https://astro.build) for being the right shape for content sites.
- [Hashnode](https://hashnode.com) for a headless mode that gets out of the way.
- [Kit](https://kit.com) for newsletter plumbing without bloat.
- [Vercel](https://vercel.com) for hosting + analytics.
- [mitchellh.com](https://mitchellh.com) and [t3.gg/blog](https://t3.gg/blog)
  for proof that "extreme restraint" is a perfectly fine design system.
