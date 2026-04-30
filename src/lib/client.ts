import { GraphQLClient } from 'graphql-request';

const HASHNODE_ENDPOINT = 'https://gql.hashnode.com';

/**
 * Read-only client for build-time queries against Hashnode's public GraphQL API.
 * No auth needed — only published posts are returned. Newsletter subscriptions
 * go through Kit (see /api/subscribe), not Hashnode.
 */
export const hashnode = new GraphQLClient(HASHNODE_ENDPOINT);

export function publicationHost(): string {
  const host = import.meta.env.HASHNODE_PUBLICATION_HOST;
  if (!host) {
    throw new Error('HASHNODE_PUBLICATION_HOST is not set');
  }
  return host;
}
