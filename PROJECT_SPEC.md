# Project Specification: Minimal Blog (Astro + Headless Hashnode)

**Version:** 1.5  
**Date:** April 29, 2026  
**Status:** Draft — Series support, content rendering, RSS, scheduled posts resolved

---

## 1. Project Overview

Build a minimal, fast, personal blog inspired by the design of mitchellh.com and t3.gg/blog. The site uses Astro as the static site generator and Hashnode as a headless CMS. Content is authored and managed entirely in Hashnode, fetched via GraphQL at build time, and rendered as static HTML. The output is a zero-JavaScript site deployed to `blog.coada.dev`.

Hashnode operates in **headless mode** — all content authoring, authentication, drafts, and subscriber management remain on Hashnode's platform. This project is the presentation layer, with one server-side write path: a newsletter subscribe endpoint that proxies subscriptions to Hashnode's API.

### 1.1 Goals

- Content authorship lives in Hashnode (rich editor, drafts, scheduling, collaboration features come free).
- The frontend is fully custom — Hashnode controls content, not presentation.
- The site ships zero client-side JavaScript by default (Astro's core value proposition). The only exception is ~15 lines of inline JS for the newsletter subscribe form.
- Design is intentionally minimal: typography-first, content-focused, no visual clutter.
- The build is a single command that produces a complete, self-contained static site.

### 1.2 Non-Goals

- No authentication or user management of any kind. Hashnode headless mode owns this entirely.
- No CSS framework (Tailwind, Bootstrap, etc.). Vanilla CSS only — see ADR-002.
- No JavaScript framework (React, Vue, Svelte). Astro components render to static HTML.
- No comments system on the frontend (readers can comment on Hashnode directly if desired).
- No search functionality in v1.
- No analytics baked in (can be added independently via a script tag).
- No client-side routing or SPA behavior.
- No image optimization pipeline beyond what Hashnode's CDN already provides.

---

## 2. Design Requirements

### 2.1 Design Philosophy

The visual target is the style of mitchellh.com — extreme restraint. Every element must justify its presence. The design should feel like a well-typeset document, not a "website."

### 2.2 Layout

- **Max content width:** ~680px, centered.
- **Navigation:** Site name (top-left, links to home), and 2–3 text links (e.g., About, Writing). No hamburger menu, no dropdowns.
- **Footer:** Copyright line, 3–5 social icon links (GitHub, Twitter/X, LinkedIn, email). Minimal.
- **No sidebar.** No widget areas. No secondary navigation.

### 2.3 Typography

- **Body font:** A system font stack or a single high-quality serif/sans-serif web font. No font loading waterfall — either system stack or a single self-hosted font file.
- **Headings:** Same family as body, differentiated by weight and size only.
- **Body size:** 16–18px base, ~1.6–1.7 line height.
- **Code blocks:** Monospace system font stack. Syntax highlighting via Astro's built-in Shiki integration (build-time, no client JS).

### 2.4 Color

- **Light mode only in v1.** Dark mode is a future consideration (see ADR-004).
- **Palette:** Near-black text (#1a1a1a–#333), white/off-white background (#fff–#fafafa), a single muted accent for links (e.g., blue-gray). No gradients, no decorative color.

### 2.5 Pages

Since the site lives at `blog.coada.dev` (a dedicated subdomain), `/` is the blog itself. No separate about/landing page is needed — that lives on the parent domain.

| Page | Route | Description |
|------|-------|-------------|
| Post Index | `/` | Chronological list of all posts. Each entry: title (linked), date, and series name if applicable. |
| Individual Post | `/[slug]` | Full post content. Title, meta line (date, reading time, series), body, series nav, subscribe form. |
| Series Landing | `/series/[slug]` | All posts in a series, in the author-defined sort order. Series name, description, and ordered post list. |

### 2.6 Post Index Design

Each post in the list is a single row containing:

```
[Post Title]                                        [Month Day, Year]
  Part of: Series Name
```

- Title is a link to the post page.
- Date is right-aligned or placed below the title on small screens.
- If the post belongs to a series, the series name appears as a subtle secondary line below the title, linked to the series landing page (`/series/[slug]`). If the post has no series, this line is absent.
- No tags, no excerpts, no cover images, no author avatars, no read-time in the listing.
- Posts are sorted reverse-chronologically. Series membership does not alter the chronological order — a post in a series still appears in the main feed at its publication date.

### 2.7 Post Page Design

The post page contains, in order:

1. **Title** — large heading.
2. **Meta line** — date, reading time, and series indicator if applicable. Examples:
   - Standalone post: `January 10, 2026 · 8 min read`
   - Series post: `January 10, 2026 · 8 min read · Part 3 of Building a Terminal Emulator`
   - The series name in the meta line links to the series landing page (`/series/[slug]`).
3. **Post body** — rendered HTML from Hashnode.
4. **Series navigation** (conditional) — if the post belongs to a series, a prev/next block appears below the body:
   ```
   ─────────────────────────────────────────────────
   Part 3 of "Building a Terminal Emulator"
   ← Part 2: VT Parsing       Part 4: Font Rendering →
   ─────────────────────────────────────────────────
   ```
   - Shows the series name (linked), the current position, and links to the previous and next posts in the series (by series sort order, not by publication date).
   - If this is the first or last post in the series, the corresponding link is absent.
5. **Subscribe form** — a minimal email input and submit button below the series nav (or directly below the body if no series). See Section 4.4.
6. **No "share" buttons, no "related posts," no author bio block.**

### 2.8 Responsive Behavior

- The site is a single column at all breakpoints. No layout shifts.
- On narrow screens, the content area has horizontal padding (16–24px).
- Navigation stacks vertically only if necessary; with 2–3 links it should never need to.

---

## 3. Technical Requirements

### 3.1 Stack

| Layer | Technology | Version Constraint |
|-------|------------|--------------------|
| Static Site Generator | Astro | ^4.x (latest stable) |
| Astro Adapter | `@astrojs/vercel` | Required for `/api/subscribe` endpoint only |
| Content Source | Hashnode GraphQL API | Endpoint: `https://gql.hashnode.com` |
| GraphQL Client | `graphql-request` | Latest stable |
| Styling | Vanilla CSS | Single global stylesheet |
| Deployment Target | Vercel → `blog.coada.dev` | Free tier, Git integration, deploy hooks |

### 3.2 Hashnode API Integration

#### 3.2.1 Endpoint

All queries are `POST` requests to `https://gql.hashnode.com`. No authentication is required for reading public publication data.

#### 3.2.2 Publication Identifier

Posts are scoped to a Hashnode publication, identified by its `host` value (e.g., `yourblog.hashnode.dev` or a custom domain if mapped). This value is stored as an environment variable:

```
HASHNODE_PUBLICATION_HOST=yourblog.hashnode.dev
```

#### 3.2.3 Queries

**List all posts (index page):**

```graphql
query AllPosts($host: String!, $first: Int!, $after: String) {
  publication(host: $host) {
    id
    posts(first: $first, after: $after) {
      edges {
        node {
          id
          title
          slug
          brief
          publishedAt
          readTimeInMinutes
          series {
            name
            slug
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
}
```

Pagination: The API uses cursor-based pagination (`first` / `after`). The build-time fetcher must loop through all pages until `hasNextPage` is `false`. A reasonable page size is 20.

**Important:** Always include `id` on both the `publication` and each `node`. This ensures Hashnode's edge cache (Stellate) invalidates correctly when content changes.

**Post visibility:** The Hashnode public API (unauthenticated) returns **only published posts**. Drafts and scheduled posts are excluded automatically — no additional filtering is required. Scheduled posts will appear in the API response only after their scheduled publish time has passed. This means a build triggered before a scheduled post's publish time will not include it; the next rebuild (via webhook or manual trigger) after the post goes live will pick it up.

**Single post (post page):**

```graphql
query SinglePost($host: String!, $slug: String!) {
  publication(host: $host) {
    id
    post(slug: $slug) {
      id
      title
      slug
      publishedAt
      readTimeInMinutes
      content {
        html
      }
      series {
        id
        name
        slug
      }
      coverImage {
        url
      }
      tags {
        name
        slug
      }
      seo {
        title
        description
      }
    }
  }
}
```

**Series with posts (series landing page):**

```graphql
query SeriesPosts($host: String!, $seriesSlug: String!, $first: Int!) {
  publication(host: $host) {
    id
    series(slug: $seriesSlug) {
      id
      name
      slug
      description {
        html
      }
      sortOrder
      posts(first: $first) {
        edges {
          node {
            id
            title
            slug
            brief
            publishedAt
            readTimeInMinutes
          }
        }
      }
    }
  }
}
```

The `sortOrder` field determines the display order on the series landing page (e.g., oldest-first for tutorials, newest-first for ongoing series). The series description is rendered above the post list.

**All series list (build-time, for generating series landing pages):**

```graphql
query AllSeries($host: String!, $first: Int!) {
  publication(host: $host) {
    id
    seriesList(first: $first) {
      edges {
        node {
          id
          name
          slug
        }
      }
    }
  }
}
```

#### 3.2.4 Data Flow

```
┌────────────┐     GraphQL (build time)     ┌───────────┐
│  Hashnode   │ ◄──────────────────────────  │   Astro   │
│  (headless │ ─────────────────────────►   │  (build)  │
│   mode)    │     JSON response            └─────┬─────┘
└────────────┘                                    │
                                            astro build
                                                  │
                                            ┌─────▼─────┐
                                            │  dist/     │
                                            │  (static   │
                                            │   HTML)    │
                                            └─────┬─────┘
                                                  │
                                              deploy
                                                  │
                                            ┌─────▼─────┐
                                            │  blog.     │
                                            │  coada.dev │
                                            └───────────┘
```

### 3.3 Project Structure

```
project-root/
├── astro.config.mjs
├── package.json
├── .env                          # HASHNODE_PUBLICATION_HOST, HASHNODE_ACCESS_TOKEN
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro      # HTML shell, <head>, nav, footer
│   ├── pages/
│   │   ├── index.astro           # Post listing (fetches all posts, prerendered)
│   │   ├── [slug].astro          # Dynamic post pages (getStaticPaths, prerendered)
│   │   ├── series/
│   │   │   └── [slug].astro      # Series landing pages (getStaticPaths, prerendered)
│   │   └── api/
│   │       └── subscribe.ts      # Server endpoint: proxies subscribe to Hashnode API
│   ├── lib/
│   │   ├── client.ts             # GraphQL client (graphql-request)
│   │   └── queries.ts            # GraphQL query strings + subscribe mutation
│   ├── styles/
│   │   └── global.css            # All site styles (~200 lines)
│   └── components/
│       ├── PostList.astro         # Post listing component (with optional series label)
│       ├── PostMeta.astro         # Date + reading time + series indicator
│       ├── SeriesNav.astro        # Prev/next navigation within a series
│       └── SubscribeForm.astro    # Email input + submit, minimal client JS
└── public/
    └── favicon.svg               # Minimal favicon
```

### 3.4 Build & Deploy

#### 3.4.1 Build Command

```bash
npm run build    # → runs `astro build`
```

This single command:
1. Astro starts the build.
2. Index page calls the Hashnode API, paginates through all posts (including series metadata), renders the listing.
3. `[slug].astro` calls `getStaticPaths()`, fetches all post slugs, then fetches full content for each, generates one HTML file per post.
4. `series/[slug].astro` calls `getStaticPaths()`, fetches all series via `seriesList`, then fetches each series with its ordered posts, generates one HTML file per series.
5. Output lands in `dist/`.

#### 3.4.2 Deploy

The `dist/` folder is deployed to the hosting platform behind `blog.coada.dev`. The site is static HTML and CSS, with one Vercel serverless function (`/api/subscribe`) for newsletter subscriptions.

#### 3.4.3 Rebuild Triggers

When new content is published on Hashnode, the site must be rebuilt. See **Section 7.4** for detailed setup instructions.

| Trigger | Mechanism |
|---------|-----------|
| **Content change** | Hashnode webhook → Vercel deploy hook (recommended, see 7.4) |
| **Code change** | Git push to `main` → Vercel auto-deploy |
| **Manual** | "Redeploy" in Vercel dashboard or `curl -X POST <deploy-hook-url>` |

### 3.5 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HASHNODE_PUBLICATION_HOST` | Yes | Your Hashnode publication host (e.g., `yourblog.hashnode.dev`) |
| `HASHNODE_ACCESS_TOKEN` | Yes | Hashnode personal access token — required for the `subscribeToNewsletter` mutation. Generated in Hashnode under Settings → Developer. **Server-side only — never exposed to the client.** |
| `SITE_URL` | Yes | `https://blog.coada.dev` — used for canonical URLs, RSS feed, and OG meta |

No authentication is needed for reading published content (queries). The access token is used exclusively by the server-side `/api/subscribe` endpoint to proxy newsletter subscriptions to Hashnode.

### 3.6 SEO & Meta

- Each post page sets `<title>` from the post title (or Hashnode SEO override if present).
- Each post page sets `<meta name="description">` from the post's `brief` field (or SEO override).
- A canonical URL is set on each post page.
- An RSS feed is generated at `/rss.xml` using Astro's `@astrojs/rss` integration, populated from the same Hashnode data. Each feed item includes the **full post HTML** (from `content.html`) in the `<content:encoded>` field, not just the excerpt. This makes the feed readable in feed readers without requiring a click-through.
- Open Graph and Twitter card meta tags are set per post.

### 3.7 Performance Targets

- **Lighthouse Performance:** 95+
- **Zero client-side JS** unless explicitly opted in per-component.
- **No layout shift** (CLS = 0).
- **Total page weight** (post page, excluding images): < 50KB.

---

## 4. Content Handling

### 4.1 Post Body Rendering

Hashnode's API returns post content in two formats: `content.html` (pre-rendered HTML) and `content.markdown` (raw markdown source). See **ADR-006** for the decision on which to consume.

Regardless of format, the rendering pipeline must handle:

- **Headings** (h2–h6) — styled for hierarchy within the post. No h1 in the body (the post title is the h1).
- **Code blocks** — fenced code blocks with language identifiers. Syntax highlighting via Astro's built-in Shiki integration (build-time, zero client JS) if using markdown; or Hashnode's own highlighting if using HTML.
- **Inline code** — monospace with subtle background.
- **Images** — rendered inline, sourced from Hashnode's CDN (see 4.2).
- **Tables** — GFM-style tables, responsive on narrow screens.
- **Blockquotes, lists (ordered/unordered), task lists, horizontal rules.**
- **Hashnode embeds** — Hashnode's editor supports a `%[url]` syntax for embedding YouTube, Twitter, GitHub repos, etc. The `content.html` field renders these as full embed markup. The `content.markdown` field preserves the raw `%[url]` syntax, which a standard remark pipeline will **not** render. This is a key factor in the HTML vs. markdown decision (see ADR-006).

#### 4.1.1 If Using `content.html` (Current Decision)

- Inject directly via `<article set:html={post.content.html} />`.
- CSS targets semantic elements within the `<article>` container (`article h2`, `article pre`, `article blockquote`, etc.).
- Code blocks arrive pre-highlighted from Hashnode. Test whether Hashnode's highlighting classes conflict with our styles; override if necessary.
- Hashnode embeds render correctly out of the box.

#### 4.1.2 If Using `content.markdown` (Alternative)

Would require:
- `remark` + `rehype` pipeline with `remark-gfm` (tables, strikethrough, task lists).
- `rehype-shiki` or Astro's built-in Shiki for syntax highlighting.
- A custom remark plugin to handle Hashnode's `%[url]` embed syntax, or accept that embeds won't render.
- Processing runs at build time inside `[slug].astro` or a utility function.

This path gives full control over HTML output but adds complexity and may break Hashnode-specific features.

### 4.2 Images

Images in post content are hosted on Hashnode's CDN (`cdn.hashnode.com`). We do **not** download or re-host these images at build time. They are served directly from Hashnode's CDN, which already handles resizing and format optimization.

Cover images are available via the API but are **not displayed** in v1 (matching the mitchellh.com aesthetic). The data is fetched and available for future use or for OG image meta tags.

### 4.3 Content Not Sourced from Hashnode

- The **navigation links** and **footer content** are hardcoded in the layout component.
- The **favicon** and any static assets live in `public/`.

### 4.4 Newsletter Subscribe

Hashnode includes built-in newsletter functionality with no subscriber limit. The GraphQL API exposes a `subscribeToNewsletter` mutation that registers an email address as a subscriber to your publication. Subscriber management (viewing subscribers, sending newsletters, unsubscribes) is handled entirely in the Hashnode dashboard.

#### 4.4.1 Architecture

The subscribe flow uses a server-side API endpoint to keep the Hashnode access token off the client:

```
┌──────────────┐     POST /api/subscribe      ┌──────────────┐
│  Browser     │ ─────────────────────────►   │  Vercel      │
│  (form)      │                              │  serverless  │
│              │ ◄─────────────────────────   │  function    │
└──────────────┘     { success: true }        └──────┬───────┘
                                                     │
                                              GraphQL mutation
                                              (with access token)
                                                     │
                                              ┌──────▼───────┐
                                              │  Hashnode     │
                                              │  API          │
                                              └──────────────┘
```

#### 4.4.2 Server Endpoint (`/api/subscribe`)

This is the only server-rendered route in the project. All other pages are prerendered at build time.

- **Method:** POST
- **Body:** `{ "email": "reader@example.com" }`
- **Response:** `{ "success": true }` or `{ "success": false, "error": "..." }`
- **Server-side logic:**
  1. Validate the email format.
  2. Call Hashnode's `subscribeToNewsletter` mutation with the publication ID and email, authenticated via the `HASHNODE_ACCESS_TOKEN` env var.
  3. Return the result.

**GraphQL mutation:**

```graphql
mutation SubscribeToNewsletter($input: SubscribeToNewsletterInput!) {
  subscribeToNewsletter(input: $input) {
    status
  }
}
```

#### 4.4.3 Frontend Component (`SubscribeForm.astro`)

A minimal form rendered at the bottom of each post page. It consists of:

- An email input field.
- A submit button.
- A small status message area (success/error feedback).

The form uses a small inline `<script>` tag to handle submission via `fetch()` to `/api/subscribe`. This is the **only client-side JavaScript** on the site. The script is ~15 lines — no framework, no dependencies.

**Design:** The form follows the same restrained aesthetic as the rest of the site. One line of text, one input, one button. No modal, no pop-up, no sticky bar.

#### 4.4.4 Astro Configuration

To support the server-rendered `/api/subscribe` endpoint alongside prerendered static pages, Astro uses **hybrid rendering**:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'static',
  adapter: vercel(),
});
```

All pages are prerendered by default (`output: 'static'`). The `/api/subscribe.ts` endpoint opts into server rendering with:

```ts
export const prerender = false;
```

This means the entire site remains static HTML served from the CDN, except for this one endpoint which runs as a Vercel serverless function.

### 4.5 Series

Hashnode's series feature groups related posts into an ordered collection (e.g., a multi-part tutorial, a devlog, a conference talk series). Series are created and managed in the Hashnode dashboard.

#### 4.5.1 Data Model

A Hashnode series has the following fields relevant to our frontend:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | Display name (e.g., "Building a Terminal Emulator") |
| `slug` | URL-safe identifier (e.g., `building-a-terminal-emulator`) |
| `description.html` | Optional description rendered as HTML |
| `sortOrder` | Author-defined ordering of posts within the series |

Each post optionally belongs to one series. When a post is fetched, its `series` field is either `null` (standalone post) or an object with `{ id, name, slug }`.

#### 4.5.2 Build-Time Data Flow

At build time, the site fetches series data in two ways:

1. **Per-post series membership** — the `AllPosts` and `SinglePost` queries include `series { name, slug }` on each post node. This drives the meta line indicator and the post index labeling.
2. **Full series data** — the `AllSeries` query fetches all series slugs, then `SeriesPosts` fetches each series with its ordered post list. This drives the series landing pages and the prev/next navigation on post pages.

The prev/next links on a post page are derived from the series post list at build time. The current post's position in the ordered list determines which posts are adjacent.

#### 4.5.3 Routes

| Route | Source | Content |
|-------|--------|---------|
| `/series/[slug]` | `src/pages/series/[slug].astro` | Series name, description, and ordered list of posts. Each post entry shows title, date, and reading time. |

Series landing pages are generated at build time via `getStaticPaths()` — one page per series returned by the `AllSeries` query.

#### 4.5.4 Visual Treatment

**Post meta line (on post page):**
```
January 10, 2026 · 8 min read · Part 3 of Building a Terminal Emulator
```
The series name is a link to `/series/building-a-terminal-emulator`. The "Part N" number is derived from the post's position in the series sort order.

**Post index (on `/`):**
```
Building the VT Parser                                    January 10, 2026
  Part of: Building a Terminal Emulator
```
The series label is a secondary line in a muted color/smaller size. It links to the series landing page.

**Series navigation (bottom of post page):**
```
───────────────────────────────────────────────────
Part 3 of "Building a Terminal Emulator"
← Part 2: VT Parsing              Part 4: Font Rendering →
───────────────────────────────────────────────────
```
A horizontal rule separates it from the post body. The component is only rendered if the post belongs to a series. If there is no previous or next post, that side is blank.

**Series landing page (`/series/[slug]`):**
- Series name as h1.
- Series description (if provided) rendered below.
- Ordered list of posts — title (linked to post page), date, reading time. Uses the author-defined sort order, not reverse-chronological.

---

## 5. Architecture Decision Records

### ADR-001: Astro as the Static Site Generator

**Status:** Accepted

**Context:** We need a framework to fetch data from Hashnode at build time and produce static HTML. Options considered: Next.js (SSG mode), Hugo, 11ty, Astro.

**Decision:** Use Astro.

**Rationale:**
- Astro is purpose-built for content-driven static sites. Its zero-JS-by-default output model is the right fit for a blog.
- First-class Hashnode integration is documented in Astro's official CMS guides.
- Astro ships with built-in syntax highlighting (Shiki) at build time — no client-side JS needed.
- The "islands architecture" gives an escape hatch if we ever need interactive components, without compromising the base case.
- Next.js is overpowered for this use case and ships a JavaScript runtime by default. Hugo would require Go templating and has no native GraphQL client. 11ty is viable but Astro's developer experience and TypeScript support are stronger.

**Consequences:**
- The team needs familiarity with Astro's `.astro` file format and its `getStaticPaths()` API.
- Astro's ecosystem is younger than Next.js — some edge-case integrations may require manual work.

---

### ADR-002: Vanilla CSS, No Framework

**Status:** Accepted

**Context:** The site has minimal styling needs. Options considered: Tailwind CSS, vanilla CSS, CSS Modules.

**Decision:** Use vanilla CSS with a single global stylesheet. No CSS framework.

**Rationale:**
- The entire site's styles will fit in ~150 lines of CSS. A framework adds tooling, configuration, and a build step to produce what amounts to a few dozen rules.
- The post body HTML comes from Hashnode as semantic HTML. Styling it requires element-level selectors (`article h2`, `article pre`, etc.), which is exactly what vanilla CSS does naturally. Tailwind would fight this pattern — you'd end up writing `@apply` rules that recreate vanilla CSS with extra steps.
- Zero dependencies means zero upgrade churn. The CSS will work identically in 5 years.
- A single `global.css` file is easy to audit, understand, and maintain. The entire styling surface is visible in one scroll.

**Consequences:**
- No utility classes. All styling is done through a traditional stylesheet.
- Developers must write actual CSS, including responsive media queries.

---

### ADR-003: `graphql-request` as the GraphQL Client

**Status:** Accepted

**Context:** We need a GraphQL client to query Hashnode's API at build time. Options considered: raw `fetch`, `graphql-request`, `urql`, `Apollo Client`.

**Decision:** Use `graphql-request`.

**Rationale:**
- `graphql-request` is a minimal, dependency-light GraphQL client (~5KB). It wraps `fetch` with just enough ergonomics (typed responses, variable support, error handling) to avoid boilerplate.
- It is the client recommended by Astro's official Hashnode integration guide.
- Apollo Client and urql are designed for client-side state management and caching — capabilities we don't need in a build-time-only context. They would be dead weight.
- Raw `fetch` works but requires manual JSON body construction and response parsing. `graphql-request` eliminates that boilerplate without adding complexity.

**Consequences:**
- Two dependencies added: `graphql` (peer dependency) and `graphql-request`.
- The client module (`src/lib/client.ts`) is ~10 lines of code.

---

### ADR-004: Light Mode Only (v1)

**Status:** Accepted

**Context:** Should the site support dark mode?

**Decision:** Ship light mode only in v1. Revisit in v2.

**Rationale:**
- The design reference (mitchellh.com) is light mode. Matching it reduces design decisions.
- Dark mode done well requires careful attention to contrast ratios, code block theming, image treatment, and the flash-of-wrong-theme problem (FOWT). This is non-trivial work that doesn't serve the core goal of "get the blog live."
- Adding dark mode later is straightforward with CSS custom properties — define the palette as variables now, swap values via `prefers-color-scheme` later.

**Consequences:**
- Users who prefer dark mode will see a light site. This is acceptable for v1.
- CSS should use custom properties for all colors from day one so the dark mode migration is a variable swap, not a rewrite.

---

### ADR-005: No Build-Time Image Download

**Status:** Accepted

**Context:** Should we download and self-host images from Hashnode posts during the build?

**Decision:** No. Serve images directly from Hashnode's CDN (`cdn.hashnode.com`).

**Rationale:**
- Hashnode's CDN already provides image optimization (resizing, format negotiation, caching). Duplicating this would add significant build complexity for marginal benefit.
- Downloading all images at build time increases build duration and artifact size proportionally to the number of posts. For a blog with 50+ image-heavy posts, this could meaningfully slow deploys.
- If Hashnode's CDN becomes unavailable, images break regardless of whether we cached them — the post body HTML still references Hashnode URLs. A full migration would require HTML rewriting, which is a different scope of work.

**Consequences:**
- The site has a runtime dependency on Hashnode's CDN for images. If the CDN goes down, images break but text content remains intact (it was baked in at build time).
- Image loading performance depends on Hashnode's CDN, not our hosting provider.

---

### ADR-006: Hashnode Content as HTML, Not Markdown

**Status:** Accepted

**Context:** Hashnode's API offers post content in both `content.html` and `content.markdown`. Which should we consume?

| | `content.html` | `content.markdown` |
|---|---|---|
| **Code highlighting** | Pre-highlighted by Hashnode (50+ languages) | We render via Shiki (full control over theme) |
| **Embeds** (YouTube, Twitter, GitHub) | Rendered as full HTML embed markup | Raw `%[url]` syntax — requires custom remark plugin or won't render |
| **HTML structure** | Controlled by Hashnode, may change | Controlled by us via remark/rehype |
| **Dependencies** | None — inject as-is | `remark`, `rehype`, `remark-gfm`, Shiki config |
| **CSS strategy** | Target semantic elements (`article h2`, `article pre`) | Same, but HTML structure is predictable |
| **Effort** | Low — style what arrives | Medium — build rendering pipeline + embed plugin |

**Decision:** Use `content.html`.

**Rationale:**
- The embed support is the deciding factor. Hashnode's `%[url]` syntax for YouTube, Twitter, GitHub, and other embeds is non-standard markdown. Using `content.markdown` means either writing a custom remark plugin to parse and render every embed type, or accepting that embeds silently break. Neither is acceptable.
- Hashnode's pre-rendered HTML includes syntax highlighting for 50+ languages. While we lose theme control (vs. Shiki), the highlighting works out of the box with no configuration.
- The lower dependency count aligns with the project's minimalism. No remark, no rehype, no plugins.
- The trade-off — we don't control the HTML structure — is manageable. Our CSS targets semantic elements (`h2`, `pre`, `blockquote`), not Hashnode-specific classes. This is resilient to upstream changes.

**Consequences:**
- Post body styling must be robust against whatever HTML structure Hashnode produces. Test with diverse post content (code blocks in multiple languages, tables, embedded YouTube/Twitter, blockquotes, nested lists, images, KaTeX math).
- If Hashnode's code highlighting theme clashes with the site design, override it with CSS scoped to the article container.
- If a future requirement demands full rendering control (e.g., custom code block components, copy-to-clipboard buttons), revisit this decision and switch to `content.markdown` with a custom pipeline.

---

### ADR-007: Vercel as Hosting Platform

**Status:** Accepted

**Context:** The site will be deployed at `blog.coada.dev`. Which hosting platform serves the static files?

**Decision:** Use Vercel.

**Rationale:**
- Vercel auto-detects Astro projects and configures the correct build settings (`astro build`, output dir `dist/`) with zero configuration.
- For a purely static Astro site, no adapter or additional dependency is needed. The default static output mode works out of the box.
- Vercel provides deploy hooks — unique URLs that accept a POST request to trigger a rebuild. This is the mechanism Hashnode's webhooks will call to keep the site in sync with published content.
- Custom subdomain support (`blog.coada.dev`) is straightforward: add the domain in Vercel's project settings and configure a CNAME record.
- Automatic HTTPS via Let's Encrypt, global CDN, and preview deployments on pull requests come included.

**Consequences:**
- The project is deployed via Git integration (push to `main` → production deploy).
- A Vercel deploy hook must be created and configured as a Hashnode webhook target.
- DNS for `blog.coada.dev` requires a CNAME record pointing to Vercel's DNS target.
- The `@astrojs/vercel` adapter is installed to support the server-rendered `/api/subscribe` endpoint (see ADR-008). All other pages remain prerendered static HTML.

---

### ADR-008: Newsletter Subscribe via Server-Side Proxy

**Status:** Accepted

**Context:** Hashnode has built-in newsletter functionality with a `subscribeToNewsletter` GraphQL mutation. We want to let readers subscribe from the blog itself. However, mutations require a Hashnode access token for authentication. How do we handle this on a static site?

Options considered:
- **(A) Vercel serverless function** — a `/api/subscribe` endpoint proxies the mutation server-side, keeping the token secret.
- **(B) Direct client-side call** — the form calls Hashnode's API directly from the browser, exposing the token in client code.
- **(C) Link to Hashnode** — skip the form entirely, link readers to Hashnode's native subscribe page.

**Decision:** Option A — server-side proxy via a Vercel serverless function.

**Rationale:**
- The Hashnode access token must not be exposed in client-side code. Even though `subscribeToNewsletter` is a low-risk mutation, leaking any credential is poor practice and sets a bad precedent.
- A single serverless function (`/api/subscribe`) keeps the architecture almost entirely static. Every page is still prerendered HTML served from the CDN. Only this one endpoint runs as a function.
- Astro supports this cleanly via hybrid rendering: set `output: 'static'` globally, then mark the API route with `export const prerender = false`.
- Option C (linking out) works but breaks the self-contained feel of the site and adds friction for the reader.

**Consequences:**
- The `@astrojs/vercel` adapter is now a dependency, even though only one route uses it.
- The `HASHNODE_ACCESS_TOKEN` env var must be set in Vercel's project settings.
- The subscribe form requires ~15 lines of inline client-side JavaScript for the `fetch()` call and UI feedback. This is the only JS on the site.

---

## 6. Open Questions

These items need resolution before or during implementation:

1. **Pagination ceiling:** For a blog with < 200 posts, paginating at build time is trivial. If the blog grows to 1000+ posts, the build-time fetch loop needs a hard cap or incremental build strategy. Not a v1 concern but worth noting.

**Resolved in this version:**
- ~~Hashnode code block styling~~ → Addressed in ADR-006 and Section 4.1. Using `content.html` means Hashnode provides pre-highlighted code. Test and override via CSS if needed.
- ~~Draft/scheduled posts~~ → Addressed in Section 3.2.3. Public API returns published posts only. Scheduled posts excluded until their publish time passes.
- ~~RSS feed content~~ → Decided: full post HTML. See Section 3.6.
- ~~Webhook for rebuilds~~ → Using Vercel deploy hooks. See Section 7.4.

---

## 7. Deployment

### 7.1 Overview

The deployment pipeline has three parts: Vercel project setup (once), DNS configuration (once), and Hashnode webhook for automated rebuilds (once). After initial setup, the flow is fully automated: publish on Hashnode → webhook fires → Vercel rebuilds → `blog.coada.dev` updates.

### 7.2 Vercel Project Setup

**Prerequisites:** A Vercel account (free tier is sufficient) and the project repository hosted on GitHub.

**Steps:**

1. Import the GitHub repository into Vercel via the Vercel dashboard ("Add New Project" → select repo).
2. Vercel auto-detects Astro and pre-fills the build configuration:
   - **Framework Preset:** Astro
   - **Build Command:** `astro build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
3. Add environment variables in Vercel's project settings (Settings → Environment Variables):
   - `HASHNODE_PUBLICATION_HOST` = `yourblog.hashnode.dev`
   - `HASHNODE_ACCESS_TOKEN` = your Hashnode personal access token (from Hashnode Settings → Developer)
   - `SITE_URL` = `https://blog.coada.dev`
4. Click "Deploy." The initial build fetches all posts from Hashnode and generates the static site.

**Adapter note:** The `@astrojs/vercel` adapter is installed in this project to support the server-rendered `/api/subscribe` endpoint. All other pages are prerendered at build time and served as static HTML from the CDN. Vercel auto-detects the hybrid configuration.

### 7.3 Custom Domain (blog.coada.dev)

1. In the Vercel project, go to **Settings → Domains**.
2. Add `blog.coada.dev`.
3. Vercel will display a CNAME record to configure. At your DNS provider (wherever `coada.dev` is managed), add:

   | Type | Name | Value |
   |------|------|-------|
   | CNAME | `blog` | `cname.vercel-dns.com` (or the project-specific value Vercel displays) |

4. Vercel verifies the DNS record and provisions an SSL certificate automatically via Let's Encrypt.
5. Once verified, all deployments are live at `https://blog.coada.dev`.

### 7.4 Automated Rebuilds (Hashnode → Vercel)

When a post is published, updated, or deleted on Hashnode, the static site must be rebuilt to reflect the change. This is handled by connecting a Hashnode webhook to a Vercel deploy hook.

**Step 1: Create a Vercel Deploy Hook**

1. In the Vercel project, go to **Settings → Git → Deploy Hooks**.
2. Create a new hook:
   - **Name:** `hashnode-publish` (or any descriptive name)
   - **Branch:** `main`
3. Copy the generated URL. It looks like:
   ```
   https://api.vercel.com/v1/integrations/deploy/prj_XXXX/YYYY
   ```
   Treat this URL like a secret — anyone with it can trigger a deploy.

**Step 2: Configure Hashnode Webhook**

1. In your Hashnode blog dashboard, go to **Settings → Webhooks**.
2. Create a new webhook:
   - **URL:** Paste the Vercel deploy hook URL from Step 1.
   - **Events:** Select post-related events (post published, post updated, post deleted).
3. Use the "Test" button to send a test event and verify Vercel receives it and triggers a build.

**Behavior:**
- When you publish or update a post on Hashnode, the webhook fires a POST request to Vercel.
- Vercel pulls the latest code from the `main` branch, runs `astro build` (which re-fetches all content from Hashnode's API), and deploys the updated static site.
- If multiple webhooks fire in quick succession (e.g., bulk edits), Vercel automatically debounces — previous in-flight builds for the same deploy hook are canceled.
- Hashnode retries failed webhook deliveries up to 3 times with exponential backoff.

### 7.5 Deployment Modes Summary

| Trigger | How It Works |
|---------|-------------|
| **Git push** | Push to `main` → Vercel auto-builds and deploys. |
| **Hashnode webhook** | Publish/update a post → Hashnode POST to deploy hook → Vercel rebuilds. |
| **Manual** | Click "Redeploy" in the Vercel dashboard, or `curl -X POST <deploy-hook-url>`. |

### 7.6 Hashnode Headless Mode

After the Vercel deployment is live at `blog.coada.dev`, enable headless mode in Hashnode so that Hashnode stops rendering its own UI for your blog and redirects readers to your custom frontend:

1. In the Hashnode blog dashboard, go to **Settings → Domain → Advanced**.
2. Select the **"Headless CMS"** tab.
3. Enable headless mode.
4. Enter your blog base URL: `https://blog.coada.dev`
5. Save.

Hashnode will now treat your blog as headless and redirect all reader traffic to `blog.coada.dev`.

---

## 8. Success Criteria

The project is complete when:

- [ ] `npm run build` produces a working static site from Hashnode content with zero manual steps.
- [ ] The post index at `/` lists all published posts, reverse-chronologically, with series labels on posts that belong to a series.
- [ ] Each post page at `/[slug]` renders the full Hashnode content with correct typography, code highlighting, and image display.
- [ ] Posts in a series show the series name and part number in the meta line, linked to the series landing page.
- [ ] Posts in a series show prev/next navigation at the bottom of the post body, in series sort order.
- [ ] Each series has a landing page at `/series/[slug]` listing its posts in the author-defined sort order.
- [ ] The subscribe form at the bottom of each post successfully registers an email with Hashnode's newsletter.
- [ ] The `HASHNODE_ACCESS_TOKEN` is never exposed in client-side code or HTML source.
- [ ] The site scores 95+ on Lighthouse (Performance, Accessibility, Best Practices, SEO).
- [ ] The site is visually consistent with the mitchellh.com design target at desktop and mobile widths.
- [ ] The site deploys to `blog.coada.dev` via Vercel and serves over HTTPS.
- [ ] Publishing a post on Hashnode triggers a Vercel rebuild via webhook within 60 seconds.
- [ ] Hashnode headless mode is enabled and redirects readers to `blog.coada.dev`.
- [ ] An RSS feed is generated at `/rss.xml` with full post HTML.
