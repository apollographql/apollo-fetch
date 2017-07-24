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

Batched middleware and afterware are added to an `ApolloFetch` with `batchUse` and `batchUseAfter`.
Middleware has access to the array of requests in `request`.
Afterware has access to the single network response, which contains the array of GraphQL results in `parsed`.

```js
const apolloFetch = createApolloFetch();

const batchMiddleware = ({ requests, options }, next) => { ... next(); };

const batchAfterware = ({ response, options }, next) => { ... next(); };

apolloFetch.batchUse(batchMiddleware);
apolloFetch.batchUseAfter(batchAfterware);
```

Batched middleware and afterware exhibit the same chaining semantics as the single request variant.

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

Since GraphQL does not include batched requests in the formal spec, `apollo-fetch` creates a request that is compatible with [`apollo-server`](https://github.com/apollographql/apollo-server).
The default behavior of translating a GraphQL request into the fetch options, a simple `JSON.stringify(requestOrRequests)`, is found in `constructDefaultOptions`.

For other formatting needs, `createApolloFetch` accepts a `constructOptions` parameter that will set the options that are passed to the underlying `fetch` function.

### Error Handling

Errors are handled in the same manner as a single request, so all responses are passed to afterware including network errors.
An additional error, `BatchError`, is thrown when the `parsed` property of the `ParsedResponse` returned from afterware is not an array.

## Batched API

```js
ApolloFetch {
  (operation: GraphQLRequest[]): Promise<FetchResult[]>;
  batchUse: (middlewares: BatchMiddlewareInterface) => ApolloFetch;
  batchUseAfter: (afterwares: BatchAfterwareInterface) => ApolloFetch;
}
```

Batched Middleware used by `ApolloFetch`

```js
BatchMiddlewareInterface: (request: RequestsAndOptions, next: Function) => void

RequestsAndOptions {
  requests: GraphQLRequest[];
  options: RequestInit;
}
```

Batched Afterware used by `ApolloFetch` has access to the Response.

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
