# apollo-fetch Repository Structure

`apollo-fetch` is a [lerna](https://github.com/lerna/lerna) project that contains multiple `ApolloFetch`'s including the core `apollo-fetch` package.

## Creating a new fetch

If you are creating a new fetch and would like to included in the lerna repository, please open an Issue stating why your fetch should be included.

When creating a new fetch, copying the `apollo-fetch` folder into `<repository root>/packages` will provide a good starting point for a new fetch.
Make sure that the new fetch takes advantage of integration tests with `apollo-fetch`.

In order to include your fetch in the repository's coverage, include a `coverage:test` script in your `package.json`.

## Commands

A couple of useful commands that you will want to run in the root of the repository during your development are:

* `npm run bootstrap`: installs all dependencies in packages, symlinks shared dependencies, and builds modules
* `lerna bootstrap`: installs all dependencies in packages and symlinks shared dependencies
* `lerna run test`: tests all projects in the lerna project
* `npm run coverage`: runs coverage for all lerna packages, depends on each module to have a `coverage:test` script.

Within a project, you are welcome to include your preferred workflow.
