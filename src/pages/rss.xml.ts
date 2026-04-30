import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { fetchAllPosts, fetchPost } from '../lib/data';

export async function GET(context: APIContext) {
  const siteUrl =
    import.meta.env.SITE_URL ?? context.site?.toString() ?? 'https://blog.coada.dev';

  const list = await fetchAllPosts();

  // Fetch full content for each post — RSS items include the full body.
  const items = await Promise.all(
    list.map(async (p) => {
      const full = await fetchPost(p.slug);
      return {
        title: p.title,
        link: `/${p.slug}`,
        pubDate: new Date(p.publishedAt),
        description: p.brief,
        content: full?.content?.html ?? '',
      };
    })
  );

  return rss({
    title: 'Coada — Writing',
    description: 'Notes on engineering, infrastructure, and the systems we build at Coada.',
    site: siteUrl,
    items,
    customData: '<language>en-us</language>',
  });
}
