import { GraphQLClient } from 'graphql-request';

// Hashnode's API moved when the GraphQL offering went paid (2026-05-13):
// the old gql.hashnode.com now 301s every request — authenticated or not —
// to the changelog announcement. gql-beta.hashnode.com is the endpoint
// Hashnode's own docs use post-change.
const HASHNODE_ENDPOINT = 'https://gql-beta.hashnode.com';

/**
 * Read-only client for build-time queries against Hashnode's GraphQL API.
 * Reads work when the publication is allow-listed via a Pro plan; the
 * Personal Access Token (raw value, no Bearer prefix) is only needed for
 * user-scoped queries, so it is attached when present. Newsletter
 * subscriptions go through Kit (see /api/subscribe), not Hashnode.
 */
const token = import.meta.env.HASHNODE_ACCESS_TOKEN;

export const hashnode = new GraphQLClient(HASHNODE_ENDPOINT, {
  headers: token ? { Authorization: token } : {},
});

export function publicationHost(): string {
  const host = import.meta.env.HASHNODE_PUBLICATION_HOST;
  if (!host) {
    throw new Error('HASHNODE_PUBLICATION_HOST is not set');
  }
  return host;
}
