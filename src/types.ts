export interface ApolloFetch {
  (operation: GraphQLRequest): Promise<FetchResult>;
  use: (middlewares: MiddlewareInterface[]) => ApolloFetch;
  useAfter: (afterwares: AfterwareInterface[]) => ApolloFetch;
}

export interface GraphQLRequest {
  query?: string;
  variables?: object;
  operationName?: string;
  context?: object;
}

export interface FetchResult {
  data: any;
  errors?: any;
  extensions?: any;
  context?: object;
}

export interface AfterwareInterface {
  applyAfterware(response: ResponseAndOptions, next: Function): any;
}

export interface MiddlewareInterface {
  applyMiddleware(request: RequestAndOptions, next: Function): void;
}

export interface RequestAndOptions {
  request: GraphQLRequest;
  options: RequestInit;
}

export interface ParsedResponse extends Response {
  raw: string;
  parsed?: any;
}

export interface ResponseAndOptions {
  response: ParsedResponse;
  options: RequestInit;
}

export interface FetchOptions {
  uri?: string;
  customFetch?: (request: RequestInfo, init: RequestInit) => Promise<Response>;
}
