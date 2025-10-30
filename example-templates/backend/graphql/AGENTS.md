# Agent Instructions for GraphQL API

## Overview
This folder contains GraphQL schema definitions, resolvers, and query/mutation handlers.

## Folder Purpose
GraphQL types, queries, mutations, subscriptions, and resolver logic for the GraphQL API.

## Agent Instructions

### Schema Definition
```graphql
type User {
  id: ID!
  email: String!
  username: String!
  posts: [Post!]!
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  comments: [Comment!]!
}

type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
  post(id: ID!): Post
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}
```

### Resolver Implementation
```typescript
const resolvers = {
  Query: {
    user: async (_parent, { id }, context) => {
      return await context.dataSources.userAPI.getUser(id);
    },
    users: async (_parent, { limit = 20, offset = 0 }, context) => {
      return await context.dataSources.userAPI.getUsers({ limit, offset });
    }
  },

  Mutation: {
    createUser: async (_parent, { input }, context) => {
      if (!context.user) {
        throw new AuthenticationError('Must be logged in');
      }
      return await context.dataSources.userAPI.createUser(input);
    }
  },

  User: {
    posts: async (user, _args, context) => {
      return await context.dataSources.postAPI.getPostsByUserId(user.id);
    }
  }
};
```

### Error Handling
- Use GraphQL-specific error classes (AuthenticationError, ForbiddenError, etc.)
- Return meaningful error messages
- Include error codes for client handling

### DataLoader for N+1 Prevention
```typescript
const userLoader = new DataLoader(async (userIds) => {
  const users = await db.getUsersByIds(userIds);
  return userIds.map(id => users.find(user => user.id === id));
});
```

<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

Add GraphQL-specific configuration here.
