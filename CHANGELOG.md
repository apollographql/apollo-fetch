# Change log

### vNEXT

Files can now be uploaded via mutation or query input variables, implementing the [`apollo-upload-client`](https://github.com/jaydenseric/apollo-upload-client) multipart request method. Setup [`apollo-upload-server`](https://github.com/jaydenseric/apollo-upload-server) to use this feature until support is added to [`graphql-server`](https://github.com/apollographql/graphql-server). Fixed [#6](https://github.com/apollographql/apollo-fetch/issues/6) via [#8](https://github.com/apollographql/apollo-fetch/pull/8).

### 0.3.0

Changes the middleware and afterware to accept functions instead of objects
`use` and `useAfter` now only accept a single middleware or afterware

### 0.2.0

Adds alias `apolloFetch` for default call to `createApolloFetch`

### 0.1.0

Initial release
