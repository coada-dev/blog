export interface SeriesRef {
  id?: string;
  name: string;
  slug: string;
}

export interface PostListNode {
  id: string;
  title: string;
  slug: string;
  brief: string;
  publishedAt: string;
  readTimeInMinutes: number;
  series: SeriesRef | null;
}

export interface PostFull extends PostListNode {
  author?: { name: string } | null;
  content: { html: string };
  coverImage?: { url: string } | null;
  tags: { name: string; slug: string }[] | null;
  seo?: { title: string | null; description: string | null } | null;
}

export interface SeriesFull {
  id: string;
  name: string;
  slug: string;
  description: { html: string } | null;
  sortOrder: 'asc' | 'dsc' | string;
  posts: {
    edges: { node: Omit<PostListNode, 'series'> }[];
  };
}

export interface SeriesListItem {
  id: string;
  name: string;
  slug: string;
}
