# DEPRECATED

Apollo Client 2.0 no longer uses `apollo-fetch` but [`apollo-link`](https://github.com/apollographql/apollo-link) instead. See https://www.apollographql.com/docs/react/2.0-migration.html for an example.

[This module is deprecated and will not receive further updates.](https://github.com/apollographql/apollo-fetch/issues/80)

# apollo-fetch [![npm version](https://badge.fury.io/js/apollo-fetch.svg)](https://badge.fury.io/js/apollo-fetch) [![Get on Slack](https://img.shields.io/badge/slack-join-orange.svg)](http://www.apollostack.com/#slack)


`apollo-fetch` is a lightweight client for GraphQL requests that supports middleware and afterware that modify requests and responses.

By default `apollo-fetch` uses `cross-fetch`, but you have the option of using a custom fetch function.

If you are interested in contributing, please read the [documentation on repository structure](docs/monorepo.md) and [Contributor Guide](CONTRIBUTING.md).

# Installation

```
npm install apollo-fetch --save
```

To use `apollo-fetch` in a web browser or mobile app, you'll need a build system capable of loading NPM packages on the client.
Some common choices include Browserify, Webpack, and Meteor +1.3.

# Usage

To create a fetch function capable of supporting middleware and afterware, use `createApolloFetch`:

```js
import { createApolloFetch } from 'apollo-fetch';

const uri = 'http://api.githunt.com/graphql';
const apolloFetch = createApolloFetch({ uri });
```

To execute the fetch function, call `apolloFetch` directly in the following way:

```js
apolloFetch({ query, variables, operationName }) //all apolloFetch arguments are optional
  .then(result => {
    const { data, errors, extensions } = result;
    //GraphQL errors and extensions are optional
  })
  .catch(error => {
    //respond to a network error
  });
```

### Middleware and Afterware

Middleware and Afterware are added with `use` and `useAfter` directly to `apolloFetch`:

```js
const apolloFetch = createApolloFetch();

const middleware = ({ request, options }, next) => { ... next(); };

const afterware = ({ response, options }, next) => { ... next(); };

apolloFetch.use(middleware);
apolloFetch.useAfter(afterware);
```

Middleware and Afterware can be chained together in any order:

```js
const apolloFetch = createApolloFetch();
apolloFetch
  .use(middleware1)
  .use(middleware2)
  .useAfter(afterware1)
  .useAfter(afterware2)
  .use(middleware3);
```

### Custom Fetch

For mocking and other fetching behavior, you may pass a fetch into `createApolloFetch`:

```js
const customFetch = createFileFetch();
const apolloFetch = createApolloFetch({ customFetch });
```

### Custom GraphQL to Fetch Translation

To modify how GraphQL requests are incorporated in the fetch options, you may pass a transformation function into `createApolloFetch`.
`apollo-fetch` exports `constructDefaultOptions` to allow conditional creation of the fetch options.
These transformations can be useful for servers that have different formatting for batches or other extra capabilities.

```js
//requestOrRequests: GraphQLRequest | GraphQLRequest[]
//options: RequestInit
const constructOptions = (requestOrRequests, options) => {
  return {
    ...options,
    body: JSON.stringify(requestOrRequests),
  }
};
const apolloFetch = createApolloFetch({ constructOptions });

//simplified usage inside apolloFetch
fetch(uri, constructOptions(requestOrRequests, options)); //requestOrRequests and options are the results from middleware
```

### Batched Requests

Batched requests are also supported by the fetch function returned by `createApolloFetch`, please refer the [batched request guide](docs/batch.md) for a complete description.

# Examples

### Simple GraphQL Query

```js
import { createApolloFetch } from 'apollo-fetch';

const uri = 'http://api.githunt.com/graphql';

const query = `
  query CurrentUser {
    currentUser {
      login,
    }
  }
`
const apolloFetch = createApolloFetch({ uri });

apolloFetch({ query }).then(...).catch(...);
```

### Simple GraphQL Mutation with Variables

```js
import { createApolloFetch } from 'apollo-fetch';

const uri = 'http://api.githunt.com/graphql';

const query = `
  mutation SubmitRepo ($repoFullName: String!) {
    submitRepository (repoFullName: $repoFullName) {
      id,
      score,
    }
  }
`;

const variables = {
  repoFullName: 'apollographql/apollo-fetch',
};

const apolloFetch = createApolloFetch({ uri });

apolloFetch({ query, variables }).then(...).catch(...);
```

### Middleware

A GraphQL mutation with authentication middleware.
Middleware has access to the GraphQL query and the options passed to fetch.

```js
import { createApolloFetch } from 'apollo-fetch';

const uri = 'http://api.githunt.com/graphql';

const apolloFetch = createApolloFetch({ uri });

apolloFetch.use(({ request, options }, next) => {
  if (!options.headers) {
    options.headers = {};  // Create the headers object if needed.
  }
  options.headers['authorization'] = 'created token';

  next();
});

apolloFetch(...).then(...).catch(...);
```

### Afterware

Afterware to check the response status and logout on a 401.
The afterware has access to the raw reponse always and parsed response when the data is proper JSON.

```js
import { createApolloFetch } from 'apollo-fetch';

const uri = 'http://api.githunt.com/graphql';

const apolloFetch = createApolloFetch({ uri });

apolloFetch.useAfter(({ response }, next) => {
  if (response.status === 401) {
    logout();
  }
  next();
});

apolloFetch(...).then(...).catch(...);
```

### Mocking a Fetch Call

This example uses a custom fetch to mock an unauthorized(401) request with a non-standard response body.
`apollo-fetch` replaces the call to `fetch` with `customFetch`, which both follow the standard [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

```js
const customFetch = () => new Promise((resolve, reject) => {
  const init = {
    status: 401,
    statusText: 'Unauthorized',
  };
  const body = JSON.stringify({
    data: {
      user: null,
    }
  });
  resolve(new Response(body, init));
}

const apolloFetch = createApolloFetch({ customFetch });
```

### Error Handling

All responses are passed to the afterware regardless of the http status code.
Network errors, `FetchError`, are thrown after the afterware is run and if no parsed response is received.

This example shows an afterware that can receive a 401 with an unparsable response and return a valid `FetchResult`.
Currently all other status codes that have an uparsable response would throw an error.
This means if a server returns a parsable GraphQL result on a 403 for example, the result would be passed to `then` without error.
Errors in Middleware and Afterware are propagated without modification.

```js
import { createApolloFetch } from 'apollo-fetch';

const uri = 'http://api.githunt.com/graphql';

const apolloFetch = createApolloFetch({ uri });

apolloFetch.useAfter(({ response }, next) => {
  //response.raw will be a non-null string
  //response.parsed may be a FetchResult or undefined

  if (response.status === 401 && !response.parsed) {
    //set parsed response to valid FetchResult
    response.parsed = {
      data: { user: null },
    };
  }

  next();
});

//Here catch() receives all responses with unparsable data
apolloFetch(...).then(...).catch(...);
```

### Apollo Integration

`apollo-fetch` is the first part of [Apollo Client's](https://github.com/apollographql/apollo-client) future network stack.
If you would like to try it out today,
you may replace the network interface with the following:

```js
import ApolloClient from 'apollo-client';
import { createApolloFetch } from 'apollo-fetch';
import { print } from 'graphql/language/printer';

const uri = 'http://api.githunt.com/graphql';

const apolloFetch = createApolloFetch({ uri });

const networkInterface = {
  query: (req) => apolloFetch({...req, query: print(req.query)}),
};

const client = new ApolloClient({
  networkInterface,
});
```

# API

`createApolloFetch` is a factory for `ApolloFetch`, a fetch function with middleware and afterware capabilities.
[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) and [`RequestInit`](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request) follow the MDN standard fetch API.

```js
createApolloFetch(options: FetchOptions): ApolloFetch

FetchOptions {
  uri?: string;
  customFetch?: (request: RequestInfo, init: RequestInit) => Promise<Response>;
  constructOptions?: (requestOrRequests: GraphQLRequest | GraphQLRequest[], options: RequestInit) => RequestInit;
}
/*
 * defaults:
 * uri = '/graphql'
 * customFetch = fetch from cross-fetch
 * constructOptions = constructDefaultOptions(exported from apollo-fetch)
 */
```

`ApolloFetch`, a fetch function with middleware, afterware, and batched request capabilities.
For information on batch usage, see the [batched request documentation](docs/batch.md).

```js
ApolloFetch {
  (operation: GraphQLRequest): Promise<FetchResult>;
  use: (middlewares: MiddlewareInterface) => ApolloFetch;
  useAfter: (afterwares: AfterwareInterface) => ApolloFetch;

  //Batched requests are described in the docs/batch.md
  (operation: GraphQLRequest[]): Promise<FetchResult[]>;
  batchUse: (middlewares: BatchMiddlewareInterface) => ApolloFetch;
  batchUseAfter: (afterwares: BatchAfterwareInterface) => ApolloFetch;
}
```

`GraphQLRequest` is the argument to an `ApolloFetch` call.
`query` is optional to support persistent queries based on only an `operationName`.

```js
GraphQLRequest {
  query?: string;
  variables?: object;
  operationName?: string;
}
```

`FetchResult` is the return value of an `ApolloFetch` call

```js
FetchResult {
  data: any;
  errors?: any;
  extensions?: any;
}
```

Middleware used by `ApolloFetch`

```js
MiddlewareInterface: (request: RequestAndOptions, next: Function) => void

RequestAndOptions {
  request: GraphQLRequest;
  options: RequestInit;
}
```

Afterware used by `ApolloFetch`

```js
AfterwareInterface: (response: ResponseAndOptions, next: Function) => void

ResponseAndOptions {
  response: ParsedResponse;
  options: RequestInit;
}
```

`ParsedResponse` adds `raw` (the body from the `.text()` call) to the fetch result, and `parsed` (the parsed JSON from `raw`) to the fetch's standard [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response).

```js
ParsedResponse extends Response {
  raw: string;
  parsed?: any;
}
```

A `FetchError` is returned from a failed call to `ApolloFetch`
is standard [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) that contains the response and a possible parse error.
The `parseError` is generated when the raw response is not valid JSON (when `JSON.parse()` throws) and the Afterware does not add an object to the response's `parsed` property.
Errors in Middleware and Afterware are propagated without modification.

```js
FetchError extends Error {
  response: ParsedResponse;
  parseError?: Error;
}
```
