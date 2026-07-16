import { hashnode, publicationHost } from './client';
import {
  ALL_POSTS,
  ALL_SERIES,
  SERIES_POSTS,
  SINGLE_POST,
} from './queries';
import type {
  PostFull,
  PostListNode,
  SeriesFull,
  SeriesListItem,
} from './types';

// Hashnode caps `first` at 20 on every connection.
const PAGE_SIZE = 20;

export async function fetchAllPosts(): Promise<PostListNode[]> {
  const host = publicationHost();
  const all: PostListNode[] = [];
  let after: string | null = null;

  while (true) {
    const data: any = await hashnode.request(ALL_POSTS, {
      host,
      first: PAGE_SIZE,
      after,
    });
    const conn = data?.publication?.posts;
    if (!conn) break;
    for (const edge of conn.edges) all.push(edge.node);
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return all;
}

export async function fetchPost(slug: string): Promise<PostFull | null> {
  const host = publicationHost();
  const data: any = await hashnode.request(SINGLE_POST, { host, slug });
  return data?.publication?.post ?? null;
}

export async function fetchAllSeries(): Promise<SeriesListItem[]> {
  const host = publicationHost();
  const all: SeriesListItem[] = [];
  let after: string | null = null;

  while (true) {
    const data: any = await hashnode.request(ALL_SERIES, {
      host,
      first: PAGE_SIZE,
      after,
    });
    const conn = data?.publication?.seriesList;
    if (!conn) break;
    for (const edge of conn.edges) all.push(edge.node);
    if (!conn.pageInfo?.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return all;
}

export async function fetchSeries(seriesSlug: string): Promise<SeriesFull | null> {
  const host = publicationHost();
  let after: string | null = null;
  let merged: SeriesFull | null = null;
  const allEdges: SeriesFull['posts']['edges'] = [];

  while (true) {
    const data: any = await hashnode.request(SERIES_POSTS, {
      host,
      seriesSlug,
      first: PAGE_SIZE,
      after,
    });
    const series = data?.publication?.series;
    if (!series) return null;
    if (!merged) {
      merged = {
        id: series.id,
        name: series.name,
        slug: series.slug,
        description: series.description,
        posts: { edges: [] },
      };
    }
    for (const edge of series.posts.edges) allEdges.push(edge);
    if (!series.posts.pageInfo?.hasNextPage) break;
    after = series.posts.pageInfo.endCursor;
  }

  if (merged) merged.posts.edges = allEdges;
  return merged;
}

/**
 * Order series posts oldest-first (reading order). The current Hashnode API
 * no longer exposes the author-defined sortOrder field, so chronological
 * reading order is the one canonical ordering.
 */
export function orderSeriesPosts(series: SeriesFull) {
  const posts = series.posts.edges.map((e) => e.node);
  posts.sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );
  return posts;
}
