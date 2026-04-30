import { GraphQLClient } from 'graphql-request';

const HASHNODE_ENDPOINT = 'https://gql.hashnode.com';

/**
 * Read-only client for build-time queries against Hashnode's public GraphQL API.
 * No auth needed — only published posts are returned.
 */
export const hashnode = new GraphQLClient(HASHNODE_ENDPOINT);

/**
 * Authenticated client for the server-side subscribe mutation. Token is read
 * lazily so build-time pages don't accidentally pull it into the client bundle.
 */
export function hashnodeAuthed(): GraphQLClient {
  const token = import.meta.env.HASHNODE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('HASHNODE_ACCESS_TOKEN is not set');
  }
  return new GraphQLClient(HASHNODE_ENDPOINT, {
    headers: { Authorization: token },
  });
}

export function publicationHost(): string {
  const host = import.meta.env.HASHNODE_PUBLICATION_HOST;
  if (!host) {
    throw new Error('HASHNODE_PUBLICATION_HOST is not set');
  }
  return host;
}
