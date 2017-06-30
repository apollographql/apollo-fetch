# apollo-fetch

`apollo-fetch` is a lightweight client for GraphQL requests that supports middleware and afterware that modify requests and responses.

By default `apollo-fetch` uses `isomorphic-fetch`, but you have the option of using a custom fetch function.

# Usage

To create a fetch function capable of supporting middleware and afterware, use `createApolloFetch`:

```js
import { createApolloFetch } from 'apollo-fetch'

const uri = 'http://api.githunt.com/graphql';
const apolloFetch = createApolloFetch({ uri });
```

To execute the fetch function, call `apolloFetch` directly in the following way:

```js
apolloFetch({ query, variables, operationName }) //all apolloFetch arguments are optional
.then( result => {
  const { data, error, extensions } = result;
  //GraphQL errors and extensions are optional
})
.catch( error => {
  //respond to a network error
})
```

Middleware and Afterware are added with `use` and `useAfter` directly to `apolloFetch`:

```js
const apolloFetch = createApolloFetch();

const middleware = {
  applyMiddleware: ({ request, options }) => { ... },
};

const afterware = {
  applyAfterware: ({ response, options }) => { ... },
};

apolloFetch.use([ middleware ]);
apolloFetch.useAfter([ afterware ]);
```

Middleware and Afterware can be chained together in any order:

```js
const apolloFetch = createApolloFetch();
apolloFetch.use([ middleware1 ])
  .use([ middleware2 ])
  .useAfter([ afterware1, afterware2 ])
  .useAfter([ afterware3 ])
  .use([ middleware3 ]);
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

Simple GraphQL query:

```js
import { createApolloFetch } from 'apollo-fetch'

const uri = 'http://api.githunt.com/graphql';

const query = `
  query sampleQuery(id: ID!) {
    sample(id: $id) {
      id,
      name
    }
  }
`
const apolloFetch = createApolloFetch({ uri });

apolloFetch({ query }).then(...).catch(...);
```

Simple GraphQL mutation with authentication middleware.
Middleware has access to the GraphQL query and the options passed to fetch.

```js
import { createApolloFetch } from 'apollo-fetch';

const uri = 'http://api.githunt.com/graphql';

const query = `
  query sampleMutation(id: ID!) {
    addSample(id: $id) {
      id,
      name
    }
  }
`;

const variables = {
  id: 1,
};

const apolloFetch = createApolloFetch({ uri });

apolloFetch.use([{
  applyMiddleware: ({ request, options }, next) => {
    if (!options.headers) {
      options.headers = {};  // Create the headers object if needed.
    }
    options.headers['authorization'] = 'created token';

    next();
  },
}]);

apolloFetch({ query, variables }).then(...).catch(...);
```

Afterware to check the response status and logout on a 401.
The afterware has access to the raw reponse always and parsed response when the data is proper JSON.

```js
import { createApolloFetch } from 'apollo-fetch'

const uri = 'http://api.githunt.com/graphql';

const apolloFetch = createApolloFetch({ uri });

apolloFetch.useAfter([{
  applyAfterware: ({ response }, next) => {
    if (response.status === 401) {
      logout();
    }
    next();
  },
}]);

apolloFetch(...).then(...).catch(...);
```


# API

`createApolloFetch` is a factory for `ApolloFetch`, a fetch function with middleware and afterware capabilities.

```js
createApolloFetch(options: FetchOptions): ApolloFetch

FetchOptions {
  uri?: string;
  customFetch?: (request: RequestInfo, init: RequestInit) => Promise<Response>;
}
/* defaults:
 * uri = '/graphql'
 * customFetch = fetch from isomorphic-fetch
 */
```

`ApolloFetch`, a fetch function with middleware and afterware capabilities.

```js
ApolloFetch {
  (operation: GraphQLRequest): Promise<FetchResult>;
  use: (middlewares: MiddlewareInterface[]) => ApolloFetch;
  useAfter: (afterwares: AfterwareInterface[]) => ApolloFetch;
}
```

`GraphQLRequest` is the argument to an `ApolloFetch` call

```js
GraphQLRequest {
  query?: string;
  variables?: object;
  operationName?: string;
  context?: object;
}
```

`FetchResult` is the return value of an `ApolloFetch` call

```js
FetchResult {
  data: any;
  errors?: any;
  extensions?: any;
  context?: object;
}
```

Middleware used by `ApolloFetch`

```js
MiddlewareInterface {
  applyMiddleware(request: RequestAndOptions, next: Function): void;
}

RequestAndOptions {
  request: GraphQLRequest;
  options: RequestInit;
}
```

Afterware used by `ApolloFetch`

```js
AfterwareInterface {
  applyAfterware(response: ResponseAndOptions, next: Function): any;
}

ResponseAndOptions {
  response: ParsedResponse;
  options: RequestInit;
}
```

`ParsedResponse` adds `raw` (the body from the `.text()` call) to the fetch result, and `parsed` (the parsed JSON from `raw`) to the regular Response from the fetch call.

```js
ParsedResponse extends Response {
  raw: string;
  parsed?: any;
}
```

Errors returned from a call to `ApolloFetch` are normal errors that contain the parsed response, the raw response from .text(), and a possible parse error.

```js
FetchError extends Error {
  response: ParsedResponse;
  raw: string;
  parseError?: Error;
}
