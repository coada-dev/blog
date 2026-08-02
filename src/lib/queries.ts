import { gql } from 'graphql-request';

export const ALL_POSTS = gql`
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
`;

export const SINGLE_POST = gql`
  query SinglePost($host: String!, $slug: String!) {
    publication(host: $host) {
      id
      post(slug: $slug) {
        id
        title
        subtitle
        slug
        brief
        publishedAt
        readTimeInMinutes
        author {
          name
        }
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
`;

export const ALL_SERIES = gql`
  query AllSeries($host: String!, $first: Int!, $after: String) {
    publication(host: $host) {
      id
      seriesList(first: $first, after: $after) {
        edges {
          node {
            id
            name
            slug
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
`;

export const SERIES_POSTS = gql`
  query SeriesPosts(
    $host: String!
    $seriesSlug: String!
    $first: Int!
    $after: String
  ) {
    publication(host: $host) {
      id
      series(slug: $seriesSlug) {
        id
        name
        slug
        description {
          html
        }
        posts(first: $first, after: $after) {
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
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  }
`;

