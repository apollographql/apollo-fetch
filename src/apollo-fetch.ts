import {
  FetchResult,
  RequestAndOptions,
  ResponseAndOptions,
  AfterwareInterface,
  MiddlewareInterface,
  FetchOptions,
  ApolloFetch,
  ParsedResponse,
  GraphQLRequest,
} from './types';
import 'isomorphic-fetch';

export function createApolloFetch(params: FetchOptions = {}): ApolloFetch {
  const {uri, customFetch} = params;

  const _uri = uri || '/graphql';
  const _middlewares = [];
  const _afterwares = [];

  const applyMiddlewares = (requestAndOptions: RequestAndOptions): Promise<RequestAndOptions> => {
    return new Promise((resolve, reject) => {
      const { request, options } = requestAndOptions;
      const queue = (funcs: MiddlewareInterface[], scope: any) => {
        const next = () => {
          if (funcs.length > 0) {
            const f = funcs.shift();
            if (f) {
              f.applyMiddleware.apply(scope, [{ request, options }, next]);
            }
          } else {
            resolve({
              request,
              options,
            });
          }
        };
        next();
      };

      queue([..._middlewares], this);
    });
  };


  const applyAfterwares = ({response, options}: ResponseAndOptions): Promise<ResponseAndOptions> => {
    return new Promise((resolve, reject) => {
      // Declare responseObject so that afterware can mutate it.
      const responseObject = {response, options};
      const queue = (funcs: AfterwareInterface[], scope: any) => {
        const next = () => {
          if (funcs.length > 0) {
            const f = funcs.shift();
            if (f) {
              f.applyAfterware.apply(scope, [responseObject, next]);
            }
          } else {
            resolve(responseObject);
          }
        };
        next();
      };

      // iterate through afterwares using next callback
      queue([..._afterwares], this);
    });
  };

  const callFetch = ({request, options}) => {
    const opts = {
      body: JSON.stringify(request),
      method: 'POST',
      ...options,
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
        ...(options.headers as { [headerName: string]: string }),
      },
    };
    return customFetch ? customFetch(_uri, opts) : fetch(_uri, opts);
  };

  const throwHttpError = (response, error) => {
    let httpError;
    if (response && response.status >= 300) {
      httpError = new Error(`Network request failed with status ${response.status} - "${response.statusText}"`);
    } else {
      httpError = new Error(`Network request failed to return valid JSON`);
    }
    (httpError as any).response = response;
    (httpError as any).raw = response.raw;
    (httpError as any).parseError = error;

    throw httpError;
  };

  let apolloFetch: ApolloFetch = <ApolloFetch>Object.assign(
    function (request: GraphQLRequest): Promise<FetchResult> {
      const options = {};
      let parseError;

      return applyMiddlewares({
        request,
        options,
      })
      .then(callFetch)
      .then((response) => response.text().then((raw) => {
          try {
            const parsed = JSON.parse(raw);
            return <ParsedResponse>{ ...response, raw, parsed };
          } catch (e) {
            parseError = e;

            //pass parsed raw response onto afterware
            return <ParsedResponse>{ ...response, raw, parsed: null };
          }
        })
        .catch((error) => throwHttpError(response, error)),
      )
      .then(response => applyAfterwares({
        response,
        options,
      }))
      .then(({ response }) => {
        if (response.parsed) {
          return { ...response.parsed };
        } else {
          throwHttpError(response, parseError);
        }
      });
    },
    {
      use: (middlewares: MiddlewareInterface[]) => {
        middlewares.map((middleware) => {
          if (typeof middleware.applyMiddleware === 'function') {
            _middlewares.push(middleware);
          } else {
            throw new Error('Middleware must implement the applyMiddleware function');
          }
        });

        return apolloFetch;
      },
      useAfter: (afterwares: AfterwareInterface[]) => {
        afterwares.map((afterware) => {
          if (typeof afterware.applyAfterware === 'function') {
            _afterwares.push(afterware);
          } else {
            throw new Error('Afterware must implement the applyAfterware function');
          }
        });

        return apolloFetch;
      },
      _middlewares, //Added as hooks for testing
      _afterwares,
    },
  );

  return apolloFetch as ApolloFetch;
}

