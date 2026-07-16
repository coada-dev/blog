import { GraphQLClient } from 'graphql-request';

const HASHNODE_ENDPOINT = 'https://gql.hashnode.com';

/**
 * Read-only client for build-time queries against Hashnode's GraphQL API.
 * As of Hashnode's 2026-05-13 changelog, reads require a Pro plan and a
 * Personal Access Token (hashnode.com/settings/developer). Newsletter
 * subscriptions go through Kit (see /api/subscribe), not Hashnode.
 */
function hashnodeToken(): string {
  const token = import.meta.env.HASHNODE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'HASHNODE_ACCESS_TOKEN is not set — Hashnode API reads require a Pro Personal Access Token (hashnode.com/settings/developer)'
    );
  }
  return token;
}

export const hashnode = new GraphQLClient(HASHNODE_ENDPOINT, {
  headers: { Authorization: hashnodeToken() },
});

export function publicationHost(): string {
  const host = import.meta.env.HASHNODE_PUBLICATION_HOST;
  if (!host) {
    throw new Error('HASHNODE_PUBLICATION_HOST is not set');
  }
  return host;
}
