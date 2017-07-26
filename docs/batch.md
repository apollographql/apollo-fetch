# Batched Requests in Apollo Fetch

`ApolloFetch` supports batched GraphQL requests with middleware and afterware without any additional work.

## Usage

`createApolloFetch` returns a function that implements the `ApolloFetch` interface, which overloads the function to accept an array of `GraphQL` requests in addition to the standard single request.
This example sends `request` twice with a single network request.

```js
const apolloFetch = createApolloFetch({ uri });
const request = { query, variables, operationName };

apolloFetch([request, request])
  .then(results => {
    results.map(({ data, error, extensions }) => {
      //access each GraphQL result independently
    });
  })
  .catch(error => {
    //respond to a network error
  });
```

Batch middleware and afterware are added to an `ApolloFetch` with `batchUse` and `batchUseAfter`.
Middleware has access to the array of requests in `request`.
Afterware has access to the single network response, which should contain an array of GraphQL results in `parsed`.

```js
const apolloFetch = createApolloFetch();

const batchMiddleware = ({ requests, options }, next) => { ... next(); };

const batchAfterware = ({ response, options }, next) => { ... next(); };

apolloFetch.batchUse(batchMiddleware);
apolloFetch.batchUseAfter(batchAfterware);
```

Batch middleware and afterware exhibit the same chaining semantics as the single request variant.

```js
const apolloFetch = createApolloFetch();
apolloFetch
  .batchUse(middleware1)
  .batchUse(middleware2)
  .batchUseAfter(afterware1)
  .batchUseAfter(afterware2)
  .batchUse(middleware3);
```

### Batch Formatting

Not all GraphQL servers support batching out of the box, so `apollo-fetch` creates a request that is compatible with [`apollo-server`](https://github.com/apollographql/apollo-server).
The default behavior of translating a GraphQL request into fetch options, a simple `JSON.stringify(requestOrRequests)`, is found in `constructDefaultOptions`.

For other formatting needs, `createApolloFetch` accepts a `constructOptions` parameter that will set the options that are passed to the underlying `fetch` function.
This is an example of another batch format, where the array of requests is broken into separate arrays for queries and variables and then `stringify`'d.

```js
import {
  constructDefaultOptions,
} from 'apollo-fetch';

function constructOptions(requestOrRequests, options){
  if(Array.isArray(requestOrRequests)) {
    //custom batching
    const requests = {
      queries: requestOrRequests.map(req => req.query),
      variables:requestOrRequests.map(req => req.variables),
    };
    return {
      ...options,
      body: JSON.stringify(requests),
    }
  } else {
    //single requests
    return constructDefaultOptions(requestOrRequests, options);
  }
}
```

### Error Handling

Errors are handled in the same manner as a single request, so all responses are passed to afterware including network errors.
An additional error, `BatchError`, is thrown when the `parsed` property of the `ParsedResponse` returned from afterware is not an array.

## Batch API

`ApolloFetch` supports batched requests with middleware and afterware.

```js
ApolloFetch {
  (operation: GraphQLRequest[]): Promise<FetchResult[]>;
  batchUse: (middlewares: BatchMiddlewareInterface) => ApolloFetch;
  batchUseAfter: (afterwares: BatchAfterwareInterface) => ApolloFetch;

  //Single Requests
  (operation: GraphQLRequest): Promise<FetchResult>;
  use: (middlewares: MiddlewareInterface) => ApolloFetch;
  useAfter: (afterwares: AfterwareInterface) => ApolloFetch;
}
```

Batch Middleware used by `ApolloFetch` has access to the requests and options passed to `constructOptions`.
[`RequestInit`](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request) follow the MDN standard fetch API.

```js
BatchMiddlewareInterface: (requests: RequestsAndOptions, next: Function) => void

RequestsAndOptions {
  requests: GraphQLRequest[];
  options: RequestInit;
}
```

Batch Afterware used by `ApolloFetch` has access to the single Response.

```js
BatchAfterwareInterface: (response: ResponseAndOptions, next: Function) => void

ResponseAndOptions {
  response: ParsedResponse;
  options: RequestInit;
}

//parsed is passed to afterware unchecked and should be an array
ParsedResponse extends Response {
  raw: string;
  parsed?: any;
}
```

`BatchError` is thrown when afterware finishes if the `parsed` property of the `ParsedResponse` is not an array for a batched request.

```js
export interface BatchError extends Error {
  response: ParsedResponse;
}
```
