import { author, ids, organization, site } from './site';

export interface ArticleData {
  url: string;
  title: string;
  description: string;
  publishedAt: string;
  modifiedAt?: string;
  image?: string;
  tags?: string[];
  section?: string;
}

function siteGraph() {
  return [
    {
      '@type': 'WebSite',
      '@id': ids.website,
      url: `${site.url}/`,
      name: site.name,
      description: site.description,
      inLanguage: site.language,
      publisher: { '@id': ids.organization },
    },
    {
      '@type': 'Organization',
      '@id': ids.organization,
      name: organization.name,
      url: organization.url,
      logo: organization.logo,
    },
    {
      '@type': 'Person',
      '@id': ids.person,
      name: author.name,
      alternateName: author.alternateName,
      url: `${site.url}/about`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: author.address.locality,
        addressRegion: author.address.region,
        addressCountry: author.address.country,
      },
      sameAs: [...author.sameAs],
      worksFor: { '@id': ids.organization },
    },
  ];
}

function articleNode(article: ArticleData) {
  const node: Record<string, unknown> = {
    '@type': 'BlogPosting',
    '@id': `${article.url}#article`,
    isPartOf: { '@id': ids.website },
    mainEntityOfPage: article.url,
    url: article.url,
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt ?? article.publishedAt,
    author: { '@id': ids.person },
    publisher: { '@id': ids.organization },
    inLanguage: site.language,
  };
  if (article.image) node.image = article.image;
  if (article.section) node.articleSection = article.section;
  if (article.tags?.length) node.keywords = article.tags;
  return node;
}

export function buildJsonLd(article?: ArticleData) {
  const graph = siteGraph();
  if (article) graph.push(articleNode(article));
  return { '@context': 'https://schema.org', '@graph': graph };
}
