# apollo-fetch change log

## 0.4.0

- Converted the repository to a [Lerna](https://github.com/lerna/lerna) project. [PR #10](https://github.com/apollographql/apollo-fetch/pull/10)
- Support batched requests. [PR #10](https://github.com/apollographql/apollo-fetch/pull/10)

## 0.3.0

- Changed the middleware and afterware to accept functions instead of objects. `use` and `useAfter` now only accept a single middleware or afterware.

## 0.2.0

- Added an `apolloFetch` alias for a default call to `createApolloFetch`.

## 0.1.0

- Initial release.
