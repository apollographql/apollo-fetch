# apollo-fetch

`apollo-fetch` is a lightweight fetch for GraphQL requests that supports the middleware and afterware to modify the request and response.

By default, `apollo-fetch` uses `isomorphic-fetch` and provides the option of using a custom fetch function.

In addition, `apollo-fetch` supports passing a context to the server and receiving a context.
This context can be used by the middleware and afterware.

# Usage

Simple GraphQL query

```js
import { createApolloFetch } from 'apollo-fetch'

const uri = 'example.com/graphql';

const query = `
  query sampleQuery(id: ID!) {
    sample(id: $id) {
      id,
      name
    }
  }
`

createApolloFetch({uri})({query})
.then((result) => {
  // GraphQL data, GraphQL errors, GraphQL extensions, and possible context from the server
  const {data, error, extensions, context} = result;
})
.catch((error) => {
  //respond to a network error
})
```

Simple GraphQL mutation with authentication middleware.
Middleware has access to the GraphQL query and the options passed to fetch.

```js
import { createApolloFetch } from 'apollo-fetch'

const uri = 'example.com/graphql';

const query = `
  query sampleMutation(id: ID!) {
    addSample(id: $id) {
      id,
      name
    }
  }
`

const apolloFetch = createApolloFetch({uri});

apolloFetch.use({applyMiddleware: ({request, options}, next) => {
  if (!options.headers) {
    options.headers = {};  // Create the headers object if needed.
  }
  options.headers['authorization'] = 'created token';

  next();
}});

apolloFetch({query})
.then((result) => {
  // GraphQL data, errors, and extensions plus context from the server
  const {data, error, extensions context} = result;
})
.catch((error) => {
  //respond to a network error
})
```

Afterware to check the response status and logout on a 401.
The afterware has access to the raw reponse always and parsed response when the data is proper JSON.

```js
import { createApolloFetch } from 'apollo-fetch'

const uri = 'example.com/graphql';

const apolloFetch = createApolloFetch({uri});

apolloFetch.useAfter({
  applyAfterware: ({ response }, next) => {
    if (response.status === 401) {
      logout();
    }
    next();
  }
});

apolloFetch({query})
.then((result) => {
  // GraphQL data, errors, and extensions plus context from the server
  const {data, error, extensions context} = result;
})
.catch((error) => {
  //respond to a network error
})
```

Middleware and Afterware can be chained together in any order:

```js
const apolloFetch = createApolloFetch();
apolloFetch.use([exampleWare1])
  .use([exampleWare2])
  .useAfter([exampleWare3])
  .useAfter([exampleWare4])
  .use([exampleWare5]);
```


# API

`createApolloFetch` is a factory for `ApolloFetch`, a fetch with middleware and afterware capabilities.

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

`ParsedResponse` adds `raw`, the body from the .text() call on the fetch result, and `parsed`, the parsed JSON from `raw`, onto the regular Response from the fetch call.

```js
ParsedResponse extends Response {
  raw: string;
  parsed?: any;
}
```

The error returned from a call to `ApolloFetch` is a normal error that contains the response, the raw response from .text(), a possible parse error.

```js
FetchError extends Error {
  response: ParsedResponse;
  raw: string;
  parseError?: Error;
}
