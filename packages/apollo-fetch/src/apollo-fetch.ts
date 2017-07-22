import {
  FetchResult,
  RequestAndOptions,
  ResponseAndOptions,
  RequestsAndOptions,
  AfterwareInterface,
  MiddlewareInterface,
  BatchedAfterwareInterface,
  BatchedMiddlewareInterface,
  FetchOptions,
  ApolloFetch,
  ParsedResponse,
  GraphQLRequest,
  FetchError,
} from './types';
import 'isomorphic-fetch';

type WareStack = MiddlewareInterface[] | BatchedMiddlewareInterface[] | AfterwareInterface[] | BatchedAfterwareInterface[];

function buildWareStack<M>(funcs: WareStack, modifiedObject: M, resolve) {
  const next = () => {
    if (funcs.length > 0) {
      const f = funcs.shift();
      if (f) {
        f.apply(this, [modifiedObject, next]);
      }
    } else {
      resolve(modifiedObject);
    }
  };
  next();
}

export function constructDefaultOptions(request: GraphQLRequest | GraphQLRequest[], options: RequestInit) {
  let body;
  try {
    body = JSON.stringify(request);
  } catch (e) {
    throw new Error(`Network request failed. Payload is not serializable: ${e.message}`);
  }

  return {
    body,
    method: 'POST',
    ...options,
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
      ...(options.headers || []),
    },
  };
}

function throwHttpError(response, error) {
  let httpError;
  if (response && response.status >= 300) {
    httpError = new Error(`Network request failed with status ${response.status} - "${response.statusText}"`);
  } else {
    httpError = new Error(`Network request failed to return valid JSON`);
  }
  (httpError as any).response = response;
  (httpError as any).parseError = error;

  throw httpError as FetchError;
}

function throwBatchError(response) {
  let httpError = new Error(`A batched Operation of responses for `);
  (httpError as any).response = response;

  throw httpError as FetchError;
}

export function createApolloFetch(params: FetchOptions = {}): ApolloFetch {
  const {constructOptions, customFetch} = params;

  const _uri = params.uri || '/graphql';
  const middlewares = [];
  const batchedMiddlewares = [];
  const afterwares = [];
  const batchedAfterwares = [];


  const applyMiddlewares = (
    requestAndOptions: RequestAndOptions | RequestsAndOptions,
    batched: boolean,
  ): Promise<RequestAndOptions | RequestsAndOptions> => {
    return new Promise((resolve, reject) => {
      if (batched) {
        buildWareStack([...batchedMiddlewares], requestAndOptions, resolve);
      } else {
        buildWareStack([...middlewares], requestAndOptions, resolve);
      }
    });
  };

  const applyAfterwares = (responseObject: ResponseAndOptions, batched: boolean): Promise<ResponseAndOptions> => {
    return new Promise((resolve, reject) => {
      if (batched) {
        buildWareStack([...batchedAfterwares], responseObject, resolve);
      } else {
        buildWareStack([...afterwares], responseObject, resolve);
      }
    });
  };

  const apolloFetch: ApolloFetch = <ApolloFetch>Object.assign(
    function (request: GraphQLRequest | GraphQLRequest[]): Promise<FetchResult | FetchResult[]> {
      let options = {};
      let parseError;

      const batched = Array.isArray(request);

      const requestObject = <RequestAndOptions | RequestsAndOptions>{
        request,
        options,
      };

      return applyMiddlewares(requestObject, batched)
        .then(({ request: req, options: opt }) => (constructOptions || constructDefaultOptions)(req, opt))
        .then( opts => {
          options = {...opts};
          return (customFetch || fetch) (_uri, options);
        })
        .then( response => response.text().then( raw => {
            try {
              const parsed = JSON.parse(raw);
              return <ParsedResponse>{ ...response, raw, parsed };
            } catch (e) {
              parseError = e;

              //pass parsed raw response onto afterware
              return <ParsedResponse>{ ...response, raw };
            }
          }),
          //.catch() this should never happen: https://developer.mozilla.org/en-US/docs/Web/API/Body/text
        )
        .then(response => applyAfterwares({
          response,
          options,
        }, batched))
        .then(({ response }) => {
          if (response.parsed) {
            if (batched) {
              if (Array.isArray(response.parsed)) {
                return response.parsed as FetchResult[];
              } else {
                throwBatchError(response);
              }
            } else {
              return { ...response.parsed };
            }
          } else {
            throwHttpError(response, parseError);
          }
        });
    },
    {
      use: (middleware: MiddlewareInterface) => {
        if (typeof middleware === 'function') {
          middlewares.push(middleware);
        } else {
          throw new Error('Middleware must be a function');
        }

        return apolloFetch;
      },
      useAfter: (afterware: AfterwareInterface) => {
        if (typeof afterware === 'function') {
          afterwares.push(afterware);
        } else {
          throw new Error('Afterware must be a function');
        }

        return apolloFetch;
      },
      batchUse: (middleware: BatchedMiddlewareInterface) => {
        if (typeof middleware === 'function') {
          batchedMiddlewares.push(middleware);
        } else {
          throw new Error('Middleware must be a function');
        }

        return apolloFetch;
      },
      batchUseAfter: (afterware: BatchedAfterwareInterface) => {
        if (typeof afterware === 'function') {
          batchedAfterwares.push(afterware);
        } else {
          throw new Error('Afterware must be a function');
        }

        return apolloFetch;
      },
    },
  );

  return apolloFetch as ApolloFetch;
}
