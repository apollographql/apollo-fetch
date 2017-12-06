# apollo-fetch change log

## next

## 0.7.0

- Switch to `cross-fetch` for react native functionality [PR #71](https://github.com/apollographql/apollo-fetch/pull/71)
- Change log moved into the published package. [PR #16](https://github.com/apollographql/apollo-fetch/pull/16)

## 0.6.0

- Added support for UMD and ES2015 modules for tree-shaking. [PR #9](https://github.com/apollographql/apollo-fetch/pull/9)

## 0.5.2

- Reverted v0.5.1.

## 0.5.1

- Fixed the build.

## 0.5.0

- Export all TypeScript types. [PR #13](https://github.com/apollographql/apollo-fetch/pull/13)

## 0.4.0

- Converted the repository to a [Lerna](https://github.com/lerna/lerna) project. [PR #10](https://github.com/apollographql/apollo-fetch/pull/10)
- Support batched requests. [PR #10](https://github.com/apollographql/apollo-fetch/pull/10)

## 0.3.0

- Changed the middleware and afterware to accept functions instead of objects. `use` and `useAfter` now only accept a single middleware or afterware.

## 0.2.0

- Added an `apolloFetch` alias for a default call to `createApolloFetch`.

## 0.1.0

- Initial release.
