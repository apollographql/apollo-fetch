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
  FetchError,
} from './types';
import { extractFiles } from 'extract-files';
import 'isomorphic-fetch';

export function createApolloFetch(params: FetchOptions = {}): ApolloFetch {
  const {uri, customFetch} = params;

  const _uri = uri || '/graphql';
  const _middlewares = [];
  const _afterwares = [];

  const applyMiddlewares = (requestAndOptions: RequestAndOptions): Promise<RequestAndOptions> => {
    return new Promise((resolve, reject) => {
      const { request, options } = requestAndOptions;
      const buildMiddlewareStack = (funcs: MiddlewareInterface[], scope: any) => {
        const next = () => {
          if (funcs.length > 0) {
            const f = funcs.shift();
            if (f) {
              f.apply(scope, [{ request, options }, next]);
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

      buildMiddlewareStack([..._middlewares], this);
    });
  };


  const applyAfterwares = ({response, options}: ResponseAndOptions): Promise<ResponseAndOptions> => {
    return new Promise((resolve, reject) => {
      // Declare responseObject so that afterware can mutate it.
      const responseObject = {response, options};
      const buildAfterwareStack = (funcs: AfterwareInterface[], scope: any) => {
        const next = () => {
          if (funcs.length > 0) {
            const f = funcs.shift();
            if (f) {
              f.apply(scope, [responseObject, next]);
            }
          } else {
            resolve(responseObject);
          }
        };
        next();
      };

      // iterate through afterwares using next callback
      buildAfterwareStack([..._afterwares], this);
    });
  };

  const callFetch = ({ request, options }) => {
    const fetchOptions = {
      method: 'POST',
      headers: {},
      ...options,
    };

    // If uploads are possible extract files from the request variables
    const files = typeof FormData !== 'undefined'
      ? extractFiles(request.variables, 'variables')
      : [];

    if (files.length) {
      // Prepare a multipart form request
      fetchOptions.body = new FormData();
      fetchOptions.body.append('operations', JSON.stringify(request));
      files.forEach(({ path, file }) => fetchOptions.body.append(path, file));
    } else {
      // Prepare a standard JSON request
      fetchOptions.headers['Content-Type'] = 'application/json';
      try {
        fetchOptions.body = JSON.stringify(request);
      } catch (e) {
        throw new Error(`Network request failed. Payload is not serizable: ${e.message}`);
      }
    }

    return (customFetch || fetch)(_uri, fetchOptions);
  };

  const throwHttpError = (response, error) => {
    let httpError;
    if (response && response.status >= 300) {
      httpError = new Error(`Network request failed with status ${response.status} - "${response.statusText}"`);
    } else {
      httpError = new Error(`Network request failed to return valid JSON`);
    }
    (httpError as any).response = response;
    (httpError as any).parseError = error;

    throw httpError as FetchError;
  };

  const apolloFetch: ApolloFetch = <ApolloFetch>Object.assign(
    function (request: GraphQLRequest): Promise<FetchResult> {
      const options = {};
      let parseError;

      return applyMiddlewares({
        request,
        options,
      })
      .then( callFetch )
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
      use: (middleware: MiddlewareInterface) => {
        if (typeof middleware === 'function') {
          _middlewares.push(middleware);
        } else {
          throw new Error('Middleware must be a function');
        }

        return apolloFetch;
      },
      useAfter: (afterware: AfterwareInterface) => {
        if (typeof afterware === 'function') {
          _afterwares.push(afterware);
        } else {
          throw new Error('Afterware must be a function');
        }

        return apolloFetch;
      },
    },
  );

  return apolloFetch as ApolloFetch;
}

const apolloFetch = createApolloFetch();
export { apolloFetch };
