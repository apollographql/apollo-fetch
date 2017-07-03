# apollo-fetch [![npm version](https://badge.fury.io/js/apollo-fetch.svg)](https://badge.fury.io/js/apollo-fetch) [![Get on Slack](https://img.shields.io/badge/slack-join-orange.svg)](http://www.apollostack.com/#slack)


`apollo-fetch` is a lightweight client for GraphQL requests that supports middleware and afterware that modify requests and responses.

By default `apollo-fetch` uses `isomorphic-fetch`, but you have the option of using a custom fetch function.

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
    const { data, error, extensions } = result;
    //GraphQL errors and extensions are optional
  })
  .catch(error => {
    //respond to a network error
  });
```

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

The `apolloFetch` from `apollo-fetch` is an alias for an empty call to `createApolloFetch`

```js
import { apolloFetch } from `apollo-fetch`;

//fetches a query from /graphql
apolloFetch({ query }).then(...).catch(...);
```

For mocking and other fetching behavior, you may pass a fetch into `createApolloFetch`:

```js
const customFetch = createFileFetch();
const apolloFetch = createApolloFetch({ customFetch });
```

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
  request: (req) => apolloFetch({...req, query: print(req.query)})
}

const client = new ApolloClient({
  networkInterface,
});
```


# API

`createApolloFetch` is a factory for `ApolloFetch`, a fetch function with middleware and afterware capabilities.

```js
createApolloFetch(options: FetchOptions): ApolloFetch

FetchOptions {
  uri?: string;
  customFetch?: (request: RequestInfo, init: RequestInit) => Promise<Response>;
}
/*
 * defaults:
 * uri = '/graphql'
 * customFetch = fetch from isomorphic-fetch
 */
```

`ApolloFetch`, a fetch function with middleware and afterware capabilities.

```js
ApolloFetch {
  (operation: GraphQLRequest): Promise<FetchResult>;
  use: (middlewares: MiddlewareInterface) => ApolloFetch;
  useAfter: (afterwares: AfterwareInterface) => ApolloFetch;
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
