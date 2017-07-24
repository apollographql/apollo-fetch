# apollo-fetch Repository Structure

`apollo-fetch` is a [lerna](https://github.com/lerna/lerna) project that contains multiple `ApolloFetch`'s including the core `apollo-fetch` package.

## Commands

A couple of useful commands that you will want to run in the root of the repository during your development are:

* `lerna bootstrap`: installs all dependencies in packages and symlinks shared dependencies
* `lerna run test`: tests all projects in the lerna project
* `npm run coverage`: runs coverage for all lerna packages, depends on each module to have a `coverage:test` script.

Within a project, you are welcome to include your preferred workflow.

## Creating a new fetch

If you are creating a new fetch and would like to included in the lerna repository, the easiest place to start is copying the `apollo-fetch` folder in `<repository root>/packages`.
Copying the `apollo-fetch` folder will provide a good starting point for revision and additions.
Including new fetch's in the lerna project, will allow packages have integration tests with any core changes.

The typescript specific functionality is encapsulated within a package, so ou are also able to create a fetch with javascript to include here.

In order to include your fetch in the repository's coverage, include a `coverage:test` script in your `package.json`.
